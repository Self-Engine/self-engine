import {
  AliasNode,
  FromNode,
  TableNode,
  type OperationNode,
  type KyselyPlugin,
  type QueryId,
} from "kysely";

function targets(node: OperationNode | undefined): string[] {
  if (node === undefined) return [];
  if (TableNode.is(node)) return [node.table.identifier.name];
  if (AliasNode.is(node)) return targets(node.node);
  if (FromNode.is(node)) return node.froms.flatMap(targets);
  return [];
}

export class QueryWriteError extends Error {
  constructor() {
    super("A storage query cannot write");
    this.name = "QueryWriteError";
  }
}

/**
 * Collects targets of successful writes affecting at least one row. A missing affected-row
 * count is treated as a write to avoid missed reloads. Zero affected rows add nothing;
 * the frame suppresses announcements for an empty set. Query ids correlate trees/results.
 */
export function recordTableWrites(tables: Set<string>, readOnly = false): KyselyPlugin {
  const pending = new WeakMap<QueryId, readonly string[]>();
  return {
    transformQuery({ node, queryId }) {
      if (readOnly && node.kind !== "SelectQueryNode") throw new QueryWriteError();
      const tables =
        node.kind === "InsertQueryNode"
          ? targets(node.into)
          : node.kind === "UpdateQueryNode"
            ? targets(node.table)
            : node.kind === "DeleteQueryNode"
              ? targets(node.from)
              : [];
      if (tables.length > 0) pending.set(queryId, tables);
      return node;
    },
    async transformResult({ result, queryId }) {
      if (result.numAffectedRows === undefined || result.numAffectedRows > 0n)
        for (const table of pending.get(queryId) ?? []) tables.add(table);
      pending.delete(queryId);
      return result;
    },
  };
}
