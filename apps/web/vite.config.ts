import { linguiPlugin } from "@self-engine/i18n/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { startupBundle } from "./startup-bundle.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 5733);

export default defineConfig({
  plugins: [
    // Baseline: 792,058 raw JS bytes; 832 KiB leaves about 7.5% headroom.
    startupBundle(832 * 1024),
    linguiPlugin(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    host,
    port,
    strictPort: true,
    // Electron loads the page from its custom protocol, where the HMR client cannot derive
    // the dev server from the page's own origin.
    hmr: { protocol: "ws", host, port },
  },
});
