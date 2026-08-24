import { error as logError } from '@tauri-apps/plugin-log';

import { applyGlossaryToConfig, applyGlossaryToResult, glossarySignature } from './glossary';
import { getServiceName, whetherPluginService } from './service_instance';
import * as builtinServices from '../services/translate';
import { applyPreset, DEFAULT_PRESET } from './ai_presets';
import { invoke_plugin } from './invoke_plugin';
import { getActiveGlossary } from './db';

// The steps between "the user picked a service" and "the service was called",
// which the Translate window and the Recognize window's in-place overlay both
// have to walk. They used to walk it separately -- 193 lines against 74 -- and
// they had already drifted apart twice: the overlay hands no `setResult`, which
// three streaming services answer by returning the literal '[STREAM]', and the
// glossary had to be written into both files rather than one.
//
// What is deliberately NOT here is the cache. Both sites use `buildCacheKey`
// and the two `db.js` helpers directly, because their control flow around a hit
// genuinely differs: the Translate window has to tell a hit from a miss to
// report where the answer came from and to keep its own race guard, while the
// overlay runs the lookup once per block inside a concurrency limiter.

/**
 * The config the call will actually be made with, and the table its language
 * codes come from. Nothing here touches the network or the database.
 *
 * `savedConfig` is passed in rather than read here because the two callers have
 * it from different places -- a map the Translate window already holds, and the
 * store for the overlay.
 */
export function resolveService(instanceKey, { pluginList, savedConfig, preset = DEFAULT_PRESET, stream } = {}) {
    const serviceName = getServiceName(instanceKey);
    const isPlugin = whetherPluginService(instanceKey);

    let config = savedConfig;

    // The plugin protocol expects this flag on the config. It goes on before the
    // cache key is derived, so the key is the same on the first call as on the
    // hundredth. A copy rather than a write into the caller's object: the
    // Translate window's `savedConfig` comes out of a map it keeps for the whole
    // session, and mutating that made the flag's arrival depend on call order.
    if (isPlugin && config) {
        config = { ...config, enable: 'true' };
    }

    // A non-default preset swaps the prompt for this request only. It returns a
    // copy, so the saved config is untouched and -- because the cache key is
    // derived from the config actually used -- a polished result cannot come
    // back from the cache as a translation.
    config = applyPreset(config, serviceName, preset);

    // `stream: false` asks a service not to stream even though the instance is
    // configured to. Only meaningful for a caller with nowhere to put partial
    // text, and applied only when the instance carries the field: the config is
    // hashed into the cache key, so adding one to the services that have no
    // `stream` at all would miss every entry they already had.
    if (stream === false && config && 'stream' in config) {
        config = { ...config, stream: false };
    }

    // Plugins declare their languages in info.json, built-in services in a
    // Language enum; both are keyed by pot's own language codes.
    const languageMap = isPlugin
        ? pluginList['translate'][serviceName].language
        : builtinServices[serviceName].Language;

    return { instanceKey, serviceName, isPlugin, config, languageMap };
}

/**
 * Fold the glossary into what `resolveService` returned, once the language pair
 * is finally known -- which is later than it looks, since the Translate window
 * may swap the target language after checking that the service supports it.
 *
 * `from` should be the language actually being translated out of: with the
 * source set to auto that is the detected language, not the literal 'auto'.
 */
export async function withGlossary(resolved, { from, to }) {
    // A broken glossary must never stop a translation, so a failed read is
    // simply an empty one.
    const entries = await getActiveGlossary(from, to).catch((e) => {
        logError(`read glossary failed: ${e}`);
        return [];
    });

    const config = applyGlossaryToConfig(resolved.config, resolved.serviceName, entries);

    // `applyGlossaryToConfig` hands back the config it was given whenever it
    // could not place the terms -- a service that reads no prompt at all, or an
    // LLM instance saved before it had a `promptList`. That is exactly when the
    // result has to be rewritten instead, which makes the identity check a
    // better condition than asking `supportsPrompt` again: the second case would
    // disagree with it.
    const wentIntoPrompt = config !== resolved.config;

    return {
        ...resolved,
        config,
        glossary: glossarySignature(entries),
        applyGlossary: (value) => (wentIntoPrompt ? value : applyGlossaryToResult(value, entries)),
    };
}

/**
 * The call itself. Resolves with whatever the service returns -- plain text for
 * almost all of them, an object for the dictionary services.
 *
 * `setResult` is the streaming callback. Passing null means "no partial text
 * wanted", which is only safe alongside `stream: false` from `resolveService`;
 * on its own the streaming services abort and resolve with '[STREAM]'.
 */
export async function callService(resolved, text, from, to, { detect, setResult = null } = {}) {
    const { serviceName, isPlugin, config, languageMap } = resolved;

    if (isPlugin) {
        // `invoke_plugin` hands back the entry point and the `utils` object the
        // plugin protocol expects to receive alongside it.
        const [func, utils] = await invoke_plugin('translate', serviceName);
        return func(text, languageMap[from], languageMap[to], { config, detect, setResult, utils });
    }

    return builtinServices[serviceName].translate(text, languageMap[from], languageMap[to], {
        config,
        detect,
        setResult,
    });
}
