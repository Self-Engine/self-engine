import { resolve } from "node:path";
import { defineConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";
import app from "../lingui.config.ts";

/**
 * The app's config plus a catalog that exists only for tests, so that tests compile their
 * fixtures with the same plugin as the app and do not depend on app text.
 */
export default defineConfig({
  ...app,
  catalogs: [
    ...(app.catalogs ?? []),
    {
      path: resolve(import.meta.dirname, "fixtures/{locale}"),
      include: [resolve(import.meta.dirname, "fixtures")],
    },
    {
      path: resolve(import.meta.dirname, "fixtures-broken/{locale}"),
      include: [resolve(import.meta.dirname, "fixtures-broken")],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
