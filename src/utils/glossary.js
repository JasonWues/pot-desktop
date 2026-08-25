import { supportsPrompt } from './ai_presets';

// Terms the user wants rendered a particular way, applied to a translation two
// different ways depending on what the service can be told.
//
// An LLM service reads a `promptList`, so the terms go in as an instruction and
// the model applies them while it translates -- which is the only way "render
// `bug` as 缺陷" can work, since by the time a finished translation exists the
// word is already gone. That is the same trick `ai_presets` plays, and it is
// safe for the same reason: the modified config is a copy, and the cache key is
// derived from the config actually used.
//
// The other seventeen translate services take a language pair and have nowhere
// to put an instruction, so there the terms are applied to the result instead.
// That reaches the case that actually dominates a glossary -- proper nouns and
// jargon a machine engine passes through untranslated, which the user wants
// spelled their way -- and it cannot damage anything: a term the engine did
// translate simply is not found, and the translation is returned unchanged.
// Pre-substituting a sentinel would cover the rest, but a sentinel an engine
// drops or mangles takes the user's words with it, and losing text is worse
// than not rewriting it.

/// A message is `{ role, content }` for OpenAI, Ollama and ChatGLM and
/// `{ role, parts: [{ text }] }` for Gemini. Reading the shape off the message
/// rather than off a service name means a fourth spelling, or a service moving
/// between them, needs nothing here.
function messageText(message) {
    return Array.isArray(message?.parts) ? (message.parts[0]?.text ?? '') : (message?.content ?? '');
}

function withMessageText(message, text) {
    return Array.isArray(message?.parts) ? { ...message, parts: [{ text }] } : { ...message, content: text };
}

/// Terms with an empty `term` are dropped: they would compile to an empty
/// alternation branch, which matches at every position.
function usableEntries(entries) {
    return (entries ?? []).filter((entry) => typeof entry?.term === 'string' && entry.term !== '');
}

export function glossaryInstruction(entries) {
    const lines = usableEntries(entries).map((entry) => `- "${entry.term}" -> "${entry.replacement ?? ''}"`);
    return `Always translate the following terms exactly as given, whatever the surrounding context:\n${lines.join('\n')}`;
}

/// Appended to the first message rather than to the one carrying `$text`: the
/// first is the priming turn under every schema Gloss ships -- a system message
/// for OpenAI and Ollama, an opening user turn for ChatGLM and Gemini -- and an
/// instruction sitting next to the text to translate reads like part of it.
export function applyGlossaryToConfig(instanceConfig, serviceName, entries) {
    const usable = usableEntries(entries);
    if (usable.length === 0 || !supportsPrompt(serviceName)) {
        return instanceConfig;
    }
    const promptList = instanceConfig?.promptList;
    if (!Array.isArray(promptList) || promptList.length === 0) {
        return instanceConfig;
    }

    const next = [...promptList];
    next[0] = withMessageText(next[0], `${messageText(next[0])}\n\n${glossaryInstruction(usable)}`.trim());
    return { ...instanceConfig, promptList: next };
}

/// `\b` only where the term's own edge is an ASCII word character. JS word
/// boundaries are ASCII, so asking for one around a CJK term would demand a
/// boundary that never occurs -- while a Latin term without one matches inside
/// other words, and a glossary entry for "AI" would rewrite the middle of
/// "SAID".
function termPattern(term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = /^\w/.test(term) ? '\\b' : '';
    const tail = /\w$/.test(term) ? '\\b' : '';
    return `${head}${escaped}${tail}`;
}

/// Longest term first, so "New York City" wins over "New York", and everything
/// in one pass over one alternation rather than a replace per term: a
/// replacement that happens to contain another term must not then be rewritten
/// itself.
export function applyGlossaryToResult(text, entries) {
    const usable = usableEntries(entries);
    if (usable.length === 0 || typeof text !== 'string' || text === '') {
        return text;
    }

    const sorted = [...usable].sort((a, b) => b.term.length - a.term.length);
    const replacements = new Map(sorted.map((entry) => [entry.term, entry.replacement ?? '']));
    const pattern = new RegExp(sorted.map((entry) => termPattern(entry.term)).join('|'), 'g');

    // A term that matched is its own key; `??` covers nothing, but keeps a
    // surprising regex from deleting text.
    return text.replace(pattern, (match) => replacements.get(match) ?? match);
}

/// What the cache key hashes. Only the pair matters -- which entries were in
/// force and what they said -- so toggling an unrelated term's scope does not
/// throw away every cached translation.
export function glossarySignature(entries) {
    const usable = usableEntries(entries);
    if (usable.length === 0) {
        return '';
    }
    return JSON.stringify(usable.map((entry) => [entry.term, entry.replacement ?? '']));
}
