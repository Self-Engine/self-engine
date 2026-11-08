import { join } from "node:path";
import { defineConfig } from "@lingui/conf";
import app from "../lingui.config.ts";

/**
 * The app's own include and exclude patterns on a temp directory, so that a test can run real
 * extraction over them without touching the app's catalogs.
 */
const rootDir = process.env.I18N_FIXTURE_ROOT;
if (rootDir === undefined) throw new Error("I18N_FIXTURE_ROOT is not set");

export default defineConfig({
  ...app,
  rootDir,
  catalogs: (app.catalogs ?? []).map((catalog) => ({
    ...catalog,
    path: join(rootDir, "locales/{locale}"),
  })),
});
