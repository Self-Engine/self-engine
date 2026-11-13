import noTimeOutsideTime from "./rules/no-time-outside-time.ts";
import noForeignRowMap from "./rules/no-foreign-row-map.ts";
/**
 * The repo's own lint rules, loaded by Oxlint as a JS plugin (`lint.jsPlugins` in
 * vite.config.ts). Rules are reported as `self-engine/<rule>`.
 */

import { definePlugin } from "@oxlint/plugins";
import noGlobalTMacro from "./rules/no-global-t-macro.ts";
import noImportTypeQuery from "./rules/no-import-type-query.ts";
import noRawStorageSql from "./rules/no-raw-storage-sql.ts";
import noQueryOrThrow from "./rules/no-query-or-throw.ts";
import noSilentCatch from "./rules/no-silent-catch.ts";

export default definePlugin({
  meta: { name: "self-engine" },
  rules: {
    "no-time-outside-time": noTimeOutsideTime,
    "no-global-t-macro": noGlobalTMacro,
    "no-foreign-row-map": noForeignRowMap,
    "no-import-type-query": noImportTypeQuery,
    "no-query-or-throw": noQueryOrThrow,
    "no-raw-storage-sql": noRawStorageSql,
    "no-silent-catch": noSilentCatch,
  },
});
