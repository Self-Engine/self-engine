import { defineConfig } from "vite-plus";
import type { Rolldown } from "vite-plus/pack";
import { appIcon } from "./src/app-icon.ts";
import { type Channel, bundleDirectory, parseChannel } from "./src/channel.ts";
import { rawText } from "./src/raw-text-plugin.ts";

function isElectron(id: string): boolean {
  return id === "electron" || id.startsWith("electron/");
}

// The SQLite driver loads a native binary, which a bundle cannot carry: the data process
// requires it from the app's node_modules, where `dependencies` in package.json puts it.
function isNativeModule(id: string): boolean {
  return id === "better-sqlite3";
}

function isExternal(id: string): boolean {
  return isElectron(id) || isNativeModule(id);
}

function bundle(
  entry: string,
  clean: boolean,
  channel: Channel,
  extraPlugins: readonly Rolldown.Plugin[] = [],
) {
  return {
    entry: [entry],
    format: "cjs" as const,
    outDir: bundleDirectory(channel),
    outExtensions: () => ({ js: ".cjs" }),
    dts: false,
    sourcemap: true,
    clean,
    // Read by src/build-channel.ts: the channel is part of the bundle, not of its environment.
    define: { __SELF_ENGINE_CHANNEL__: JSON.stringify(channel) },
    // A sandboxed preload is one file that can require only `electron`.
    outputOptions: { codeSplitting: false },
    // `electron` is a devDependency, which tsdown would bundle: without this the npm launcher
    // package (child_process, install.js) ends up in the preload and breaks it at run time.
    deps: { neverBundle: isExternal },
    // A module's SQL migrations reach the data process as text (D139).
    plugins: [rawText(), ...extraPlugins],
  };
}

export function packEntries(channel: Channel) {
  return [
    // The main bundle cleans the folder, so the icon is written with it.
    bundle("src/main.ts", true, channel, [appIcon(channel)]),
    bundle("src/preload.ts", false, channel),
    bundle("src/data-process.ts", false, channel),
  ];
}

export default defineConfig({
  pack: packEntries(parseChannel(process.env.SELF_ENGINE_CHANNEL)),
});
