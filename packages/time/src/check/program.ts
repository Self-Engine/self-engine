import { failedCases } from "./cases.ts";
import { fixedCases } from "./fixed-cases.ts";
import { compareWithIntl } from "./intl-comparison.ts";
import { zoneNameCases } from "./zone-names.ts";

/** Runtime-neutral proof, shared by Electron's Node and page, and later web and mobile. */
export function checkRuntime() {
  const cases = [...fixedCases, ...zoneNameCases];
  const failures = failedCases(cases);
  const { transitions, comparisons, mismatches } = compareWithIntl();
  failures.push(...mismatches);
  return { cases: cases.length, transitions, comparisons, failures };
}
