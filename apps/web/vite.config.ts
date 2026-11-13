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
    startupBundle({
      // Baseline 839,270 raw JS bytes (#136); measured plus 6 %, rounded up to whole KiB (D258).
      maxBytes: 869 * 1024,
      lazyOnly: [
        {
          // What `import … from "zod"` loads: 85 KB at startup, 35 KB more than the parts that
          // `zod/mini` needs (#136).
          name: "Zod's full build",
          path: "/node_modules/zod/v4/classic/",
          instead:
            'declare a schema that startup code reads, such as a Setting\'s, with "zod/mini".',
        },
      ],
    }),
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
