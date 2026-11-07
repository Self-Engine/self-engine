/** Internal: not in `exports`, so no other package can import it. */
export function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}
