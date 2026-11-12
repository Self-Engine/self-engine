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
 * Collects targets of successful writes affecting at least one row. RETURNING rows supply
 * a missing affected-row count; without RETURNING a missing count is treated as a write.
 * Zero affected rows add nothing;
 * the frame suppresses announcements for an empty set. Query ids correlate trees/results.
 */
export function recordTableWrites(tables: Set<string>, readOnly = false): KyselyPlugin {
  const pending = new WeakMap<QueryId, { tables: readonly string[]; returning: boolean }>();
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
      if (tables.length > 0)
        pending.set(queryId, {
          tables,
          returning: "returning" in node && node.returning !== undefined,
        });
      return node;
    },
    async transformResult({ result, queryId }) {
      const write = pending.get(queryId);
      const affected =
        result.numAffectedRows ?? (write?.returning ? BigInt(result.rows.length) : undefined);
      if (affected === undefined || affected > 0n)
        for (const table of write?.tables ?? []) tables.add(table);
      pending.delete(queryId);
      return result;
    },
  };
}
