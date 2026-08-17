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
export function buildCacheKey({ instanceKey, config, from, to, detect, text }) {
    // Still MD5, and still hex. This is a cache key, not a security boundary --
    // but changing either would change every key, so every user's existing cache
    // would miss once and be rebuilt for no benefit.
    const parts = [instanceKey, JSON.stringify(config ?? {}), from, to, detect ?? '', text];
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
