import { beforeEach, describe, expect, it, vi } from 'vitest';

// The plugin's fetch is the only thing this module talks to, so it is replaced
// with a recorder: every assertion below is either about what came out of it
// (the request the services actually make) or what went back in (the Tauri 1
// response shape).
const tauriFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: (...args: unknown[]) => tauriFetch(...args) }));

const { Body, ResponseType, fetch, http } = await import('./http');

// This file pins a published API. `invoke_plugin` hands `http` to every third
// party `.potext` plugin, so the shape here is not an internal convenience --
// changing it breaks plugins that this repository cannot see or update.

const respondWith = (bodyText: BodyInit | null, init: ResponseInit = {}) => {
    tauriFetch.mockResolvedValue(new Response(bodyText, { status: 200, ...init }));
};

const lastRequest = () => ({ url: tauriFetch.mock.calls[0][0], options: tauriFetch.mock.calls[0][1] });

beforeEach(() => {
    tauriFetch.mockReset();
    respondWith('{}');
});

describe('the response it hands back', () => {
    it('has the Tauri 1 shape', async () => {
        tauriFetch.mockResolvedValue(
            new Response('{"hello":"world"}', {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await fetch('https://example.com/api');

        expect(res.ok).toBe(true);
        expect(res.status).toBe(201);
        expect(res.data).toEqual({ hello: 'world' });
        expect(res.headers['content-type']).toBe('application/json');
        // Tauri 1 gave every header value as an array here.
        expect(res.rawHeaders['content-type']).toEqual(['application/json']);
    });

    it('reports a failed status through `ok` rather than throwing', async () => {
        respondWith('{"error":"nope"}', { status: 401 });

        const res = await fetch('https://example.com/api');

        expect(res.ok).toBe(false);
        expect(res.status).toBe(401);
    });
});

describe('responseType', () => {
    it('parses JSON by default', async () => {
        respondWith('{"a":1}');
        expect((await fetch('https://example.com')).data).toEqual({ a: 1 });
    });

    it('returns text as a string', async () => {
        respondWith('not json at all');
        const res = await fetch('https://example.com', { responseType: ResponseType.Text });
        expect(res.data).toBe('not json at all');
    });

    // Tauri 1 handed binary back as a plain number array, and callers either
    // spread it or wrap it in `new Uint8Array(...)`.
    it('returns binary as a number array, not a Uint8Array', async () => {
        respondWith(new Uint8Array([1, 2, 255]));
        const res = await fetch('https://example.com', { responseType: ResponseType.Binary });
        expect(res.data).toEqual([1, 2, 255]);
        expect(Array.isArray(res.data)).toBe(true);
    });

    it('turns an empty successful body into an empty object', async () => {
        respondWith('');
        expect((await fetch('https://example.com')).data).toEqual({});
    });

    // So a caller can put the provider's plain-text error in its message.
    it('leaves an unparseable error body as a string', async () => {
        respondWith('Internal Server Error', { status: 500 });
        const res = await fetch('https://example.com');
        expect(res.data).toBe('Internal Server Error');
    });

    it('throws on an unparseable successful body', async () => {
        respondWith('<html>nope</html>');
        await expect(fetch('https://example.com')).rejects.toThrow(/as JSON/);
    });
});

describe('query', () => {
    it('appends a record to the url, which the standard fetch will not do', async () => {
        await fetch('https://example.com/path?existing=1', { query: { a: 'x', b: 2 } });
        const { url } = lastRequest();
        expect(url).toContain('existing=1');
        expect(url).toContain('a=x');
        expect(url).toContain('b=2');
    });

    it('skips null and undefined entries', async () => {
        await fetch('https://example.com/', { query: { a: null, b: undefined, c: 'kept' } });
        const { url } = lastRequest();
        expect(url).not.toContain('a=');
        expect(url).not.toContain('b=');
        expect(url).toContain('c=kept');
    });
});

describe('Body', () => {
    it('serializes Body.json and sets the content type', async () => {
        await fetch('https://example.com', { method: 'POST', body: Body.json({ a: 1 }) });
        const { options } = lastRequest();
        expect(options.body).toBe('{"a":1}');
        expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('leaves a content type the caller set alone', async () => {
        await fetch('https://example.com', {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: Body.json({ a: 1 }),
        });
        const { options } = lastRequest();
        expect(options.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('passes Body.text through untouched', async () => {
        await fetch('https://example.com', { method: 'POST', body: Body.text('raw') });
        expect(lastRequest().options.body).toBe('raw');
    });

    it('encodes a plain Body.form as urlencoded', async () => {
        await fetch('https://example.com', { method: 'POST', body: Body.form({ a: '1', b: 2 }) });
        const { options } = lastRequest();
        expect(options.body).toBeInstanceOf(URLSearchParams);
        expect(options.body.get('a')).toBe('1');
        expect(options.body.get('b')).toBe('2');
    });

    it('encodes a form carrying a file as multipart and drops the declared content type', async () => {
        await fetch('https://example.com', {
            method: 'POST',
            headers: { 'Content-Type': 'multipart/form-data' },
            body: Body.form({ image: { file: new Uint8Array([1, 2, 3]), mime: 'image/png', fileName: 'a.png' } }),
        });
        const { options } = lastRequest();
        expect(options.body).toBeInstanceOf(FormData);
        // Dropped so the Request implementation can emit one carrying its own
        // generated boundary.
        expect(options.headers['Content-Type']).toBeUndefined();
    });

    // Tauri 1 took a tagged enum, so a bare object was indistinguishable from a
    // `Body`. Several services and any plugin written the same way pass exactly
    // that; the standard Request would stringify it to "[object Object]".
    it('accepts a bare { type, payload } object as a Body', async () => {
        await fetch('https://example.com', { method: 'POST', body: { type: 'Json', payload: { a: 1 } } });
        expect(lastRequest().options.body).toBe('{"a":1}');
    });

    it('leaves an object that is not a Body alone', async () => {
        const body = { type: 'NotABodyType', payload: 1 };
        await fetch('https://example.com', { method: 'POST', body });
        expect(lastRequest().options.body).toBe(body);
    });
});

describe('headers', () => {
    it('stringifies values and drops null and undefined', async () => {
        await fetch('https://example.com', { headers: { a: 1, b: null, c: undefined, d: 'x' } });
        const { options } = lastRequest();
        expect(options.headers).toEqual({ a: '1', d: 'x' });
    });
});

describe('the namespace handed to plugins', () => {
    it('still exports fetch, Body and ResponseType', () => {
        expect(http.fetch).toBe(fetch);
        expect(http.Body).toBe(Body);
        expect(http.ResponseType).toBe(ResponseType);
        expect(ResponseType).toEqual({ JSON: 1, Text: 2, Binary: 3 });
    });
});
