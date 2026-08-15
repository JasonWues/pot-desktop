import { invoke } from '@tauri-apps/api/core';

// The installed voices cannot change while the app runs, and the macOS/Linux
// backends shell out to list them, so the list is fetched once per session.
let voiceListCache = null;

export async function getVoiceList() {
    if (voiceListCache === null) {
        voiceListCache = await invoke('system_tts_voices');
    }
    return voiceListCache;
}

function normalizeTag(tag) {
    return (tag ?? '').toLowerCase().replaceAll('_', '-');
}

// Exact locale first ('en-US' === 'en_US' after normalising), then the primary
// subtag so a bare 'en' voice still serves 'en-US'.
export function matchVoice(voiceList, langTag) {
    const target = normalizeTag(langTag);
    const prefix = target.split('-')[0];
    return (
        voiceList.find((v) => normalizeTag(v.language) === target) ??
        voiceList.find((v) => normalizeTag(v.language).split('-')[0] === prefix) ??
        null
    );
}

// The Rust side returns base64 rather than a byte array: the IPC layer would
// otherwise serialize the WAV as a JSON array of numbers, several times its size.
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function tts(text, lang, options = {}) {
    const { config } = options;
    const { rate = 1, voice = {} } = config ?? {};

    // An empty name lets the OS use its default voice, which is the right
    // behaviour when nothing matches the requested language either.
    let selectedVoice = voice[lang] ?? '';
    if (selectedVoice === '') {
        const matched = matchVoice(await getVoiceList(), lang);
        selectedVoice = matched === null ? '' : matched.name;
    }

    const base64 = await invoke('system_tts', {
        text,
        voice: selectedVoice,
        rate: Number(rate),
    });
    return base64ToBytes(base64);
}

export * from './Config';
export * from './info';
