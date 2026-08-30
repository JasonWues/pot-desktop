import { describe, expect, it } from 'vitest';

import { buildCacheKey } from './db';

// The key format is frozen on purpose. It is not a security boundary, but every
// user's cache is addressed by it: change the separator, the field order, the
// hash or how the config is serialised and every existing entry misses once and
// is rebuilt. That is a decision to make deliberately, so the expected digests
// here are literals -- if a change is intended, updating them is the moment to
// notice the cost.

const base = {
    instanceKey: 'deepl',
    config: { type: 'free' },
    from: 'auto',
    to: 'zh_cn',
    detect: 'en',
    text: 'hello',
};

describe('buildCacheKey', () => {
    it('is stable for the same inputs', () => {
        expect(buildCacheKey(base)).toBe(buildCacheKey({ ...base }));
        // Independently: md5 of the six fields joined by NUL, hex. Derived from
        // the documented format rather than copied out of a run, so it fails if
        // the format changes even where the implementation agrees with itself.
        expect(buildCacheKey(base)).toBe('15f71a192335443049414143e8ef224e');
    });

    it('changes when the service config changes', () => {
        // The whole point of folding the config in: editing a prompt, a model or
        // an endpoint has to miss the cache rather than replay a result the new
        // settings would not have produced.
        expect(buildCacheKey({ ...base, config: { type: 'api' } })).not.toBe(buildCacheKey(base));
    });

    it('changes with every other field', () => {
        const keys = [
            buildCacheKey(base),
            buildCacheKey({ ...base, instanceKey: 'deepl@abc' }),
            buildCacheKey({ ...base, from: 'en' }),
            buildCacheKey({ ...base, to: 'zh_tw' }),
            buildCacheKey({ ...base, detect: 'ja' }),
            buildCacheKey({ ...base, text: 'hello ' }),
        ];
        expect(new Set(keys).size).toBe(keys.length);
    });

    // The separator is NUL rather than a space because the text being translated
    // can contain a space: without it, a shift of the boundary between two
    // fields would collide.
    it('does not collide when a field boundary shifts', () => {
        const a = buildCacheKey({ ...base, from: 'a', to: 'b c' });
        const b = buildCacheKey({ ...base, from: 'a b', to: 'c' });
        expect(a).not.toBe(b);
    });

    it('treats a missing config and a missing detect as empty rather than undefined', () => {
        expect(buildCacheKey({ ...base, config: undefined })).toBe(buildCacheKey({ ...base, config: {} }));
        expect(buildCacheKey({ ...base, detect: undefined })).toBe(buildCacheKey({ ...base, detect: '' }));
    });
});
