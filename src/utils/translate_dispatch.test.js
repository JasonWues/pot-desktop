// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

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
        expect(resolved.config.enable).toBe('true');
        // The Translate window keeps `savedConfig` in a map for the whole
        // session; writing the flag into it made its arrival depend on call order.
        expect(saved).toEqual({ apiKey: 'x' });
    });

    it('leaves a builtin instance unflagged and reads its Language enum', () => {
        const resolved = resolveService('deepl', { savedConfig: { type: 'free' } });

        expect(resolved.isPlugin).toBe(false);
        expect(resolved.config.enable).toBeUndefined();
        expect(resolved.languageMap).toHaveProperty('zh_cn');
    });

    it('turns streaming off only for an instance that has the field', () => {
        const streaming = resolveService('deepl', { savedConfig: { stream: true, apiKey: 'x' }, stream: false });
        expect(streaming.config.stream).toBe(false);

        // The seventeen services with no `stream` must not gain one: the config
        // is hashed into the cache key, so a new field would miss every entry
        // they already had.
        const plain = resolveService('deepl', { savedConfig: { apiKey: 'x' }, stream: false });
        expect('stream' in plain.config).toBe(false);
    });

    it('leaves streaming alone when nothing asked for it to change', () => {
        const resolved = resolveService('deepl', { savedConfig: { stream: true } });
        expect(resolved.config.stream).toBe(true);
    });

    it('applies a preset to a service that reads a prompt, and not to one that does not', () => {
        const withPrompt = resolveService('openai', {
            savedConfig: { promptList: [{ role: 'system', content: 'original' }] },
            preset: 'polish',
        });
        expect(withPrompt.config.promptList[0].content).not.toBe('original');

        const noPrompt = resolveService('deepl', { savedConfig: { type: 'free' }, preset: 'polish' });
        expect(noPrompt.config).toEqual({ type: 'free' });
    });

    it('survives an instance that has never been configured', () => {
        const resolved = resolveService('deepl', {});
        expect(resolved.serviceName).toBe('deepl');
        expect(resolved.config).toBeUndefined();
    });
});
