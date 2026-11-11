interface AuditedRow {
  readonly id: string;
  readonly view: string;
  readonly settings: readonly string[];
}

/** What is wrong with a list of Settings Rows for these Views; empty when it is sound. */
export function auditSettingsRows(
  rows: readonly AuditedRow[],
  views: readonly { readonly id: string }[],
  /** The keys of the Settings that a row has to serve. */
  servedSettings: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const viewIds = new Set(views.map((view) => view.id));
  const viewsWithRows = new Set<string>();
  const served = new Set(rows.flatMap((row) => row.settings));
  for (const { id, view } of rows) {
    if (ids.has(id)) problems.push(`Duplicate Settings Row id: ${id}`);
    ids.add(id);
    if (viewIds.has(view)) viewsWithRows.add(view);
    else problems.push(`Settings Row ${id} belongs to the unknown View ${view}`);
  }
  for (const id of viewIds) {
    if (!viewsWithRows.has(id)) problems.push(`View ${id} has no Settings Row`);
  }
  for (const key of servedSettings) {
    if (!served.has(key)) problems.push(`Setting ${key} is served by no Settings Row`);
  }
  return problems;
}
