import type { Instant } from "./instant.ts";

/** An explicitly supplied source of the current Instant. */
export type Clock = () => Instant;
