import { invoke } from '@tauri-apps/api/core';

// The catalogue is ~170KB and cannot change while the app runs, so it is fetched
// once per session and shared with the settings page.
let voiceListCache = null;

export async function getVoiceList() {
    if (voiceListCache === null) {
        voiceListCache = await invoke('edge_tts_voices');
    }
    return voiceListCache;
}

function normalizeTag(tag) {
    return (tag ?? '').toLowerCase().replaceAll('_', '-');
}

// Exact locale first, then the primary subtag, so `en-GB` still serves `en-US`
// if the exact region is missing.
export function matchVoice(voiceList, langTag) {
    const target = normalizeTag(langTag);
    const prefix = target.split('-')[0];
    return (
        voiceList.find((v) => normalizeTag(v.Locale) === target) ??
        voiceList.find((v) => normalizeTag(v.Locale).split('-')[0] === prefix) ??
        null
    );
}

// The Rust side returns base64 rather than a byte array: the IPC layer would
// otherwise serialize the MP3 as a JSON array of numbers, several times its size.
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// SSML wants a signed percentage; the settings page stores a plain number.
function signed(value, unit) {
    const n = Number(value) || 0;
    return `${n >= 0 ? '+' : ''}${n}${unit}`;
}

export async function tts(text, lang, options = {}) {
    const { config } = options;
    const { voice = {}, rate = 0, pitch = 0, volume = 0 } = config ?? {};

    let selectedVoice = voice[lang] ?? '';
    if (selectedVoice === '') {
        const matched = matchVoice(await getVoiceList(), lang);
        if (matched === null) {
            throw `No Edge TTS voice available for ${lang}`;
        }
        selectedVoice = matched.ShortName;
    }

    const base64 = await invoke('edge_tts', {
        text,
        voice: selectedVoice,
        rate: signed(rate, '%'),
        pitch: signed(pitch, 'Hz'),
        volume: signed(volume, '%'),
    });
    return base64ToBytes(base64);
}

export * from './Config';
export * from './info';
