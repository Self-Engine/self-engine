import { join } from "node:path";
import { defineConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

/**
 * The catalogs of a temp directory, for the tests of scripts/check-i18n.ts: real extraction on a
 * fixture. It lives here, not in the temp directory, because it has to resolve Lingui. `pl` is a
 * language the app does not require.
 */
const rootDir = process.env.I18N_FIXTURE_ROOT;
if (rootDir === undefined) throw new Error("I18N_FIXTURE_ROOT is not set");

export default defineConfig({
  rootDir,
  sourceLocale: "en",
  locales: ["en", "de", "pl"],
  catalogs: [
    {
      path: join(rootDir, "locales/{locale}"),
      include: [join(rootDir, "src/**/*.ts")],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
