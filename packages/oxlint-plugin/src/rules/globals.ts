// How a rule tells a global from a name the file declares: shared by the rules that restrict
// globals, such as `Temporal` outside `time` or `document` in the core of `time`.

import type { Context, ESTree, Scope } from "@oxlint/plugins";

/** The name a property key spells, when it spells one without running code. */
export function propertyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (!computed && key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

/**
 * Whether `node` names the global `name`: an identifier that no scope of the file declares, or
 * that property of `globalThis`.
 */
export function isGlobal(context: Context, node: ESTree.Node, name: string): boolean {
  if (node.type === "MemberExpression" && propertyName(node.property, node.computed) === name)
    return isGlobal(context, node.object, "globalThis");
  if (node.type !== "Identifier" || node.name !== name) return false;
  for (
    let scope: Scope | null = context.sourceCode.getScope(node);
    scope !== null;
    scope = scope.upper
  ) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable.defs.length === 0;
  }
  return true;
}

/** Whether an identifier reads or writes a variable, rather than being a key of the same spelling. */
export function isReference(context: Context, node: ESTree.Node): boolean {
  for (
    let scope: Scope | null = context.sourceCode.getScope(node);
    scope !== null;
    scope = scope.upper
  ) {
    if (scope.references.some((reference) => reference.identifier === node)) return true;
  }
  return false;
}
