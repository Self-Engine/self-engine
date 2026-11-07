import { defineRule, type ESTree, type SourceCode, type Variable } from "@oxlint/plugins";

const MESSAGE =
  "This swallows the error. Report it, rethrow it, or add a comment saying why ignoring it is safe.";

type Handler = ESTree.ArrowFunctionExpression | ESTree.Function;

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function isNode(value: unknown): value is { type: string } {
  return (
    typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string"
  );
}

/** Whether `node` throws as part of the handler (a throw in a nested function does not). */
function containsThrow(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === "ThrowStatement") return true;
  if (FUNCTION_TYPES.has(node.type)) return false;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value) ? value.some(containsThrow) : containsThrow(value)) return true;
  }
  return false;
}

/**
 * The bindings that hold the caught value: everything a catch clause declares, but only the
 * first parameter of a rejection handler. Later parameters and a named function expression's
 * own name are not the error.
 */
function caughtBindings(sourceCode: SourceCode, owner: ESTree.CatchClause | Handler): Variable[] {
  const declared = sourceCode.getDeclaredVariables(owner);
  if (owner.type === "CatchClause") return declared;
  const first = owner.params[0];
  if (first === undefined) return [];
  return declared.filter((variable) =>
    variable.defs.some(
      (def) =>
        def.type === "Parameter" && def.name.start >= first.start && def.name.end <= first.end,
    ),
  );
}

/** A handler deals with the error when it reads it, rethrows, or explains why it may drop it. */
function handlesError(
  sourceCode: SourceCode,
  owner: ESTree.CatchClause | Handler,
  body: ESTree.Node,
): boolean {
  if (caughtBindings(sourceCode, owner).some((variable) => variable.references.length > 0)) {
    return true;
  }
  if (sourceCode.getCommentsInside(body).length > 0) return true;
  return containsThrow(body);
}

/** The inline rejection handler of `.catch(handler)` or `.then(onValue, handler)`, if any. */
function rejectionHandler(node: ESTree.CallExpression): Handler | null {
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  const property = callee.property;
  if (property.type !== "Identifier") return null;
  const handler =
    property.name === "catch"
      ? node.arguments[0]
      : property.name === "then"
        ? node.arguments[1]
        : undefined;
  return handler?.type === "ArrowFunctionExpression" || handler?.type === "FunctionExpression"
    ? handler
    : null;
}

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow catch blocks and rejection handlers that drop the error." },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CatchClause(node) {
        if (!handlesError(sourceCode, node, node.body)) {
          context.report({ node, message: MESSAGE });
        }
      },
      CallExpression(node) {
        const handler = rejectionHandler(node);
        if (handler && !handlesError(sourceCode, handler, handler.body ?? handler)) {
          context.report({ node: handler, message: MESSAGE });
        }
      },
    };
  },
});
