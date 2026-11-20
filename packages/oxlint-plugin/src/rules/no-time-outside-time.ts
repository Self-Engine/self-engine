import { defineRule, type ESTree } from "@oxlint/plugins";
import { isGlobal, isReference, propertyName } from "./globals.ts";

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
    const global = (node: ESTree.Node, name: string) => isGlobal(context, node, name);
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
    /** A forbidden API taken out of its object by destructuring, in a declaration or assignment. */
    function destructured(target: ESTree.Node, source: ESTree.Node): void {
      if (target.type !== "ObjectPattern") return;
      for (const property of target.properties) {
        if (property.type !== "Property") continue;
        const name = propertyName(property.key, property.computed);
        const hint = name === undefined ? undefined : message(source, name);
        if (hint !== undefined) context.report({ node: property.key, message: hint });
      }
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
        // Only references, never property keys or declarations with the same spelling.
        if (global(node, "Temporal") && isReference(context, node))
          context.report({ node, message: TEMPORAL });
      },
      MemberExpression(node) {
        const name = propertyName(node.property, node.computed);
        const hint = name === undefined ? undefined : message(node.object, name);
        if (hint !== undefined) context.report({ node, message: hint });
      },
      VariableDeclarator(node) {
        if (node.init != null) destructured(node.id, node.init);
      },
      AssignmentExpression(node) {
        destructured(node.left, node.right);
      },
    };
  },
});
