import { defineRule, type ESTree, type Scope } from "@oxlint/plugins";

const CONSTRUCTOR =
  "Use instantAt from @self-engine/time, or requireInstant from @self-engine/time/testing for fixtures; convert foreign Dates with instantFromDate (D284).";
const CLOCK =
  "Pass a Clock from @self-engine/time; assemble systemClock from @self-engine/time/system-clock in apps/, or use fixedClock from @self-engine/time/testing (D284).";
const PARSE =
  "Use instantSchema or instantAt from @self-engine/time, or requireInstant from @self-engine/time/testing for fixtures (D284).";
const TEMPORAL =
  "Use instantAt, calendarDayOf, addDays or durationBetween from @self-engine/time; Temporal stays inside time (D284).";
const FORMAT =
  "Use formatInstant from @self-engine/time with an explicit locale and TimeZone (D284).";

function propertyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (!computed && key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep time computations inside time (D284)." },
    schema: [],
  },
  create(context) {
    if (
      !/(?:^|\/)(?:packages|apps)\//.test(context.filename) ||
      /(?:^|\/)packages\/time\//.test(context.filename)
    )
      return {};
    function global(node: ESTree.Node, name: string): boolean {
      if (node.type === "MemberExpression" && propertyName(node.property, node.computed) === name)
        return global(node.object, "globalThis");
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
    function message(object: ESTree.Node, name: string): string | undefined {
      if (name === "Temporal" && global(object, "globalThis")) return TEMPORAL;
      if (name === "toLocaleDateString" || name === "toLocaleTimeString") return FORMAT;
      if (global(object, "Date")) {
        if (name === "now") return CLOCK;
        if (name === "parse" || name === "UTC") return PARSE;
      }
      if (global(object, "Intl") && name === "DateTimeFormat") return FORMAT;
      return undefined;
    }
    function library(node: ESTree.Node, value: unknown): void {
      if (typeof value === "string" && /^(?:date-fns|dayjs|luxon)(?:\/|$)/.test(value))
        context.report({
          node,
          message:
            "Use addDays, instantAt or formatInstant from @self-engine/time instead of a date library (D284).",
        });
    }
    return {
      ImportDeclaration(node) {
        library(node.source, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) library(node.source, node.source.value);
      },
      ExportAllDeclaration(node) {
        library(node.source, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") library(node.source, node.source.value);
      },
      CallExpression(node) {
        if (global(node.callee, "require") && node.arguments[0]?.type === "Literal")
          library(node.arguments[0], node.arguments[0].value);
      },
      NewExpression(node) {
        if (global(node.callee, "Date")) context.report({ node, message: CONSTRUCTOR });
      },
      Identifier(node) {
        if (!global(node, "Temporal")) return;
        // Only references, never property keys or declarations with the same spelling.
        let scope: Scope | null = context.sourceCode.getScope(node);
        while (scope !== null) {
          if (scope.references.some((reference) => reference.identifier === node)) {
            context.report({
              node,
              message: TEMPORAL,
            });
            return;
          }
          scope = scope.upper;
        }
      },
      MemberExpression(node) {
        const name = propertyName(node.property, node.computed);
        const hint = name === undefined ? undefined : message(node.object, name);
        if (hint !== undefined) context.report({ node, message: hint });
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init == null) return;
        for (const property of node.id.properties) {
          if (property.type !== "Property") continue;
          const name = propertyName(property.key, property.computed);
          const hint = name === undefined ? undefined : message(node.init, name);
          if (hint !== undefined) context.report({ node: property.key, message: hint });
        }
      },
    };
  },
});
