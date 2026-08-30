// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import type { ServiceConfig } from '../types/services';

// `config` is optional on ResolvedService: a service with nothing saved resolves
// without one. Every assertion below has already established that this call did
// produce a config, so this says it once and fails the test -- not the type
// check -- if that stops being true.
function configOf(resolved: { config?: ServiceConfig }): ServiceConfig {
    const { config } = resolved;
    if (!config) {
        throw new Error('expected resolveService to have produced a config');
    }
    return config;
}

// The dispatch imports the translate barrel, which pulls in every service's
// Config.jsx and so React and HeroUI -- hence jsdom. Ollama's constructor runs
// in an effect that would otherwise reach for a real host.
vi.mock('ollama/browser', () => ({
    Ollama: class {
        async list() {
            return { models: [] };
        }
    },
}));

const { resolveService } = await import('./translate_dispatch');

// A plugin key takes the `pluginList` branch, so these cases need no real
// service behind them; `deepl` is used where the builtin branch is the point.
const PLUGIN_LIST = { translate: { pluginfoo: { language: { en: 'en', zh_cn: 'zh' } } } };

describe('resolveService', () => {
    it('flags a plugin instance without writing into the caller"s config', () => {
        const saved = { apiKey: 'x' };
        const resolved = resolveService('pluginfoo@abc', { pluginList: PLUGIN_LIST, savedConfig: saved });

        expect(resolved.isPlugin).toBe(true);
        expect(configOf(resolved).enable).toBe('true');
        // The Translate window keeps `savedConfig` in a map for the whole
        // session; writing the flag into it made its arrival depend on call order.
        expect(saved).toEqual({ apiKey: 'x' });
    });

    it('leaves a builtin instance unflagged and reads its Language enum', () => {
        const resolved = resolveService('deepl', { savedConfig: { type: 'free' } });

        expect(resolved.isPlugin).toBe(false);
        expect(configOf(resolved).enable).toBeUndefined();
        expect(resolved.languageMap).toHaveProperty('zh_cn');
    });

    it('turns streaming off only for an instance that has the field', () => {
        const streaming = resolveService('deepl', { savedConfig: { stream: true, apiKey: 'x' }, stream: false });
        expect(configOf(streaming).stream).toBe(false);

        // The seventeen services with no `stream` must not gain one: the config
        // is hashed into the cache key, so a new field would miss every entry
        // they already had.
        const plain = resolveService('deepl', { savedConfig: { apiKey: 'x' }, stream: false });
        expect('stream' in configOf(plain)).toBe(false);
    });

    it('leaves streaming alone when nothing asked for it to change', () => {
        const resolved = resolveService('deepl', { savedConfig: { stream: true } });
        expect(configOf(resolved).stream).toBe(true);
    });

    it('applies a preset to a service that reads a prompt, and not to one that does not', () => {
        const withPrompt = resolveService('openai', {
            savedConfig: { promptList: [{ role: 'system', content: 'original' }] },
            preset: 'polish',
        });
        expect(configOf(withPrompt).promptList?.[0]?.content).not.toBe('original');

        const noPrompt = resolveService('deepl', { savedConfig: { type: 'free' }, preset: 'polish' });
        expect(configOf(noPrompt)).toEqual({ type: 'free' });
    });

    it('survives an instance that has never been configured', () => {
        const resolved = resolveService('deepl', {});
        expect(resolved.serviceName).toBe('deepl');
        // Not `configOf` here: the absence is the assertion.
        expect(resolved.config).toBeUndefined();
    });
});

// `resolveService` now reads the language table out of the metadata-only barrel
// and `callService` loads the implementation separately, so the two halves can
// drift: a service could be added with an `index.jsx` and no `Language` in its
// `info.ts`, and nothing would notice until someone picked it and the dispatch
// threw. This is the check that they stay in step.
describe('the service barrels agree', () => {
    const infoBarrel = import.meta.glob<{ info?: unknown; Language?: unknown }>(
        '../services/translate/*/info.ts',
        { eager: true }
    );
    const implementations = import.meta.glob('../services/translate/*/index.jsx');

    const nameOf = (path: string) => path.split('/').at(-2);

    it('gives every service both an info and a Language table', () => {
        const missing = Object.entries(infoBarrel)
            .filter(([, module]) => !module.info || !module.Language)
            .map(([path]) => nameOf(path));
        expect(missing).toEqual([]);
    });

    it('has one implementation for every service that declares itself', () => {
        const declared = Object.keys(infoBarrel).map(nameOf).sort();
        const implemented = Object.keys(implementations).map(nameOf).sort();
        expect(implemented).toEqual(declared);
    });

    it('covers every service the static barrel exports', async () => {
        const staticBarrel = await import('../services/translate/info');
        expect(Object.keys(staticBarrel).sort()).toEqual(Object.keys(infoBarrel).map(nameOf).sort());
    });
});
