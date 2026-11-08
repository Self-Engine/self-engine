/** The body of a CSS rule: `name:value;` for each entry, in order. */
export function cssDeclarations(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}:${value};`)
    .join("");
}
