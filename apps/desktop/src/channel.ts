// What separates the channels from each other (ADR 0007). Only development and production
// exist so far; the channel identity adds nightly (issue #7).

/** Each channel has its own scheme. */
export function desktopScheme(isDevelopment: boolean): string {
  return isDevelopment ? "self-engine-dev" : "self-engine";
}

/**
 * The folder under the OS app-data directory. Always set explicitly: Electron's default in
 * development is the package name, `@self-engine/desktop`, which is the live data folder of
 * the installed old Self-Engine app.
 */
export function desktopDataFolder(isDevelopment: boolean): string {
  return isDevelopment ? "Self-Engine Dev" : "Self-Engine";
}
