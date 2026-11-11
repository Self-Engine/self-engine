/** Which app is running. The app reads it from its environment and hands it to the area. */
export interface VersionInfo {
  /** Absent when the app could not find out its own version; nothing is shown in its place. */
  readonly version?: string;
  /** Only the desktop app has a channel. */
  readonly channel?: "dev" | "nightly" | "stable";
  readonly operatingSystem: string;
}

/**
 * Version, channel and operating system as one line for a bug report. Not translated, so that
 * whoever reads the report sees the same words from every user, also for a version that is unknown.
 */
export function versionLine({
  version = "unknown version",
  channel,
  operatingSystem,
}: VersionInfo): string {
  const app = channel === undefined ? version : `${version} (${channel})`;
  return `Self-Engine ${app}, ${operatingSystem}`;
}
