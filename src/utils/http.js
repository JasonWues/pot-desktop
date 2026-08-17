// Tauri 1 style `fetch`/`Body` implemented on top of the Tauri 2 http plugin.
//
// Tauri 2 replaced `@tauri-apps/api/http` with a spec compliant `fetch`, but the
// translate/recognize services (and every third party `.potext` plugin, which
// receives these through `invoke_plugin`) are written against the Tauri 1 shape:
// `res.ok` / `res.status` / `res.data`, `Body.json|text|form` and `responseType`.
// Keeping that shape here means the services stay untouched.
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export const ResponseType = {
    JSON: 1,
    Text: 2,
    Binary: 3,
};

export class Body {
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }

    static form(data) {
        return new Body('Form', data);
    }

    static json(data) {
        return new Body('Json', data);
    }

    static text(value) {
        return new Body('Text', value);
    }

    static bytes(bytes) {
        return new Body('Bytes', bytes);
    }
}

const BODY_TYPES = ['Json', 'Text', 'Bytes', 'Form'];

// Tauri 1 handed the body to Rust as a tagged enum, so a bare `{ type, payload }`
// object was indistinguishable from a `Body` instance -- and several services,
// plus any third party plugin written the same way, pass exactly that. The
// standard `Request` has no such notion: it stringifies an unrecognised object,
// so the request goes out with a literal "[object Object]" as its body. Anything
// carrying a known `type` and a `payload` is therefore normalised back into a
// `Body` before it is serialized.
function asBody(value) {
    if (value instanceof Body) {
        return value;
    }
    if (
        value !== null &&
        typeof value === 'object' &&
        typeof value.type === 'string' &&
        BODY_TYPES.includes(value.type) &&
        'payload' in value
    ) {
        return new Body(value.type, value.payload);
    }
    return null;
}

function isFilePart(value) {
    return value !== null && typeof value === 'object' && 'file' in value;
}

function toBlobPart(file) {
    if (file instanceof Blob) {
        return file;
    }
    if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
        return file;
    }
    if (Array.isArray(file)) {
        return new Uint8Array(file);
    }
    // Tauri 1 also accepted a path string here, which the Rust side read from disk.
    // Nothing in pot uses that, so the string is sent as-is.
    return file;
}

function buildFormData(data) {
    const form = new FormData();
    for (const [name, value] of Object.entries(data)) {
        if (isFilePart(value)) {
            const part = toBlobPart(value.file);
            const blob = typeof part === 'string' ? part : new Blob([part], { type: value.mime ?? '' });
            if (typeof blob === 'string') {
                form.append(name, blob);
            } else {
                form.append(name, blob, value.fileName ?? name);
            }
        } else {
            form.append(name, value === null || value === undefined ? '' : String(value));
        }
    }
    return form;
}

function buildUrlEncoded(data) {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(data)) {
        params.append(name, value === null || value === undefined ? '' : String(value));
    }
    return params;
}

function findHeader(headers, name) {
    const lower = name.toLowerCase();
    return Object.keys(headers).find((key) => key.toLowerCase() === lower);
}

// Turns the Tauri 1 `Body` into something the standard `Request` understands.
// `headers` is mutated when the browser has to own the `Content-Type` (multipart
// needs to append its generated boundary).
function serializeBody(rawBody, headers) {
    const body = asBody(rawBody);
    if (body === null) {
        return rawBody;
    }
    switch (body.type) {
        case 'Json': {
            if (!findHeader(headers, 'Content-Type')) {
                headers['Content-Type'] = 'application/json';
            }
            return JSON.stringify(body.payload);
        }
        case 'Text':
            return body.payload;
        case 'Bytes':
            return body.payload instanceof Uint8Array ? body.payload : new Uint8Array(body.payload);
        case 'Form': {
            const contentTypeKey = findHeader(headers, 'Content-Type');
            const contentType = contentTypeKey ? String(headers[contentTypeKey]).toLowerCase() : '';
            const hasFilePart = Object.values(body.payload).some(isFilePart);
            if (contentType.includes('multipart/form-data') || hasFilePart) {
                // The declared content type carries no boundary, so drop it and let
                // the Request implementation emit one.
                if (contentTypeKey) {
                    delete headers[contentTypeKey];
                }
                return buildFormData(body.payload);
            }
            return buildUrlEncoded(body.payload);
        }
        default:
            return body.payload;
    }
}

async function readData(response, responseType) {
    switch (responseType) {
        case ResponseType.Text:
            return await response.text();
        case ResponseType.Binary:
            // Tauri 1 handed back a plain number array; callers spread it or wrap it
            // in `new Uint8Array(...)`.
            return Array.from(new Uint8Array(await response.arrayBuffer()));
        case ResponseType.JSON:
        default: {
            // Mirrors Tauri 1, which read the body as text and parsed it itself:
            // an empty successful body became `{}` and an unparseable *error*
            // body stayed a string so callers could put it in their message.
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                if (!response.ok) {
                    return text;
                }
                if (text === '') {
                    return {};
                }
                throw Error(
                    `Failed to parse response \`${text}\` as JSON: ${e}; try setting the \`responseType\` option to \`ResponseType.Text\` or \`ResponseType.Binary\` if the API does not return a JSON response.`
                );
            }
        }
    }
}

export async function fetch(url, options = {}) {
    const { method = 'GET', headers, query, body, responseType, ...rest } = options ?? {};

    let requestUrl = url;
    if (query) {
        // Tauri 1 accepted a `query` record, the standard fetch does not.
        const parsed = new URL(url);
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) {
                continue;
            }
            parsed.searchParams.append(key, String(value));
        }
        requestUrl = parsed.toString();
    }

    const requestHeaders = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
        if (value === undefined || value === null) {
            continue;
        }
        requestHeaders[key] = String(value);
    }

    const requestBody = serializeBody(body, requestHeaders);

    const response = await tauriFetch(requestUrl, {
        ...rest,
        method,
        headers: requestHeaders,
        body: requestBody,
    });

    const responseHeaders = {};
    const rawHeaders = {};
    response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
        rawHeaders[key] = [value];
    });

    return {
        url: response.url,
        status: response.status,
        ok: response.ok,
        headers: responseHeaders,
        rawHeaders,
        data: await readData(response, responseType),
    };
}

// `invoke_plugin` used to hand `@tauri-apps/api`'s `http` namespace to plugins.
export const http = { fetch, Body, ResponseType };
