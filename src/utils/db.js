import Database from '@tauri-apps/plugin-sql';
import { md5, toHex } from './crypto';

// Single shared handle. The schema used to be created from the error path of the
// first failed INSERT, which meant nothing could rely on a table existing (and
// `clearData` dropping the history table left the app in that state on purpose).
// Everything that touches sqlite now goes through `getDatabase`, so the tables
// and their indexes are guaranteed before the first query.
let databasePromise = null;

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS history(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        service TEXT NOT NULL,
        result TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    )`,
    // The history page always orders by recency and pages with OFFSET.
    `CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC)`,
    `CREATE TABLE IF NOT EXISTS cache(
        key TEXT PRIMARY KEY,
        result TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON cache(timestamp)`,
    // Terms the user wants rendered a particular way. `from_lang`/`to_lang` hold
    // Gloss's own language codes or the string 'all', which is why they are not
    // called `from`/`to`: `from` is a reserved word in sqlite and would have to
    // be quoted at every call site.
    `CREATE TABLE IF NOT EXISTS glossary(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL,
        replacement TEXT NOT NULL,
        from_lang TEXT NOT NULL DEFAULT 'all',
        to_lang TEXT NOT NULL DEFAULT 'all',
        enabled INTEGER NOT NULL DEFAULT 1,
        timestamp INTEGER NOT NULL
    )`,
];

export async function getDatabase() {
    if (databasePromise === null) {
        databasePromise = (async () => {
            const db = await Database.load('sqlite:history.db');
            for (const statement of SCHEMA) {
                await db.execute(statement);
            }
            return db;
        })();
        // A failed init must not poison every later call.
        databasePromise.catch(() => {
            databasePromise = null;
        });
    }
    return databasePromise;
}

export async function addToHistory(text, source, target, service, result) {
    const db = await getDatabase();
    await db.execute(
        'INSERT into history (text, source, target, service, result, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
        [text, source, target, service, result, Date.now()]
    );
}

const CACHE_MAX_ENTRIES = 5000;
// Trimming on every write would mean a COUNT per translation; the table only
// has to stay near the cap, not exactly at it.
const CACHE_TRIM_INTERVAL = 50;
let writesSinceTrim = 0;

// A NUL separator rather than a space: the text being translated can contain
// anything a space can, so a space would let ['a', 'b c'] and ['a b', 'c'] hash
// to the same key. Written as an escape because a literal NUL in the source is
// invisible and makes the file read as binary to grep and friends.
const SEPARATOR = '\u0000';

// The service config is part of the key, so editing a prompt, model, or API
// endpoint misses the cache instead of replaying a result the new settings
// would not have produced.
export function buildCacheKey({ instanceKey, config, from, to, detect, text, glossary }) {
    // Still MD5, and still hex. This is a cache key, not a security boundary --
    // but changing either would change every key, so every user's existing cache
    // would miss once and be rebuilt for no benefit.
    const parts = [instanceKey, JSON.stringify(config ?? {}), from, to, detect ?? '', text];
    // Appended rather than slotted in, and only when there is a glossary at all,
    // for that same reason: a user who keeps none has every key they already had.
    // For an LLM service the glossary is in `config.promptList` too and the key
    // would move anyway; for the other seventeen this is the only thing that
    // stops an edited term replaying the result it was supposed to change.
    if (glossary) {
        parts.push(glossary);
    }
    return toHex(md5(parts.join(SEPARATOR)));
}

export async function getCachedTranslation(key, ttlDays) {
    const db = await getDatabase();
    const oldest = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
    const rows = await db.select('SELECT result FROM cache WHERE key = $1 AND timestamp > $2', [key, oldest]);
    return rows.length > 0 ? rows[0].result : null;
}

export async function setCachedTranslation(key, result) {
    const db = await getDatabase();
    await db.execute('INSERT OR REPLACE INTO cache (key, result, timestamp) VALUES ($1, $2, $3)', [
        key,
        result,
        Date.now(),
    ]);

    writesSinceTrim += 1;
    if (writesSinceTrim >= CACHE_TRIM_INTERVAL) {
        writesSinceTrim = 0;
        // `LIMIT -1 OFFSET n` is sqlite's "everything after the first n rows".
        await db.execute(
            'DELETE FROM cache WHERE key IN (SELECT key FROM cache ORDER BY timestamp DESC LIMIT -1 OFFSET $1)',
            [CACHE_MAX_ENTRIES]
        );
    }
}

export async function getCacheCount() {
    const db = await getDatabase();
    const rows = await db.select('SELECT COUNT(*) AS count FROM cache');
    return rows[0]?.count ?? 0;
}

export async function clearCache() {
    const db = await getDatabase();
    await db.execute('DELETE FROM cache');
}

// Ordered by id so the rows arrive the same way every time. `glossarySignature`
// hashes them into the cache key, and an unstable order would change that key
// without anything having changed.
export async function listGlossary() {
    const db = await getDatabase();
    return db.select('SELECT * FROM glossary ORDER BY id');
}

/// The entries that apply to one translation. 'all' is the wildcard on either
/// side, so a term can be scoped to a single direction, to everything going into
/// one language, or to everything.
///
/// `from` should be the language actually being translated out of: with the
/// source set to auto that is the detected language, not the literal 'auto',
/// which no user would think to scope a term to.
export async function getActiveGlossary(from, to) {
    const db = await getDatabase();
    return db.select(
        `SELECT * FROM glossary
         WHERE enabled = 1
           AND (from_lang = 'all' OR from_lang = $1)
           AND (to_lang = 'all' OR to_lang = $2)
         ORDER BY id`,
        [from ?? 'all', to ?? 'all']
    );
}

export async function addGlossaryEntry({ term, replacement, fromLang = 'all', toLang = 'all', enabled = true }) {
    const db = await getDatabase();
    await db.execute(
        `INSERT INTO glossary (term, replacement, from_lang, to_lang, enabled, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [term, replacement, fromLang, toLang, enabled ? 1 : 0, Date.now()]
    );
}

export async function updateGlossaryEntry(id, { term, replacement, fromLang, toLang, enabled }) {
    const db = await getDatabase();
    await db.execute(
        `UPDATE glossary SET term = $1, replacement = $2, from_lang = $3, to_lang = $4, enabled = $5 WHERE id = $6`,
        [term, replacement, fromLang, toLang, enabled ? 1 : 0, id]
    );
}

export async function deleteGlossaryEntry(id) {
    const db = await getDatabase();
    await db.execute('DELETE FROM glossary WHERE id = $1', [id]);
}
