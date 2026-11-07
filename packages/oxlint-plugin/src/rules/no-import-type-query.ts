// no-import-type-query: no `import("…")` in a type position (`typeof import("./a.ts")`,
// `import("pkg").T`). dependency-cruiser's swc parser does not see these type queries, so the
// boundary rules (.dependency-cruiser.ts) would miss the edge. `import type { T } from "…"`
// says the same and stays visible.
//
// Every specifier is banned, not only relative and `@self-engine/*` ones: an npm package
// reached this way also skips `not-to-undeclared`, and there is no case an `import type`
// cannot cover. A dynamic `import("…")` expression is a different node and stays allowed.

import { defineRule } from "@oxlint/plugins";

const MESSAGE =
  "The boundary check cannot see an import type query. Use `import type { … } from` instead.";

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: 'Disallow `import("…")` types, which the boundary check cannot see.' },
    schema: [],
  },
  create(context) {
    return {
      TSImportType(node) {
        context.report({ node, message: MESSAGE });
      },
    };
  },
});
