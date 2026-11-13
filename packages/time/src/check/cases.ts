/**
 * Shared material for the tests and for the check program in Electron's runtime (#246). Nothing
 * here imports the test runner: a case states a computation and its written-out result.
 */
export interface CheckCase {
  readonly name: string;
  readonly actual: () => unknown;
  readonly expected: unknown;
}

/** What a computation yields, with a thrown error reduced to its class name. */
export function outcome(compute: () => unknown): unknown {
  try {
    return compute();
  } catch (error) {
    return { thrown: error instanceof Error ? error.name : typeof error };
  }
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1)))
      : inner,
  );
}

/** One line per case whose outcome differs from its expected result. */
export function failedCases(cases: readonly CheckCase[]): string[] {
  return cases.flatMap(({ name, actual, expected }) => {
    const got = canonical(outcome(actual));
    const want = canonical(expected);
    return got === want ? [] : [`${name}: expected ${want}, got ${got}`];
  });
}
