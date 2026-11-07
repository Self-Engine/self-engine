// no-silent-catch: a `catch` clause, or an inline `.catch(fn)` / `.then(_, fn)` handler, must
// read the error, rethrow, or carry a comment saying why dropping it is safe.
//
// Limits, by design: the rule reads syntax, not types, so it also checks a `.catch` or `.then`
// method of an object that is no Promise. It does not follow data flow: a read in a callback
// counts even if the callback never runs (an unused one is left to `no-unused-vars`).

import { defineRule, type ESTree, type SourceCode, type Variable } from "@oxlint/plugins";

const MESSAGE =
  "This swallows the error. Report it, rethrow it, or add a comment saying why ignoring it is safe.";

type Handler = ESTree.ArrowFunctionExpression | ESTree.Function;

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string"
  );
}

function isFunction(node: ESTree.Node): boolean {
  return FUNCTION_TYPES.has(node.type);
}

/** The child nodes of `node`, in no particular order. */
function children(node: ESTree.Node): ESTree.Node[] {
  return Object.entries(node)
    .filter(([key]) => key !== "parent")
    .flatMap(([, value]: [string, unknown]) => (Array.isArray(value) ? value : [value]))
    .filter(isNode);
}

/**
 * Whether a throw in `node` can leave it: one in a nested function does not run as part of
 * the handler, and one in a `try` block with its own `catch` is caught there. A `finally` that
 * discards a throw is left to Oxlint's `no-unsafe-finally`.
 */
function canThrow(node: ESTree.Node): boolean {
  if (node.type === "ThrowStatement") return true;
  if (isFunction(node)) return false;
  return children(node).some(
    (child) =>
      !(node.type === "TryStatement" && node.handler !== null && child === node.block) &&
      canThrow(child),
  );
}

/** The outermost functions nested in `node`. */
function nestedFunctions(node: ESTree.Node): ESTree.Node[] {
  return children(node).flatMap((child) => (isFunction(child) ? [child] : nestedFunctions(child)));
}

/** Whether `owner` carries a comment of its own, not one inside a function nested in it. */
function hasOwnComment(sourceCode: SourceCode, owner: ESTree.CatchClause | Handler): boolean {
  const nested = nestedFunctions(owner);
  return sourceCode
    .getCommentsInside(owner)
    .some((comment) => !nested.some((fn) => fn.start <= comment.start && comment.end <= fn.end));
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

/**
 * A handler deals with the error when it reads it, rethrows, or explains why it may drop it.
 * Writing the binding (`error = null`, a default value) is not a read. A read inside a nested
 * function counts: handing the error to a callback (`setTimeout(() => report(error))`) is
 * handling it, and the rule does not follow whether that callback ever runs.
 */
function handlesError(
  sourceCode: SourceCode,
  owner: ESTree.CatchClause | Handler,
  body: ESTree.Node,
): boolean {
  const bindings = caughtBindings(sourceCode, owner);
  if (bindings.some((variable) => variable.references.some((ref) => ref.isRead()))) return true;
  return hasOwnComment(sourceCode, owner) || canThrow(body);
}

/** The name of a member access that is known without running it: `a.b`, `a["b"]`, `` a[`b`] ``. */
function staticMemberName(callee: ESTree.MemberExpression): string | null {
  const property = callee.property;
  if (!callee.computed) return property.type === "Identifier" ? property.name : null;
  if (property.type === "Literal" && typeof property.value === "string") return property.value;
  if (property.type === "TemplateLiteral" && property.expressions.length === 0) {
    return property.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

/**
 * The inline rejection handler of `.catch(handler)` or `.then(onValue, handler)`, if any. This
 * is syntax only: any object's `.catch` or `.then` method counts, Promise or not, since the rule
 * does not know the receiver's type.
 */
function rejectionHandler(node: ESTree.CallExpression): Handler | null {
  if (node.callee.type !== "MemberExpression") return null;
  const name = staticMemberName(node.callee);
  const handler =
    name === "catch" ? node.arguments[0] : name === "then" ? node.arguments[1] : undefined;
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
