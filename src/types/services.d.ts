// The contracts, not the components.
//
// A `.d.ts` because none of this exists at runtime: it can describe the shapes
// the 43 service modules and the dispatch already agree on without renaming a
// single file or touching a single line of the implementations. Files opt in to
// being checked against it with a `// @ts-check` docblock; everything else keeps
// compiling exactly as before.
//
// These shapes are what the four service types have *in practice*. They were
// read off the implementations rather than invented, so where the tree is
// inconsistent this file documents the inconsistency instead of hiding it --
// see `TranslateFn` below.

import type { languageList } from '../utils/language';

/**
 * Gloss's own language codes -- the keys every service's `Language` enum is
 * keyed by, and what the store holds for the source and target selection.
 *
 * Derived from `languageList` rather than written out, so a code added there is
 * a code this union gains. That is the whole reason `languageList` carries
 * `as const`.
 */
export type GlossLanguage = (typeof languageList)[number];

/** `'auto'` is accepted wherever a source language is, but is never a target. */
export type SourceLanguage = GlossLanguage | 'auto';

/**
 * A service's own language table: Gloss's codes on the left, whatever the
 * provider calls them on the right. Built-in services declare it as a
 * `Language` enum in `info.ts`; plugins declare it in `info.json`.
 *
 * The index signature is deliberately wider than `SourceLanguage`: callers hold
 * the language as a plain string out of the store, and an unknown code answering
 * `undefined` is exactly the condition `TargetArea` tests with `in` before it
 * offers a service. No provider supports all 40-odd codes.
 */
export type LanguageMap = Record<string, string | undefined>;

/**
 * One service instance's saved settings.
 *
 * Deliberately open: every service defines its own fields (api keys, endpoints,
 * model names) and they are stored as one JSON blob per instance key. Only the
 * three the dispatch itself reads are named.
 */
export interface ServiceConfig {
    /** Set by `resolveService` on plugin configs; the plugin protocol wants it. */
    enable?: string | boolean;
    /** Present only on services that can stream. `resolveService` may force it off. */
    stream?: boolean;
    /** The LLM prompt turns. Only the services in `PROMPT_SERVICES` have one. */
    promptList?: PromptMessage[];
    [key: string]: unknown;
}

/**
 * One turn of an LLM prompt. OpenAI, Ollama and ChatGLM carry the text in
 * `content`; Gemini carries it in `parts[0].text`. Every field is optional
 * because `utils/glossary` reads the shape off the message rather than off a
 * service name, so a fourth spelling needs no change there -- and because these
 * come out of the user's stored config, where nothing guarantees either field.
 */
export interface PromptMessage {
    role?: string;
    content?: string;
    parts?: Array<{ text?: string }>;
}

/** The `{ name, icon }` every `info.ts` exports. */
export interface ServiceInfo {
    name: string;
    icon: string;
}

/** What a streaming service calls as partial text arrives. */
export type SetResult = ((partial: string) => void) | null;

export interface TranslateOptions {
    config?: ServiceConfig;
    /** The detected source language, when the source is set to auto. */
    detect?: string;
    /**
     * Null means "no partial text wanted". Only safe together with
     * `stream: false` from `resolveService`: on its own, ollama, openai and
     * geminipro abort and resolve with the literal string '[STREAM]'.
     */
    setResult?: SetResult;
}

/**
 * A translate service's entry point. Resolves with plain text for almost all of
 * them and an object for the dictionary services; rejects with a **string**,
 * not an Error, which is what every call site catches and toasts.
 *
 * `options` is optional here because the tree is not consistent about it: of the
 * 21 built-in translate services, 14 declare `(text, from, to, options = {})`,
 * five take only three parameters, one takes `options` with no default, and one
 * takes `(text, _from, _to)`. `callService` always passes an object, so the
 * no-default case does not currently throw -- it is one new call site away from
 * doing so, and this signature is what makes that a compile error.
 */
export type TranslateFn = (
    text: string,
    from: string,
    to: string,
    options?: TranslateOptions
) => Promise<string | Record<string, unknown>>;

/** Recognize takes a base64 image; `_` where a service ignores it. */
export type RecognizeFn = (
    base64: string,
    language: string,
    options?: { config?: ServiceConfig }
) => Promise<string>;

/** TTS resolves with nothing useful; it plays the audio itself. */
export type TtsFn = (text: string, language: string, options?: { config?: ServiceConfig }) => Promise<unknown>;

/** Collection pushes a source/target pair into Anki, Eudic and friends. */
export type CollectionFn = (
    source: string,
    target: string,
    options?: { config?: ServiceConfig }
) => Promise<unknown>;

/** What `import * as service from '../services/translate/<name>'` gives you. */
export interface TranslateServiceModule {
    info: ServiceInfo;
    Language: LanguageMap;
    translate: TranslateFn;
}

export type ServiceType = 'translate' | 'recognize' | 'tts' | 'collection';

/**
 * A service instance key: `name@randomId`, or a bare name on instances saved
 * before the separator existed. Keys beginning with `plugin` are third-party
 * `.potext` services loaded at call time.
 */
export type ServiceInstanceKey = string;

// ---------------------------------------------------------------------------
// Glossary

/**
 * The glossary crosses three shapes, and they are not interchangeable. Naming
 * them separately is the only reason the naming boundary below is visible at
 * all -- nothing in the tree documented it before.
 */

/** A Gloss language code, or `'all'` as the wildcard on either side of a pair. */
export type GlossaryScope = GlossLanguage | 'all';

/**
 * All the pure functions in `utils/glossary` actually read. Kept minimal on
 * purpose: they are handed rows straight out of sqlite, but they must also
 * accept a bare pair, which is how every test constructs one.
 */
export interface GlossaryTerm {
    term: string;
    replacement?: string;
}

/**
 * A row as `SELECT *` returns it. **snake_case**, because `from`/`to` are
 * reserved words in sqlite and the columns had to be named around them -- and
 * `enabled` is sqlite's integer, not a boolean.
 */
export interface GlossaryRow extends GlossaryTerm {
    id: number;
    replacement: string;
    from_lang: GlossaryScope;
    to_lang: GlossaryScope;
    enabled: 0 | 1;
    timestamp: number;
}

/**
 * What `addGlossaryEntry` and `updateGlossaryEntry` take. **camelCase**, and a
 * real boolean: the mapping to the row above happens inside those two functions
 * and nowhere else.
 */
export interface GlossaryInput {
    term: string;
    replacement: string;
    fromLang?: GlossaryScope;
    toLang?: GlossaryScope;
    enabled?: boolean;
}

// ---------------------------------------------------------------------------
// The shared dispatch (`src/utils/translate_dispatch`)

export interface ResolvedService {
    instanceKey: ServiceInstanceKey;
    serviceName: string;
    isPlugin: boolean;
    config?: ServiceConfig;
    languageMap: LanguageMap;
}

export interface GlossaryResolvedService extends ResolvedService {
    /** Feeds `buildCacheKey`, so editing a term moves the key rather than replaying a stale hit. */
    glossary: string;
    /**
     * Applied to a finished translation for the services that could not take the
     * terms as a prompt instruction. A no-op for the ones that could.
     */
    applyGlossary: (value: string) => string;
}
