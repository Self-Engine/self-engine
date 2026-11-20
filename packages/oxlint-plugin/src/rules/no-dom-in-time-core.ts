// The core of `time` also runs in the Data Process, which has no page. Its tsconfig includes the
// DOM library for the React entry (`src/react/`), so the compiler no longer rejects `document`
// or `window` there: this rule does, for the globals a page has and the Data Process has not.

import { defineRule } from "@oxlint/plugins";
import { isGlobal, isReference, propertyName } from "./globals.ts";

/** The page's globals: neither Node nor Electron's utility process has them. */
const PAGE_GLOBALS = new Set([
  "window",
  "self",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "matchMedia",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]);

const MESSAGE =
  "The core of time also runs in the Data Process, which has no page: use the page's globals only in packages/time/src/react/, or take what they give as an argument.";

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep the page's globals out of the core of time." },
    schema: [],
  },
  create(context) {
    if (
      !/(?:^|\/)packages\/time\/src\//.test(context.filename) ||
      /(?:^|\/)packages\/time\/src\/react\//.test(context.filename)
    )
      return {};
    return {
      Identifier(node) {
        if (
          PAGE_GLOBALS.has(node.name) &&
          isGlobal(context, node, node.name) &&
          isReference(context, node)
        )
          context.report({ node, message: MESSAGE });
      },
      MemberExpression(node) {
        const name = propertyName(node.property, node.computed);
        if (name !== undefined && PAGE_GLOBALS.has(name) && isGlobal(context, node, name))
          context.report({ node, message: MESSAGE });
      },
    };
  },
});
