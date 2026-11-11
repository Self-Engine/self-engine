interface AuditedSetting {
  readonly key: string;
}

interface AuditedRow {
  readonly id: string;
  readonly view: string;
  readonly settings?: readonly AuditedSetting[];
}

/**
 * What is wrong with a list of Settings Rows for these Views; empty when it is sound. Each of
 * `settings` has to be served by a row.
 */
export function auditSettingsRows(
  rows: readonly AuditedRow[],
  views: readonly { readonly id: string }[],
  settings: readonly AuditedSetting[] = [],
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const viewIds = new Set(views.map((view) => view.id));
  const viewsWithRows = new Set<string>();
  const served = new Set<string>();
  for (const { id, view, settings: ofRow = [] } of rows) {
    for (const setting of ofRow) served.add(setting.key);
    if (ids.has(id)) problems.push(`Duplicate Settings Row id: ${id}`);
    ids.add(id);
    if (viewIds.has(view)) viewsWithRows.add(view);
    else problems.push(`Settings Row ${id} belongs to the unknown View ${view}`);
  }
  for (const id of viewIds) {
    if (!viewsWithRows.has(id)) problems.push(`View ${id} has no Settings Row`);
  }
  for (const { key } of settings) {
    if (!served.has(key)) problems.push(`Setting ${key} is served by no Settings Row`);
  }
  return problems;
}
