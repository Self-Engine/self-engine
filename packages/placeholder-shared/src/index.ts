/**
 * Placeholder shared package, imported by `@self-engine/placeholder-module` (see there for
 * why both exist and when they go). `./internal.ts` stays private because `exports` lists
 * only this file.
 */
import { padTwo } from "./internal.ts";

export function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${padTwo(minutes % 60)}`;
}
