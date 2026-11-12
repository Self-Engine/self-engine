import { defineRule, type ESTree, type Scope } from "@oxlint/plugins";

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
    // A parameter or local with the namespace's name is unrelated to Kysely.
    function namespace(node: ESTree.IdentifierReference): boolean {
      if (!namespaces.has(node.name)) return false;
      for (
        let scope: Scope | null = context.sourceCode.getScope(node);
        scope !== null;
        scope = scope.upper
      ) {
        const variable = scope.set.get(node.name);
        if (variable !== undefined)
          return variable.defs.some((def) => def.type === "ImportBinding");
      }
      return false;
    }
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
          (node.object.type === "Identifier" && namespace(node.object) && RAW_IMPORTS.has(name))
        )
          context.report({ node: node.property, message: MESSAGE });
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern") return;
        const fromNamespace = node.init?.type === "Identifier" && namespace(node.init);
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
            (RAW_EXECUTORS.has(name) || (fromNamespace && RAW_IMPORTS.has(name)))
          )
            context.report({ node: key, message: MESSAGE });
        }
      },
    };
  },
});
