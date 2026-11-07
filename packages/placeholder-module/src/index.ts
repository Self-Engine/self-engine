/**
 * Placeholder module for the boundary rules (.dependency-cruiser.ts): it imports
 * `@self-engine/placeholder-shared`, the allowed direction. Delete both placeholders once
 * two real packages show an allowed import.
 */
import { formatMinutes } from "@self-engine/placeholder-shared";

export function describeDuration(minutes: number): string {
  return `Tracked ${formatMinutes(minutes)}`;
}
