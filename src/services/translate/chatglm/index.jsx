// The plugin's fetch, not the webview's -- this call used to resolve to
// `window.fetch` because the import was simply missing.
//
// What that broke is the proxy. Gloss's proxy setting is applied by writing
// HTTP_PROXY/HTTPS_PROXY/NO_PROXY into the process environment (`proxy.rs`),
// where reqwest picks them up, so only requests issued from Rust obey it. A
// webview fetch goes out through WebView2's own proxy instead and ignores
// whatever the user configured here.
//
// CORS is the other reason the openai service gives, and it is real but
// provider-specific -- open.bigmodel.cn does send permissive headers today, so
// this one happened to keep working. That is the provider's choice to revoke.
//
// The v1 shim in `utils/http` cannot stand in either way: it reads the body to
// build `res.data`, and the stream below needs `response.body` unread.
import { fetch as streamingFetch } from '@tauri-apps/plugin-http';
import { Language } from './info';
import { info } from '@tauri-apps/plugin-log';

const textEncoder = new TextEncoder();

function base64url(bytes) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

// ChatGLM authenticates with a JWT signed by the second half of the API key.
// Written out rather than taken from a JOSE library: this is the only JWT the
// app ever signs, and all of it is two base64url segments and one HMAC.
//
// The header is emitted exactly as passed. `sign_type` is ChatGLM's own field,
// and there is deliberately no `typ` -- which is also what the `SignJWT` this
// replaces produced, since jose serializes the protected header untouched
// rather than filling anything in.
//
// `crypto.subtle` rather than a hashing dependency: it needs a secure context,
// which the app is already relying on for `crypto.randomUUID` in the yandex
// service and in lang_detect.
async function signHs256(header, payload, secret) {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const headerPart = base64url(textEncoder.encode(JSON.stringify(header)));
    const payloadPart = base64url(textEncoder.encode(JSON.stringify(payload)));
    const signingInput = `${headerPart}.${payloadPart}`;
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(signingInput));
    return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export async function translate(text, from, to, options = {}) {
    const { config, setResult, detect } = options;

    let { model, apiKey, promptList } = config;

    let [id, secret] = apiKey.split('.');
    if (id === undefined || secret === undefined) {
        return Promise.reject('invalid apikey');
    }
    promptList = promptList.map((item) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', text)
                .replaceAll('$from', from)
                .replaceAll('$to', to)
                .replaceAll('$detect', Language[detect]),
        };
    });

    //
    let timestamp = new Date().getTime();
    let payload = {
        api_key: id,
        exp: timestamp + 1000 * 60,
        timestamp: timestamp,
    };
    let token = await signHs256({ alg: 'HS256', sign_type: 'SIGN' }, payload, secret);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token,
    };

    const body = {
        model: model,
        messages: promptList,
        stream: true,
        thinking: {
            type: "disabled",
        }
    };

    let result = '';
    try {
        const response = await streamingFetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Http Request Error\nHttp Status: ${response.status}\n${await response.text()}`);
        }

        let buffer = '';
        // Function to process the stream data
        const processChatStream = async (reader, decoder) => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Convert binary data to string
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete events
                const boundary = buffer.lastIndexOf('\n\n');
                if (boundary !== -1) {
                    const event = buffer.slice(0, boundary);
                    buffer = buffer.slice(boundary + 2);
                    const chunks = event.split('\n\n');
                    
                    for (const chunk of chunks) {
                        const text = chunk.replace(/^data:/, '').trim();
                        if (text === '[DONE]') {
                            continue;
                        }
                        const data = JSON.parse(text);
                        result += data.choices[0].delta.content;
                        if (setResult) {
                            setResult(result + '_');
                        }
                    }
                }
            }
        };

        await processChatStream(response.body.getReader(), new TextDecoder());
    } catch (error) {
        return Promise.reject(error);
    }
    
    return result;
}

export * from './Config';
export * from './info';
