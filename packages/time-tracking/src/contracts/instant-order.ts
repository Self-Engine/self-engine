/**
 * The order of two Instants, for `sort`: Instants of the supported years compare as text in time
 * order.
 */
export function compareInstants(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
