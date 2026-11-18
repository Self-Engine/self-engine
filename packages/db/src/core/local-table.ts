/** A Local Table is marked by exactly this prefix, in lower case: it never syncs (D287). */
export function isLocalTable(name: string): boolean {
  return name.startsWith("local_");
}
