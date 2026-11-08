import { defineConfig } from "vite-plus";

function isElectron(id: string): boolean {
  return id === "electron" || id.startsWith("electron/");
}

function bundle(entry: string, clean: boolean) {
  return {
    entry: [entry],
    format: "cjs" as const,
    outDir: "dist-electron",
    outExtensions: () => ({ js: ".cjs" }),
    dts: false,
    sourcemap: true,
    clean,
    // A sandboxed preload is one file that can require only `electron`.
    outputOptions: { codeSplitting: false },
    // `electron` is a devDependency, which tsdown would bundle: without this the npm launcher
    // package (child_process, install.js) ends up in the preload and breaks it at run time.
    deps: { neverBundle: isElectron },
  };
}

export const packEntries = [bundle("src/main.ts", true), bundle("src/preload.ts", false)];

export default defineConfig({ pack: packEntries });
