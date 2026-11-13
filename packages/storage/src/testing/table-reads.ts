import { ReferenceNode, TableNode, WithNode, type KyselyPlugin, type OperationNode } from "kysely";

/**
 * Collects the tables `node` takes rows from. `bound` holds the CTE names in scope: a table
 * reference by one of them reads the CTE, not a table of that name.
 */
function collect(node: unknown, tables: Set<string>, bound: ReadonlySet<string>) {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, tables, bound);
    return;
  }
  const operation = node as OperationNode;
  if (TableNode.is(operation)) {
    const name = operation.table.identifier.name;
    if (!bound.has(name)) tables.add(name);
    return;
  }
  // `alias.column` and `alias.*` name a source already listed in FROM or JOIN, often by alias.
  if (ReferenceNode.is(operation)) return;
  const { with: withNode, ...rest } = node as { with?: unknown };
  let scope = bound;
  if (withNode !== undefined && WithNode.is(withNode as OperationNode)) {
    // Each CTE sees itself (SQLite treats a CTE that names itself as recursive) and those before
    // it; the query that declares them sees all of them. Its name is a binding, not a read.
    const names = new Set(bound);
    for (const cte of (withNode as WithNode).expressions) {
      names.add(cte.name.table.table.identifier.name);
      collect(cte.expression, tables, names);
    }
    scope = names;
  }
  for (const child of Object.values(rest)) collect(child, tables, scope);
}

/**
 * Collects every table name a query's SQL takes rows from: FROM, JOIN, subqueries and CTE
 * bodies, including those built by a released read piece. A reference to a CTE is not a read of
 * a table that shares its name. Aliases are collected too; the kit keeps only names of real
 * tables. It sees the SQL that ran, not other branches of the code that built it. Only the
 * contract kit installs it; the frame never does.
 */
export function recordTableReads(tables: Set<string>): KyselyPlugin {
  return {
    transformQuery({ node }) {
      collect(node, tables, new Set());
      return node;
    },
    transformResult({ result }) {
      return Promise.resolve(result);
    },
  };
}
