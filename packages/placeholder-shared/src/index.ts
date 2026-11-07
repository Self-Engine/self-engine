/**
 * Placeholder shared package for the boundary rules (.dependency-cruiser.ts):
 * `@self-engine/placeholder-module` may import it, not the other way round, and
 * `./internal.ts` stays private because `exports` lists only this file.
 */
import { padTwo } from "./internal.ts";

export function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${padTwo(minutes % 60)}`;
}
