import { ReferenceNode, TableNode, type KyselyPlugin, type OperationNode } from "kysely";

function collect(node: unknown, tables: Set<string>) {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, tables);
    return;
  }
  const operation = node as OperationNode;
  if (TableNode.is(operation)) {
    tables.add(operation.table.identifier.name);
    return;
  }
  // `alias.column` and `alias.*` name a source already listed in FROM or JOIN, often by alias.
  if (ReferenceNode.is(operation)) return;
  for (const child of Object.values(node)) collect(child, tables);
}

/**
 * Collects every table name a query's SQL takes rows from: FROM, JOIN and subqueries,
 * including those built by a released read piece. Aliases and CTE names are collected too;
 * the kit keeps only names of real tables. It sees the SQL that ran, not other branches of
 * the code that built it. Only the contract kit installs it; the frame never does.
 */
export function recordTableReads(tables: Set<string>): KyselyPlugin {
  return {
    transformQuery({ node }) {
      collect(node, tables);
      return node;
    },
    transformResult({ result }) {
      return Promise.resolve(result);
    },
  };
}
