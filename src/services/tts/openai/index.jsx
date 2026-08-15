import { fetch, Body, ResponseType } from '../../../utils/http';

export const DEFAULT_REQUEST_PATH = 'api.openai.com';
export const DEFAULT_MODEL = 'tts-1';
export const VOICE_OPTIONS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Accepts a bare host, a base URL, or a full endpoint, so the same service can
// point at OpenAI or at any of the compatible servers that host the same route
// under a different prefix.
export function buildSpeechUrl(requestPath) {
    let path = requestPath;
    if (path === undefined || path.length === 0) {
        path = DEFAULT_REQUEST_PATH;
    }
    if (!/https?:\/\/.+/.test(path)) {
        path = `https://${path}`;
    }
    const url = new URL(path);
    if (!url.pathname.endsWith('/audio/speech')) {
        url.pathname += url.pathname.endsWith('/') ? '' : '/';
        url.pathname += 'v1/audio/speech';
    }
    return url.href;
}

export async function tts(text, lang, options = {}) {
    const { config } = options;
    const {
        requestPath = DEFAULT_REQUEST_PATH,
        apiKey = '',
        model = DEFAULT_MODEL,
        voice = 'alloy',
        speed = 1,
    } = config ?? {};

    const res = await fetch(buildSpeechUrl(requestPath), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        // Binary, because the successful response is the audio file itself.
        responseType: ResponseType.Binary,
        body: Body.json({
            model,
            input: text,
            voice,
            speed: Number(speed),
            response_format: 'mp3',
        }),
    });

    if (res.ok) {
        return res.data;
    }
    // The error body is JSON even though a binary response was requested, so it
    // arrives here as a byte array and has to be turned back into text.
    let detail = '';
    try {
        detail = new TextDecoder().decode(new Uint8Array(res.data));
    } catch {
        detail = JSON.stringify(res.data);
    }
    throw `Http Request Error\nHttp Status: ${res.status}\n${detail}`;
}

export * from './Config';
export * from './info';
