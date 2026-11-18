import { defineRule, type ESTree } from "@oxlint/plugins";

const MESSAGE =
  "Write to a synced table through the frame's write paths (insert, update, softDelete, restore, archive or unarchive of sharedWrites), so its Protection Rules hold, or name an exception with its reason in no-write-outside-write-paths (D332).";

type Write = "insert" | "update" | "delete";

/** Kysely's write builders, by the kind of write each starts. */
const WRITES: ReadonlyMap<string, Write> = new Map([
  ["insertInto", "insert"],
  ["replaceInto", "insert"],
  ["updateTable", "update"],
  ["deleteFrom", "delete"],
]);

/** The frame's write paths: the one file whose builders may write a synced table. */
const WRITE_PATHS = /(?:^|\/)packages\/storage\/src\/core\/shared-entry\.ts$/;

/**
 * Tests, stories and a package's test helpers (its `src/testing/` folder) seed rows without the
 * write paths; none of them loads in the app (D255).
 */
const TEST_CODE = /(?:\.(?:test|stories)\.[cm]?[jt]sx?$)|(?:\/src\/testing\/)/;

interface Exception {
  /** The file, from the repo root. */
  readonly file: string;
  readonly table: string;
  readonly write: Write;
  readonly reason: string;
}

/** Each write to a synced table that may go around the write paths, with its reason. */
const EXCEPTIONS: readonly Exception[] = [
  {
    file: "packages/spaces/src/personal-space.ts",
    table: "spaces",
    write: "insert",
    reason:
      "The Personal Space is created before any module is mounted, and the write paths need a Space to write in (D288).",
  },
];

/** The text of a string literal or of a template without expressions; `undefined` otherwise. */
function staticString(node: ESTree.Node | undefined): string | undefined {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/**
 * The table a write builder is called with, without its alias, when the call names it as a
 * plain string; `undefined` when the code computes it.
 */
function tableOf(node: ESTree.MemberExpression): string | undefined {
  const call = node.parent;
  if (call.type !== "CallExpression" || call.callee !== node) return undefined;
  return staticString(call.arguments[0])
    ?.split(/\s+as\s+/i)[0]
    ?.trim();
}

function propertyName(node: ESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  return node.computed ? staticString(node.property) : undefined;
}

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Write synced tables only through the frame's write paths (D332)." },
    schema: [],
  },
  create(context) {
    if (WRITE_PATHS.test(context.filename) || TEST_CODE.test(context.filename)) return {};
    const exceptions = EXCEPTIONS.filter(({ file }) => context.filename.endsWith(`/${file}`));
    return {
      MemberExpression(node) {
        const name = propertyName(node);
        const write = name === undefined ? undefined : WRITES.get(name);
        if (write === undefined) return;
        const table = tableOf(node);
        // The reserved prefix of a Local Table, as the frame's types read it.
        if (table?.startsWith("local_")) return;
        if (exceptions.some((exception) => exception.table === table && exception.write === write))
          return;
        context.report({ node: node.property, message: MESSAGE });
      },
    };
  },
});
