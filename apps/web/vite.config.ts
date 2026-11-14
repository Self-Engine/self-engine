import { linguiPlugin } from "@self-engine/i18n/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { startupBundle } from "./startup-bundle.ts";
import { STARTUP_RULES } from "./startup-rules.ts";
import { STORY_MODULES_ENV, storyModuleList } from "./story-module-list.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 5733);

export default defineConfig({
  plugins: [
    startupBundle(STARTUP_RULES),
    // `pnpm renders` measures the placeholder modules in the dev server (scripts/measure-renders.ts).
    storyModuleList(process.env[STORY_MODULES_ENV] === "1"),
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
