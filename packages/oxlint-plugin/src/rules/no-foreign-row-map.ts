import { defineRule } from "@oxlint/plugins";
import { resolve, dirname } from "node:path";

// Row-map exports follow the module's <name>RowMap convention. Whole data namespaces
// and private rows entries would bypass that check, so they are private too.
const MESSAGE =
  "A foreign row map is private. Import a released read piece from the module's data entry instead.";
function owner(path: string): string | undefined {
  return /\/(?:packages|apps)\/([^/]+)/.exec(path)?.[1];
}
function foreign(source: string, filename: string): boolean {
  if (source.startsWith("@self-engine/")) {
    const name = source.split("/")[1];
    return name !== owner(filename);
  }
  if (!source.startsWith(".")) return false;
  const target = resolve(dirname(filename), source);
  const testModule = (path: string) => /\/test\/([^/]+-module)\//.exec(path)?.[1];
  const targetModule = testModule(target);
  if (targetModule !== undefined) return targetModule !== testModule(filename);
  // Relative imports within one package are local unless they explicitly name a
  // sibling test module (also used by the standalone lint fixtures).
  if (/(?:^|\/)\w[\w-]*-module\/data\//.test(source)) return true;
  return owner(target) !== undefined && owner(target) !== owner(filename);
}
export default defineRule({
  meta: { type: "problem", docs: { description: "Keep foreign row maps private." }, schema: [] },
  create(context) {
    // Test setup and agreement checks legitimately inspect the owners’ complete schemas.
    if (/\.test\.[cm]?tsx?$/.test(context.filename)) return {};
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (!foreign(source, context.filename)) return;
        const privateEntry = /\/data\/rows(?:\.ts)?$/.test(source);
        const forbidden = node.specifiers.some(
          (specifier) =>
            (specifier.type !== "ImportSpecifier" && /\/data(?:\/|$)/.test(source)) ||
            (specifier.type === "ImportSpecifier" &&
              /rowmap$/i.test(
                specifier.imported.type === "Identifier"
                  ? specifier.imported.name
                  : String(specifier.imported.value),
              )),
        );
        if (privateEntry || forbidden) context.report({ node, message: MESSAGE });
      },
      ExportNamedDeclaration(node) {
        if (!node.source || !foreign(String(node.source.value), context.filename)) return;
        if (
          /\/data\/rows(?:\.ts)?$/.test(String(node.source.value)) ||
          node.specifiers.some((specifier) =>
            /rowmap$/i.test(
              specifier.local.type === "Identifier"
                ? specifier.local.name
                : String(specifier.local.value),
            ),
          )
        )
          context.report({ node, message: MESSAGE });
      },
      ImportExpression(node) {
        if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
        if (
          /\/data(?:\/|$)/.test(node.source.value) &&
          foreign(node.source.value, context.filename)
        )
          context.report({ node, message: MESSAGE });
      },
      ExportAllDeclaration(node) {
        if (
          /\/data(?:\/|$)/.test(String(node.source.value)) &&
          foreign(String(node.source.value), context.filename)
        )
          context.report({ node, message: MESSAGE });
      },
    };
  },
});
