import { describe, expect, it } from 'vitest';

import { base64ToBytes, base64ToUtf8, hmacSha1, hmacSha256, md5, sha256, toBase64, toHex } from './crypto';

// Five translate and OCR providers -- baidu, tencent, volcengine, alibaba,
// iflytek -- sign their requests with these four functions, and a wrong digest
// comes back as "authentication failed", which reads exactly like a bad API
// key. Nothing short of a known vector distinguishes the two, so the vectors
// here are the published ones (RFC 1321, FIPS 180-4, RFC 2202, RFC 4231)
// rather than values this implementation produced.

const repeatByte = (byte, times) => new Uint8Array(times).fill(byte);

describe('md5', () => {
    it('matches RFC 1321', () => {
        expect(toHex(md5(''))).toBe('d41d8cd98f00b204e9800998ecf8427e');
        expect(toHex(md5('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72');
        expect(toHex(md5('message digest'))).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    });

    // crypto-js encoded a string argument as UTF-8 without being asked and
    // noble throws on a string, so `toBytes` does it instead. Encoding it as
    // anything else -- latin1, UTF-16 -- still produces a digest, just the
    // wrong one, and only a non-ASCII input can tell.
    it('encodes a string argument as UTF-8', () => {
        expect(toHex(md5('中文'))).toBe('a7bac2239fcdcb3a067903d8077c4a07');
    });
});

describe('sha256', () => {
    it('matches FIPS 180-4', () => {
        expect(toHex(sha256('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(toHex(sha256(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('encodes a string argument as UTF-8', () => {
        expect(toHex(sha256('中文'))).toBe('72726d8818f693066ceb69afa364218b692e62ea92b385782363780f47529c21');
    });
});

// These two are the reason this file exists. `CryptoJS.HmacSHA256` took the
// MESSAGE first; these take the KEY first. A mechanical rename at a call site
// signs the key with the message and returns a digest that looks entirely
// plausible -- the vectors below are what makes the swap visible.
describe('hmacSha256', () => {
    it('matches RFC 4231 test case 1', () => {
        const digest = hmacSha256(repeatByte(0x0b, 20), 'Hi There');
        expect(toHex(digest)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
    });

    it('matches RFC 4231 test case 2', () => {
        const digest = hmacSha256('Jefe', 'what do ya want for nothing?');
        expect(toHex(digest)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    });

    it('takes the key first, not the message', () => {
        const asDocumented = toHex(hmacSha256('Jefe', 'what do ya want for nothing?'));
        const swapped = toHex(hmacSha256('what do ya want for nothing?', 'Jefe'));
        expect(asDocumented).not.toBe(swapped);
        expect(asDocumented).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    });
});

describe('hmacSha1', () => {
    it('matches RFC 2202 test case 1', () => {
        const digest = hmacSha1(repeatByte(0x0b, 20), 'Hi There');
        expect(toHex(digest)).toBe('b617318655057264e28bc0b6fb378c8ef146be00');
    });

    it('matches RFC 2202 test case 2', () => {
        expect(toHex(hmacSha1('Jefe', 'what do ya want for nothing?'))).toBe(
            'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79'
        );
    });
});

// A digest is bytes, and the providers want it as one of these two.
describe('encodings', () => {
    it('round-trips base64', () => {
        const bytes = md5('abc');
        expect(base64ToBytes(toBase64(bytes))).toEqual(bytes);
    });

    it('base64-encodes a digest rather than its hex spelling', () => {
        expect(toBase64(md5('abc'))).toBe('kAFQmDzST7DWlj99KOF/cg==');
    });

    it('decodes base64 back to UTF-8 text', () => {
        expect(base64ToUtf8(toBase64(new TextEncoder().encode('中文')))).toBe('中文');
    });
});
