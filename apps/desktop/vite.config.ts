import { defineConfig } from "vite-plus";
import { type Channel, parseChannel } from "./src/channel.ts";

function isElectron(id: string): boolean {
  return id === "electron" || id.startsWith("electron/");
}

function bundle(entry: string, clean: boolean, channel: Channel) {
  return {
    entry: [entry],
    format: "cjs" as const,
    outDir: "dist-electron",
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
    deps: { neverBundle: isElectron },
  };
}

export function packEntries(channel: Channel) {
  return [bundle("src/main.ts", true, channel), bundle("src/preload.ts", false, channel)];
}

export default defineConfig({
  pack: packEntries(parseChannel(process.env.SELF_ENGINE_CHANNEL)),
});
