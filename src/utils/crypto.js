// @ts-check
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { md5 as nobleMd5, sha1 as nobleSha1 } from '@noble/hashes/legacy.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { hmac as nobleHmac } from '@noble/hashes/hmac.js';

// The hashing the service signatures need, on @noble/hashes instead of the
// deprecated crypto-js.
//
// crypto-js is still a dependency and is still handed to `.potext` plugins by
// `invoke_plugin`, which is a published API this cannot take away. Nothing in
// the app's own code should reach for it.
//
// Two differences from crypto-js that these wrappers absorb, because both are
// silent rather than loud if a call site gets them wrong:
//
// - crypto-js encoded a string argument as UTF-8 without being asked. noble 2
//   accepts only bytes and throws on a string, so the conversion happens here.
// - crypto-js returned a WordArray, which stringified to hex by default. noble
//   returns a Uint8Array, so the hex step is explicit -- see `toHex`.

/** @param {string | Uint8Array} input */
function toBytes(input) {
    return typeof input === 'string' ? utf8ToBytes(input) : input;
}

/** @param {string | Uint8Array} message */
export function md5(message) {
    return nobleMd5(toBytes(message));
}

/** @param {string | Uint8Array} message */
export function sha256(message) {
    return nobleSha256(toBytes(message));
}

// Argument order is key first, the way noble and every other HMAC API has it.
// `CryptoJS.HmacSHA256` took the *message* first, so a mechanical rename at the
// call sites would have signed the key with the message and still returned a
// plausible-looking digest.
/**
 * Note the argument order: the **key** comes first, where `CryptoJS.HmacSHA256`
 * took the message first. A mechanical rename at a call site would have signed
 * the key with the message and still returned a plausible digest.
 *
 * @param {string | Uint8Array} key
 * @param {string | Uint8Array} message
 */
export function hmacSha256(key, message) {
    return nobleHmac(nobleSha256, toBytes(key), toBytes(message));
}

/**
 * Key first, as in `hmacSha256`.
 * @param {string | Uint8Array} key
 * @param {string | Uint8Array} message
 */
export function hmacSha1(key, message) {
    return nobleHmac(nobleSha1, toBytes(key), toBytes(message));
}

export const toHex = bytesToHex;

// `btoa` reads its argument as one character per byte, so the bytes are widened
// into a binary string first. Built in a loop rather than with a spread, which
// passes every byte as an argument and overflows the stack on a large input --
// and one of these hashes an entire image.
/** @param {Uint8Array} bytes */
export function toBase64(bytes) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

/** @param {string} base64 */
export function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// What `CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(s))` was doing:
// base64 that decodes to UTF-8 text, which is how the iflytek services return
// recognised text. `TextDecoder` rather than a noble helper -- noble 2 dropped
// the `bytesToUtf8` that used to be in its utils.
/** @param {string} base64 */
export function base64ToUtf8(base64) {
    return new TextDecoder().decode(base64ToBytes(base64));
}
