import { defineRule } from "@oxlint/plugins";

const MESSAGE = "Use Kysely builders in storage; raw SQL bypasses table announcements (D231).";
const RAW_IMPORTS = new Set(["sql", "CompiledQuery"]);
const RAW_EXECUTORS = new Set(["executeQuery", "executeScript"]);

export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep storage writes visible to the table-recording plugin." },
    schema: [],
  },
  create(context) {
    const namespaces = new Set<string>();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "kysely" || node.importKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(specifier.local.name);
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const name =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value;
          if (RAW_IMPORTS.has(name)) context.report({ node: specifier, message: MESSAGE });
        }
      },
      MemberExpression(node) {
        const name =
          !node.computed && node.property.type === "Identifier"
            ? node.property.name
            : node.property.type === "Literal"
              ? node.property.value
              : undefined;
        if (typeof name !== "string") return;
        if (
          RAW_EXECUTORS.has(name) ||
          (node.object.type === "Identifier" &&
            namespaces.has(node.object.name) &&
            RAW_IMPORTS.has(name))
        )
          context.report({ node: node.property, message: MESSAGE });
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern") return;
        const namespace = node.init?.type === "Identifier" && namespaces.has(node.init.name);
        for (const property of node.id.properties) {
          if (property.type !== "Property") continue;
          const key = property.key;
          const name =
            !property.computed && key.type === "Identifier"
              ? key.name
              : key.type === "Literal"
                ? key.value
                : undefined;
          if (
            typeof name === "string" &&
            (RAW_EXECUTORS.has(name) || (namespace && RAW_IMPORTS.has(name)))
          )
            context.report({ node: key, message: MESSAGE });
        }
      },
    };
  },
});
