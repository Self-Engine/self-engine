/**
 * The repo's own lint rules, loaded by Oxlint as a JS plugin (`lint.jsPlugins` in
 * vite.config.ts). Rules are reported as `self-engine/<rule>`.
 */

import { definePlugin } from "@oxlint/plugins";
import noImportTypeQuery from "./rules/no-import-type-query.ts";
import noSilentCatch from "./rules/no-silent-catch.ts";

export default definePlugin({
  meta: { name: "self-engine" },
  rules: {
    "no-import-type-query": noImportTypeQuery,
    "no-silent-catch": noSilentCatch,
  },
});
