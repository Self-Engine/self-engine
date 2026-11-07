import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const external = (id: string) =>
  id === "electron" || id.startsWith("electron/") || id === "better-sqlite3";

export default defineConfig({
  // Renderer (vp dev / vp build)
  root: "renderer",
  base: "./",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: "../dist-renderer", emptyOutDir: true },
  // Main + preload (vp pack -> tsdown), CJS like t3code
  pack: [
    {
      entry: ["src/main.ts"],
      format: "cjs",
      outDir: "dist-electron",
      outExtensions: () => ({ js: ".cjs" }),
      dts: false,
      sourcemap: true,
      clean: true,
      deps: {
        alwaysBundle: (id) => !id.startsWith("node:") && !external(id),
        neverBundle: external,
        onlyBundle: false,
      },
    },
    {
      entry: ["src/preload.ts"],
      format: "cjs",
      outDir: "dist-electron",
      outExtensions: () => ({ js: ".cjs" }),
      dts: false,
      sourcemap: true,
      clean: false,
      // electron is a devDependency, so tsdown would bundle the npm "electron" launcher package.
      deps: { neverBundle: external },
    },
  ],
});
