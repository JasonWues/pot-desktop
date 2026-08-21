import { describe, expect, it } from 'vitest';

import { applyGlossaryToConfig, applyGlossaryToResult, glossaryInstruction, glossarySignature } from './glossary';

const entry = (term, replacement) => ({ term, replacement });

describe('applyGlossaryToResult', () => {
    it('rewrites a term and leaves the rest alone', () => {
        expect(applyGlossaryToResult('Tauri 很好用', [entry('Tauri', '踏浪')])).toBe('踏浪 很好用');
    });

    it('does not match inside another word', () => {
        // The whole reason termPattern exists: without a boundary this rewrites
        // the middle of SAID.
        expect(applyGlossaryToResult('SAID AI', [entry('AI', '人工智能')])).toBe('SAID 人工智能');
    });

    it('still matches a CJK term, which has no word boundary to ask for', () => {
        expect(applyGlossaryToResult('这个缺陷很严重', [entry('缺陷', 'bug')])).toBe('这个bug很严重');
    });

    it('prefers the longest term', () => {
        const entries = [entry('New York', '纽约'), entry('New York City', '纽约市')];
        expect(applyGlossaryToResult('New York City', entries)).toBe('纽约市');
    });

    it('does not rewrite its own output', () => {
        // 'foo' -> 'bar baz' must not then have its 'bar' rewritten to 'qux'.
        const entries = [entry('foo', 'bar baz'), entry('bar', 'qux')];
        expect(applyGlossaryToResult('foo', entries)).toBe('bar baz');
    });

    it('escapes regex metacharacters in the term', () => {
        expect(applyGlossaryToResult('a C++ program', [entry('C++', 'C 加加')])).toBe('a C 加加 program');
    });

    it('passes anything that is not a non-empty string straight through', () => {
        const entries = [entry('a', 'b')];
        expect(applyGlossaryToResult('', entries)).toBe('');
        // Dictionary services resolve with an object, not text.
        const dictionary = { word: 'a' };
        expect(applyGlossaryToResult(dictionary, entries)).toBe(dictionary);
    });

    it('ignores an entry with an empty term rather than matching everywhere', () => {
        expect(applyGlossaryToResult('unchanged', [entry('', 'X')])).toBe('unchanged');
    });
});

describe('applyGlossaryToConfig', () => {
    const entries = [entry('bug', '缺陷')];

    it('appends the instruction to an OpenAI-shaped first message', () => {
        const config = {
            promptList: [
                { role: 'system', content: 'You are a translation engine.' },
                { role: 'user', content: '$text' },
            ],
        };
        const applied = applyGlossaryToConfig(config, 'openai', entries);

        expect(applied.promptList[0].content).toContain('You are a translation engine.');
        expect(applied.promptList[0].content).toContain('"bug" -> "缺陷"');
        // The turn carrying the text is untouched, and so is the saved config.
        expect(applied.promptList[1]).toEqual({ role: 'user', content: '$text' });
        expect(config.promptList[0].content).toBe('You are a translation engine.');
    });

    it('understands Gemini’s parts array', () => {
        const config = { promptList: [{ role: 'user', parts: [{ text: 'Prime.' }] }] };
        const applied = applyGlossaryToConfig(config, 'geminipro', entries);

        expect(applied.promptList[0].parts[0].text).toContain('Prime.');
        expect(applied.promptList[0].parts[0].text).toContain('"bug" -> "缺陷"');
        expect(applied.promptList[0].role).toBe('user');
    });

    it('leaves a service that reads no prompt exactly as it was', () => {
        const config = { apiKey: 'x' };
        expect(applyGlossaryToConfig(config, 'deepl', entries)).toBe(config);
    });

    it('leaves the config alone when there is nothing to say', () => {
        const config = { promptList: [{ role: 'system', content: 'x' }] };
        expect(applyGlossaryToConfig(config, 'openai', [])).toBe(config);
    });

    it('does not invent a promptList for an instance saved without one', () => {
        const config = { model: 'x' };
        expect(applyGlossaryToConfig(config, 'openai', entries)).toBe(config);
    });
});

describe('glossarySignature', () => {
    it('is empty when no term is in force, so existing cache keys do not move', () => {
        expect(glossarySignature([])).toBe('');
        expect(glossarySignature(undefined)).toBe('');
    });

    it('changes when a replacement changes', () => {
        expect(glossarySignature([entry('a', 'b')])).not.toBe(glossarySignature([entry('a', 'c')]));
    });

    it('ignores the columns a translation cannot see', () => {
        const scoped = [{ term: 'a', replacement: 'b', from_lang: 'en', to_lang: 'zh_cn', id: 7, enabled: 1 }];
        expect(glossarySignature(scoped)).toBe(glossarySignature([entry('a', 'b')]));
    });
});

describe('glossaryInstruction', () => {
    it('lists every term as a quoted pair', () => {
        const text = glossaryInstruction([entry('bug', '缺陷'), entry('Tauri', 'Tauri')]);
        expect(text).toContain('- "bug" -> "缺陷"');
        expect(text).toContain('- "Tauri" -> "Tauri"');
    });
});
