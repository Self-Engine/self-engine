import { resolve } from "node:path";
import { lingui } from "@lingui/vite-plugin";

const APP_CONFIG = resolve(import.meta.dirname, "../../lingui.config.ts");

export interface LinguiPluginOptions {
  /** The Lingui config; only this package's tests name another one. */
  readonly configPath?: string;
}

/**
 * The plugin every bundle that translates needs: it compiles the Lingui macros and imports `.po`
 * catalogs as modules, and a catalog that does not compile fails the build.
 */
export function linguiPlugin({ configPath = APP_CONFIG }: LinguiPluginOptions = {}): ReturnType<
  typeof lingui
> {
  return lingui({ configPath, macroTransform: true, failOnCompileError: true });
}
