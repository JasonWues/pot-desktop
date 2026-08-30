// @ts-check
import { type, arch as archFn, version } from '@tauri-apps/plugin-os';
import { getVersion } from '@tauri-apps/api/app';

export let osType = '';
export let arch = '';
export let osVersion = '';
export let appVersion = '';

// Tauri 2 reports 'linux' | 'macos' | 'windows' and is synchronous. The UI, the
// `public/logo/*.svg` assets and every `.potext` plugin expect the Tauri 1 names.
const OS_TYPE_MAP = {
    linux: 'Linux',
    macos: 'Darwin',
    windows: 'Windows_NT',
};

export async function initEnv() {
    const osTypeV2 = type();
    // `type()` is typed as a union of the three platform strings plus the mobile
    // ones, and the map only carries the three desktop keys -- which is the point:
    // anything else falls through to the v2 name unchanged.
    osType = /** @type {Record<string, string>} */ (OS_TYPE_MAP)[osTypeV2] ?? osTypeV2;
    arch = archFn();
    osVersion = version();
    appVersion = await getVersion();
}
