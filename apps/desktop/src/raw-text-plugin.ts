// `vp pack` builds with Rolldown, which does not know Vite's `?raw` query: the data process
// bundle would fail on a module's migrations, which reach it through `import.meta.glob` with
// `?raw` (D139). This plugin loads such an import as its file's text, so the text is part of
// the bundle and nothing is read from disk at run time (D191).

import { readFileSync } from "node:fs";
import type { Rolldown } from "vite-plus/pack";

const RAW = "?raw";
const RAW_ID = /\?raw$/;

export function rawText(): Rolldown.Plugin {
  return {
    name: "self-engine:raw-text",
    resolveId: {
      filter: { id: RAW_ID },
      async handler(source, importer) {
        const file = await this.resolve(source.slice(0, -RAW.length), importer, { skipSelf: true });
        return file === null ? null : `${file.id}${RAW}`;
      },
    },
    load: {
      filter: { id: RAW_ID },
      handler(id) {
        const file = id.slice(0, -RAW.length);
        this.addWatchFile(file);
        return {
          code: `export default ${JSON.stringify(readFileSync(file, "utf8"))};`,
          moduleType: "js",
        };
      },
    },
  };
}
