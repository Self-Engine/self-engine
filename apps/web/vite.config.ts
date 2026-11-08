import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 5733);

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
  server: {
    host,
    port,
    strictPort: true,
    // Electron loads the page from its custom protocol, where the HMR client cannot derive
    // the dev server from the page's own origin.
    hmr: { protocol: "ws", host, port },
  },
});
