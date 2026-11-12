// Expected "not found" results must not depend on recognizing an exception in a bundle (D228).
import { defineRule } from "@oxlint/plugins";

const MESSAGE =
  'Use executeTakeFirst(), then turn undefined into the port\'s "not found" result (D190).';

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require explicit not found results instead of throwing queries." },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const { property } = node;
        const name =
          !node.computed && property.type === "Identifier"
            ? property.name
            : node.computed && property.type === "Literal"
              ? property.value
              : undefined;
        if (name === "executeTakeFirstOrThrow" || name === "takeFirstOrThrow") {
          context.report({ node: property, message: MESSAGE });
        }
      },
    };
  },
});
