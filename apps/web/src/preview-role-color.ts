// A CSS color for the throwaway /theme-preview page. #23 removes it.

import { type FinalColors, roleVariable } from "@self-engine/theme";

export function roleColor(role: keyof FinalColors): string {
  return `var(${roleVariable(role)})`;
}
