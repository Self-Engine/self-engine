import type { StartupRules } from "./startup-bundle.ts";

/** What the startup check of the web app holds the production build to (D258, D269, D293). */
export const STARTUP_RULES = {
  // Baseline 839,270 raw JS bytes (#136); measured plus 6 %, rounded up to whole KiB (D258).
  maxBytes: 869 * 1024,
  lazyOnly: [
    {
      // What `import … from "zod"` loads: 85 KB at startup, 35 KB more than the parts that
      // `zod/mini` needs (#136).
      name: "Zod's full build",
      path: "/node_modules/zod/v4/classic/",
      instead: 'declare a schema that startup code reads, such as a Setting\'s, with "zod/mini".',
    },
    {
      // 107 icons, each carrying all six Phosphor weights: 343,907 bytes (88,198 gzipped) with
      // the mark, against 46,650 left below the limit (#260).
      name: "The directory of entry pictures",
      path: "/packages/icons/src/directory/",
      instead:
        "draw an entry's icon with the mark of @self-engine/ui/entry-mark only in a View that loads on demand.",
    },
  ],
} as const satisfies StartupRules;
