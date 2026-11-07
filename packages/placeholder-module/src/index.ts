/**
 * Placeholder module: the one real allowed import in ALLOWED_IMPORTS (.dependency-cruiser.ts),
 * so `verify:boundaries` cruises a workspace edge, and a package whose check and tests prove
 * the workspace wiring. The boundary tests build their own fixtures and do not use it.
 * Delete both placeholders, and their ALLOWED_IMPORTS entry, once two real packages show an
 * allowed import.
 */
import { formatMinutes } from "@self-engine/placeholder-shared";

export function describeDuration(minutes: number): string {
  return `Tracked ${formatMinutes(minutes)}`;
}
