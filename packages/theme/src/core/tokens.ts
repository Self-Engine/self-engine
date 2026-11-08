/** The token variables that are not colors. Independent of Theme and Color Mode. */
export type TokenVariables = Readonly<Record<`--se-${string}`, string>>;

/**
 * Motion durations, and the `font-variant-numeric` value for times and amounts.
 * Zero is `0ms` because a bare `0` is not a valid CSS time.
 */
export function tokenVariables({ reducedMotion }: { reducedMotion: boolean }): TokenVariables {
  return {
    "--se-motion-fast": reducedMotion ? "0ms" : "150ms",
    "--se-motion-base": reducedMotion ? "0ms" : "200ms",
    "--se-tabular-nums": "tabular-nums",
  };
}
