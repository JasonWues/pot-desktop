import Database from '@tauri-apps/plugin-sql';
import { md5, toHex } from './crypto';

import type { GlossaryInput, GlossaryRow, ServiceConfig } from '../types/services';

/** A row of the history table, as `SELECT *` returns it. */
export interface HistoryRow {
    id: number;
    text: string;
    source: string;
    target: string;
    service: string;
    result: string;
    timestamp: number;
}

// Single shared handle. The schema used to be created from the error path of the
// first failed INSERT, which meant nothing could rely on a table existing (and
// `clearData` dropping the history table left the app in that state on purpose).
// Everything that touches sqlite now goes through `getDatabase`, so the tables
// and their indexes are guaranteed before the first query.
let databasePromise: Promise<Database> | null = null;

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
    // The history page always orders by recency and pages with OFFSET. The
    // ordering is `timestamp DESC, id DESC`, so the tiebreak goes in the index
    // too and the whole ORDER BY is satisfied by walking it.
    //
    // Renamed rather than redefined: `CREATE INDEX IF NOT EXISTS` does nothing
    // at all when an index of that name already exists, whatever columns it has,
    // so an existing install would have silently kept the timestamp-only one.
    `DROP INDEX IF EXISTS idx_history_timestamp`,
    `CREATE INDEX IF NOT EXISTS idx_history_recent ON history(timestamp DESC, id DESC)`,
    // The two filter dropdowns are built from `SELECT DISTINCT service` and
    // `SELECT DISTINCT target`, and the dropdowns then filter on those same two
    // columns. Both were a full scan of the table plus a sort.
    //
    // The recency columns are carried along rather than indexing the filter
    // column alone, because a filtered page orders by them: on `history(service)`
    // sqlite finds the matching rows by index and then sorts every one of them
    // in a temp B-tree to take twenty. With the ordering in the index the whole
    // query is one covering search, and `SELECT DISTINCT service` still scans it
    // as a covering index -- service is the leading column either way.
    `CREATE INDEX IF NOT EXISTS idx_history_service ON history(service, timestamp DESC, id DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_history_target ON history(target, timestamp DESC, id DESC)`,
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

export async function getDatabase(): Promise<Database> {
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

export async function addToHistory(
    text: string,
    source: string,
    target: string,
    service: string,
    result: string
): Promise<void> {
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
export interface CacheKeyParts {
    instanceKey: string;
    config?: ServiceConfig;
    from: string;
    to: string;
    detect?: string;
    text: string;
    /** `glossarySignature(...)`; absent or empty when the user keeps no terms. */
    glossary?: string;
}

export function buildCacheKey({ instanceKey, config, from, to, detect, text, glossary }: CacheKeyParts): string {
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

export async function getCachedTranslation(key: string, ttlDays: number): Promise<string | null> {
    const db = await getDatabase();
    const oldest = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
    const rows = await db.select<Array<{ result: string }>>(
        'SELECT result FROM cache WHERE key = $1 AND timestamp > $2',
        [key, oldest]
    );
    return rows.length > 0 ? rows[0].result : null;
}

export async function setCachedTranslation(key: string, result: string): Promise<void> {
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

export async function getCacheCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM cache');
    return rows[0]?.count ?? 0;
}

export async function clearCache(): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM cache');
}

// Ordered by id so the rows arrive the same way every time. `glossarySignature`
// hashes them into the cache key, and an unstable order would change that key
// without anything having changed.
export async function listGlossary(): Promise<GlossaryRow[]> {
    const db = await getDatabase();
    return db.select<GlossaryRow[]>('SELECT * FROM glossary ORDER BY id');
}

/// The entries that apply to one translation. 'all' is the wildcard on either
/// side, so a term can be scoped to a single direction, to everything going into
/// one language, or to everything.
///
/// `from` should be the language actually being translated out of: with the
/// source set to auto that is the detected language, not the literal 'auto',
/// which no user would think to scope a term to.
export async function getActiveGlossary(from?: string, to?: string): Promise<GlossaryRow[]> {
    const db = await getDatabase();
    return db.select<GlossaryRow[]>(
        `SELECT * FROM glossary
         WHERE enabled = 1
           AND (from_lang = 'all' OR from_lang = $1)
           AND (to_lang = 'all' OR to_lang = $2)
         ORDER BY id`,
        [from ?? 'all', to ?? 'all']
    );
}

export async function addGlossaryEntry({
    term,
    replacement,
    fromLang = 'all',
    toLang = 'all',
    enabled = true,
}: GlossaryInput): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `INSERT INTO glossary (term, replacement, from_lang, to_lang, enabled, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [term, replacement, fromLang, toLang, enabled ? 1 : 0, Date.now()]
    );
}

export async function updateGlossaryEntry(
    id: number,
    { term, replacement, fromLang, toLang, enabled }: GlossaryInput
): Promise<void> {
    const db = await getDatabase();
    await db.execute(
        `UPDATE glossary SET term = $1, replacement = $2, from_lang = $3, to_lang = $4, enabled = $5 WHERE id = $6`,
        [term, replacement, fromLang, toLang, enabled ? 1 : 0, id]
    );
}

export async function deleteGlossaryEntry(id: number): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM glossary WHERE id = $1', [id]);
}
