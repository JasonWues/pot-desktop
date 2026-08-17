// See the note in ../openai/index.jsx: the streaming branch needs the body as a
// stream, which the v1 shim cannot give it, and a webview `window.fetch` is a
// real browser request subject to CORS. Google does send permissive CORS headers
// today, so this one was not broken -- but it only worked at Google's discretion,
// and the plugin's fetch is issued from Rust where the question does not arise.
import { fetch as streamingFetch } from '@tauri-apps/plugin-http';
import { fetch, Body } from '../../../utils/http';
import { Language } from './info';

export async function translate(text, from, to, options = {}) {
    const { config, setResult, detect } = options;

    let { apiKey, stream, promptList, requestPath } = config;
    if (!requestPath) {
        requestPath = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro';
    }
    if (!/https?:\/\/.+/.test(requestPath)) {
        requestPath = `https://${requestPath}`;
    }
    if (requestPath.endsWith('/')) {
        requestPath = requestPath.slice(0, -1);
    }
    requestPath = stream
        ? `${requestPath}:streamGenerateContent?key=${apiKey}`
        : `${requestPath}:generateContent?key=${apiKey}`;

    promptList = promptList.map((item) => {
        return {
            ...item,
            parts: [
                {
                    text: item.parts[0].text
                        .replaceAll('$text', text)
                        .replaceAll('$from', from)
                        .replaceAll('$to', to)
                        .replaceAll('$detect', Language[detect]),
                },
            ],
        };
    });

    const headers = {
        'Content-Type': 'application/json',
    };
    let body = {
        contents: promptList,
        safetySettings: [
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
            },
        ],
    };

    if (stream) {
        const res = await streamingFetch(requestPath, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });
        if (res.ok) {
            let target = '';
            const reader = res.body.getReader();
            try {
                let temp = '';
                // One decoder for the whole stream, in streaming mode: a chunk
                // boundary can fall inside a multi byte character, and decoding
                // each chunk on its own turns that character into U+FFFD in the
                // accumulated result, not just in the partial being shown.
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setResult(target.trim());
                        return target.trim();
                    }
                    const str = temp + decoder.decode(value, { stream: true }).replaceAll(/\s+/g, ' ');
                    const matchs = str.match(/{ \"text\": \".*\" } ],/);
                    if (matchs) {
                        for (let match of matchs) {
                            let result = JSON.parse(match.slice(0, -2));
                            if (result.text) {
                                target += result.text;
                                if (setResult) {
                                    setResult(target + '_');
                                } else {
                                    return '[STREAM]';
                                }
                            }
                        }
                        temp = '';
                    } else {
                        temp += str;
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } else {
            // A standard `Response` has no `.data`; the body has to be read.
            throw `Http Request Error\nHttp Status: ${res.status}\n${await res.text()}`;
        }
    } else {
        let res = await fetch(requestPath, {
            method: 'POST',
            headers: headers,
            body: Body.json(body),
        });

        if (res.ok) {
            let result = res.data;
            const { candidates } = result;
            if (candidates) {
                let target = candidates[0].content.parts[0].text.trim();
                if (target) {
                    if (target.startsWith('"')) {
                        target = target.slice(1);
                    }
                    if (target.endsWith('"')) {
                        target = target.slice(0, -1);
                    }
                    return target.trim();
                } else {
                    throw JSON.stringify(candidates);
                }
            } else {
                throw JSON.stringify(result);
            }
        } else {
            throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
        }
    }
}

export * from './Config';
export * from './info';
