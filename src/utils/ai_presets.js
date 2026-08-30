// @ts-check
// Named prompt presets for the LLM-backed translate services.
//
// Those services already accept a `promptList`, but it lives in each instance's
// settings, so using the model for anything other than translation meant editing
// the config and editing it back. A preset swaps the prompt for one request
// instead, leaving the saved configuration untouched.
//
// The placeholders are the ones the services already substitute: $text, $from,
// $to and $detect.

// Services whose `translate()` reads `promptList`. The others take the text and
// a language pair and have nowhere to put an instruction.
export const PROMPT_SERVICES = ['openai', 'ollama', 'chatglm', 'geminipro'];

/** @param {string} serviceName */
export function supportsPrompt(serviceName) {
    return PROMPT_SERVICES.includes(serviceName);
}

// `translate` is not a preset so much as the absence of one: it means "leave the
// instance's own promptList alone", which is what every service did before this.
export const DEFAULT_PRESET = 'translate';

export const AI_PRESETS = [
    { id: 'translate', promptList: null },
    {
        id: 'polish',
        promptList: [
            {
                role: 'system',
                content:
                    'You are a professional editor. Rewrite the text the user sends so that it reads naturally and fluently, keeping its original meaning and its original language. Do not translate it. Reply with the rewritten text and nothing else.',
            },
            { role: 'user', content: '$text' },
        ],
    },
    {
        id: 'summarize',
        promptList: [
            {
                role: 'system',
                content:
                    'You summarise text. Write a concise summary, in $to, of the text the user sends. Keep it to the key points. Reply with the summary and nothing else.',
            },
            { role: 'user', content: '$text' },
        ],
    },
    {
        id: 'grammar',
        promptList: [
            {
                role: 'system',
                content:
                    'You correct writing. Fix any grammar, spelling and punctuation mistakes in the text the user sends, keeping its original language and changing as little as possible otherwise. Reply with the corrected text and nothing else.',
            },
            { role: 'user', content: '$text' },
        ],
    },
    {
        id: 'explain_code',
        promptList: [
            {
                role: 'system',
                content:
                    'You explain source code. Describe, in $to, what the code the user sends does: its purpose, then anything subtle or easy to get wrong. Be concise and do not restate the code line by line.',
            },
            { role: 'user', content: '$text' },
        ],
    },
];

/** @param {string} id */
export function getPreset(id) {
    return AI_PRESETS.find((p) => p.id === id) ?? AI_PRESETS[0];
}

/// Returns the config a service should be called with for this preset.
///
/// The result is a copy: the caller's `serviceInstanceConfigMap` entry is shared
/// with the settings UI, and the cache key is derived from whatever is passed to
/// the service, so a preset has to produce its own object or it would both
/// corrupt the saved config and collide in the cache with a plain translation.
/**
 * @param {import("../types/services").ServiceConfig | undefined} instanceConfig
 * @param {string} serviceName
 * @param {string} presetId
 */
export function applyPreset(instanceConfig, serviceName, presetId) {
    const preset = getPreset(presetId);
    if (preset.promptList === null || !supportsPrompt(serviceName)) {
        return instanceConfig;
    }
    return { ...instanceConfig, promptList: preset.promptList };
}
