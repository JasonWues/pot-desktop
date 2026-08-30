import { error as logError } from '@tauri-apps/plugin-log';

import { applyGlossaryToConfig, applyGlossaryToResult, glossarySignature } from './glossary';
import { getServiceName, whetherPluginService } from './service_instance';
import * as builtinInfo from '../services/translate/info';
import { applyPreset, DEFAULT_PRESET } from './ai_presets';
import { invoke_plugin } from './invoke_plugin';
import { getActiveGlossary } from './db';

import type {
    GlossaryResolvedService,
    TranslateServiceModule,
    LanguageMap,
    ResolvedService,
    ServiceConfig,
    ServiceInstanceKey,
    SetResult,
} from '../types/services';

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
export interface ResolveOptions {
    /** The installed `.potext` services, keyed by type then name. */
    pluginList?: Record<string, Record<string, { language: LanguageMap }>>;
    savedConfig?: ServiceConfig;
    preset?: string;
    /** `false` asks a streaming service not to stream. See `callService`. */
    stream?: boolean;
}

export function resolveService(
    instanceKey: ServiceInstanceKey,
    { pluginList, savedConfig, preset = DEFAULT_PRESET, stream }: ResolveOptions = {}
): ResolvedService {
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
    // Language enum; both are keyed by Gloss's own language codes.
    //
    // The guard is not decoration: `pluginList` is optional here because a caller
    // resolving a built-in service has no reason to have it, and both real call
    // sites read it out of React state that is empty on the first render. Without
    // this, resolving a plugin one tick too early threw
    // `Cannot read properties of undefined` from inside a subscript.
    let languageMap: LanguageMap;
    if (isPlugin) {
        const plugin = pluginList?.['translate']?.[serviceName];
        if (!plugin) {
            throw `Plugin service ${serviceName} is not installed, or the plugin list has not loaded yet`;
        }
        languageMap = plugin.language;
    } else {
        languageMap = builtinLanguages(serviceName);
    }

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
export async function withGlossary(
    resolved: ResolvedService,
    { from, to }: { from?: string; to?: string }
): Promise<GlossaryResolvedService> {
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
        applyGlossary: (value: string) => (wentIntoPrompt ? value : applyGlossaryToResult(value, entries)),
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
/**
 * Each built-in service's implementation, as a loader rather than a module.
 * `import.meta.glob` is lazy by default, so Rollup gives every service its own
 * chunk and the Translate window fetches exactly the one it is about to call --
 * where a static barrel put all 21, plus their `Config.jsx` forms and therefore
 * React and HeroUI, in the chunk every window shares.
 */
const implementations = import.meta.glob<TranslateServiceModule>('../services/translate/*/index.jsx');

async function builtinService(serviceName: string): Promise<TranslateServiceModule> {
    const load = implementations[`../services/translate/${serviceName}/index.jsx`];
    if (!load) {
        throw `Unknown translate service: ${serviceName}`;
    }
    return load();
}

/** The metadata barrel is static and tiny; only the implementation is deferred. */
function builtinLanguages(serviceName: string): LanguageMap {
    const entry = (builtinInfo as unknown as Record<string, { Language?: LanguageMap }>)[serviceName];
    if (!entry?.Language) {
        throw `Unknown translate service: ${serviceName}`;
    }
    return entry.Language;
}

export async function callService(
    resolved: ResolvedService,
    text: string,
    from: string,
    to: string,
    { detect, setResult = null }: { detect?: string; setResult?: SetResult } = {}
): Promise<unknown> {
    const { serviceName, isPlugin, config, languageMap } = resolved;

    if (isPlugin) {
        // `invoke_plugin` hands back the entry point and the `utils` object the
        // plugin protocol expects to receive alongside it.
        const [func, utils] = await invoke_plugin('translate', serviceName);
        return func(text, languageMap[from], languageMap[to], { config, detect, setResult, utils });
    }

    const service = await builtinService(serviceName);
    return service.translate(text, languageMap[from] as string, languageMap[to] as string, {
        config,
        detect,
        setResult,
    });
}
