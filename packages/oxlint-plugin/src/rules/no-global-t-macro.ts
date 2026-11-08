// no-global-t-macro: no `t` from Lingui's core macro entry. It translates where it is called,
// which for text in data is at import time, before a language is active, and the result never
// follows a language switch. A `msg` descriptor is translated when it is displayed.
//
// Only the core entry is banned: the `t` that `useLingui` returns renders with the component.

import { defineRule } from "@oxlint/plugins";

const CORE_MACRO_ENTRY = "@lingui/core/macro";
const MESSAGE =
  "The global `t` translates once, before a language is active. Use `msg` outside components and `useLingui` or `Trans` inside them.";

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow the global `t` macro, which ignores the App Language." },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== CORE_MACRO_ENTRY) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const { imported } = specifier;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          if (name === "t") context.report({ node: specifier, message: MESSAGE });
        }
      },
    };
  },
});
