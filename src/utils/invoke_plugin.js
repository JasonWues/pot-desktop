// @ts-check
import { appCacheDir, appConfigDir, join } from "@tauri-apps/api/path";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
// The last crypto-js in the app, and the reason it is still a dependency at all.
// It is handed to every `.potext` plugin below, so it is a published API and not
// this repo's to withdraw -- the same reasoning that keeps the Tauri 1 shapes in
// `http.js` and `env.js`. The app's own signing code uses `utils/crypto.js`.
// `crypto-js` ships no type declarations and is published API for third-party
// plugins, so it is not this repository's to replace. The app's own hashing goes
// through `utils/crypto.js`.
// @ts-ignore
import CryptoJS from "crypto-js";
import { http } from "./http";
import { osType } from "./env";

/**
 * @param {string} pluginType
 * @param {string} pluginName
 */
export async function invoke_plugin(pluginType, pluginName) {
    let configDir = await appConfigDir();
    let cacheDir = await appCacheDir();
    let pluginDir = await join(configDir, "plugins", pluginType, pluginName);
    let entryFile = await join(pluginDir, "main.js");
    let script = await readTextFile(entryFile);
    /**
     * @param {string} cmdName
     * @param {unknown} args
     */
    async function run(cmdName, args) {
        return await invoke("run_binary", {
            pluginType,
            pluginName,
            cmdName,
            args
        });
    }
    const utils = {
        tauriFetch: http.fetch,
        http,
        // Plugins are written against the Tauri 1 name, `readFile` is its v2 equivalent
        readBinaryFile: readFile,
        readTextFile,
        Database,
        CryptoJS,
        run,
        cacheDir, // String
        pluginDir, // String
        osType,// "Windows_NT", "Darwin", "Linux"
    }
    return [eval(`${script} ${pluginType}`), utils];
}