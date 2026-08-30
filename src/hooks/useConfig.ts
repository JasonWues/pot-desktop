import { useCallback, useEffect } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store } from '../utils/store';
import { debounce } from '../utils';

/**
 * `.` and `@` are legal in a config key -- `translate.service@abc123` -- and
 * neither is legal in a Tauri event name. One function so the emit side and the
 * listen side cannot drift; they used to be the same expression written twice.
 */
function eventNameFor(key: string): string {
    return `${key.replaceAll('.', '_').replaceAll('@', ':')}_changed`;
}

type Subscriber = (value: unknown) => void;

interface KeyRegistration {
    /** Every mounted `useConfig` for this key. */
    subscribers: Set<Subscriber>;
    /** The single `<key>_changed` listener shared by all of them. */
    unlisten: Promise<UnlistenFn> | null;
    /** The single initial store read, shared. */
    initial: Promise<unknown> | null;
    /** True once `initial` resolved; kept current by the listener afterwards. */
    loaded: boolean;
    value: unknown;
}

/**
 * One entry per config key per window.
 *
 * Before this, every `useConfig` call site did its own `store.get` and installed
 * its own event listener -- and there are 108 of them. That is not merely
 * wasteful: `TargetArea` is rendered once per configured translate service and
 * calls `useConfig` nine times, and those nine keys (`translate_auto_copy`,
 * `history_disable`, the cache settings) are window-global rather than
 * per-service. So the same value was read and subscribed N times over, and a
 * single settings change woke N components to be told the same thing.
 *
 * The per-component state is deliberately still per-component: the shared part
 * is the read and the listener, not the value React renders from. That keeps the
 * observable behaviour identical to what the call sites had.
 */
const registry = new Map<string, KeyRegistration>();

function registrationFor(key: string): KeyRegistration {
    let registration = registry.get(key);
    if (!registration) {
        registration = { subscribers: new Set(), unlisten: null, initial: null, loaded: false, value: null };
        registry.set(key, registration);
    }
    return registration;
}

/**
 * The value for `key`, reading the store at most once per key.
 *
 * `defaultValue` seeds a key the store does not have yet, so the first mount for
 * a key decides the default. Nothing in the tree passes two different defaults
 * for one key, and it was already first-mount-wins before this cache existed --
 * the write just happened N times instead of once.
 */
function readValue(key: string, defaultValue: unknown): Promise<unknown> {
    const registration = registrationFor(key);
    if (registration.loaded) {
        return Promise.resolve(registration.value);
    }
    if (registration.initial === null) {
        registration.initial = (async () => {
            const stored = await store.get(key);
            // Tauri 2's store resolves to `undefined` for a missing key, v1 gave `null`
            if (stored === null || stored === undefined) {
                await store.set(key, defaultValue);
                await store.save();
                return defaultValue;
            }
            return stored;
        })().then((value) => {
            registration.loaded = true;
            registration.value = value;
            return value;
        });
    }
    return registration.initial;
}

function subscribe(key: string, receive: Subscriber): () => void {
    const registration = registrationFor(key);
    registration.subscribers.add(receive);

    if (registration.unlisten === null) {
        registration.unlisten = listen(eventNameFor(key), (event) => {
            registration.loaded = true;
            registration.value = event.payload;
            // A copy, so a subscriber that unmounts inside its own callback does
            // not mutate the set being iterated.
            for (const subscriber of [...registration.subscribers]) {
                subscriber(event.payload);
            }
        });
    }

    return () => {
        registration.subscribers.delete(receive);
        if (registration.subscribers.size > 0) {
            return;
        }
        // Last one out drops the listener and the cached value, so a key whose
        // components have all unmounted cannot serve a stale value to the next
        // mount -- and the registry cannot grow without bound.
        const pending = registration.unlisten;
        registration.unlisten = null;
        registry.delete(key);
        pending?.then((stop) => stop()).catch(() => {});
    };
}

/**
 * The one way to read and write the config store from React.
 *
 * Returns the v1-shaped triple the 100-odd call sites destructure. `T | null` on
 * the first element is not pedantry: the store is read asynchronously, so every
 * consumer genuinely sees `null` on the first render before the value or the
 * default arrives.
 */
export const useConfig = <T,>(
    key: string,
    defaultValue: T,
    options: { sync?: boolean } = {}
): [T | null, (v: T, forceSync?: boolean) => void, () => T | null] => {
    const [property, setPropertyState, getProperty] = useGetState<T | null>(null);
    const { sync = true } = options;

    // 同步到Store (State -> Store)
    const syncToStore = useCallback(
        debounce((v: T) => {
            store.set(key, v);
            store.save();
            emit(eventNameFor(key), v);
        }),
        []
    );

    const setProperty = useCallback((v: T, forceSync = false) => {
        setPropertyState(v);
        const isSync = forceSync || sync;
        isSync && syncToStore(v);
    }, []);

    // 初始化
    useEffect(() => {
        // The read resolves after this effect's cleanup may already have run, so
        // the flag is what keeps it from setting state on an unmounted component.
        let alive = true;
        const unsubscribe = subscribe(key, (value) => {
            if (alive) {
                setPropertyState(value as T);
            }
        });
        readValue(key, defaultValue).then((value) => {
            if (alive) {
                setPropertyState(value as T);
            }
        });
        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);

    return [property, setProperty, getProperty];
};

/**
 * The guard here used to be `if (store.has(key))`, and `has` returns a promise:
 * a promise is always truthy, so the condition was dead and the two calls below
 * ran unconditionally. Harmless -- deleting an absent key is a no-op -- but it
 * meant the check the code appeared to be making was not being made. The type
 * checker is what found it.
 *
 * All four call sites drop the result, so awaiting inside is a behaviour change
 * only in that the writes now actually happen in order.
 */
export const deleteKey = async (key: string) => {
    // The cached value has to go with it, or a `useConfig` mounting after this
    // would be handed the value of a key that no longer exists.
    registry.delete(key);
    if (await store.has(key)) {
        await store.delete(key);
        await store.save();
    }
};
