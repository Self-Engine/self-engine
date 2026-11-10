import { relative } from "node:path";
import type { Plugin } from "vite-plus";

export interface StartupChunk {
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly imports: readonly string[];
  readonly code: string;
  readonly modules: Readonly<Record<string, unknown>>;
}

/** Follow only static imports: loading a View on demand must not spend the startup budget. */
export function inspectStartup(
  chunks: readonly StartupChunk[],
  lazyModules: ReadonlySet<string>,
  maxBytes: number,
) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const reached = new Set<string>();
  const visit = (name: string): void => {
    if (reached.has(name)) return;
    const chunk = byName.get(name);
    if (!chunk) throw new Error(`Missing startup chunk ${name}`);
    reached.add(name);
    chunk.imports.forEach(visit);
  };
  chunks.filter((chunk) => chunk.isEntry).forEach((chunk) => visit(chunk.fileName));
  if (reached.size === 0) throw new Error("No startup entry found");
  const startup = chunks.filter((chunk) => reached.has(chunk.fileName));
  const bytes = startup.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
  const eagerLazyModules = [
    ...new Set(
      startup.flatMap((chunk) => Object.keys(chunk.modules).filter((id) => lazyModules.has(id))),
    ),
  ].sort();
  const problems = eagerLazyModules.map((id) => `Lazy module entered the startup bundle: ${id}`);
  if (bytes > maxBytes)
    problems.push(`Startup JavaScript is ${bytes} bytes; limit is ${maxBytes} bytes`);
  return { bytes, maxBytes, chunks: [...reached].sort(), eagerLazyModules, problems };
}

/** Audit the emitted production graph, including shared chunks. No source-name allowlist. */
export function startupBundle(maxBytes: number): Plugin {
  let root = "";
  return {
    name: "self-engine:startup-bundle",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const workspaceModule = (id: string) =>
          !id.includes("/node_modules/") && !id.startsWith("\0");
        const lazyModules = new Set(
          [...this.getModuleIds()].filter(
            (id) =>
              workspaceModule(id) && (this.getModuleInfo(id)?.dynamicImporters.length ?? 0) > 0,
          ),
        );
        const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
        const result = inspectStartup(chunks, lazyModules, maxBytes);
        const report = {
          ...result,
          eagerLazyModules: result.eagerLazyModules.map((id) => relative(root, id)),
        };
        this.emitFile({
          type: "asset",
          fileName: "startup-bundle.json",
          source: `${JSON.stringify(report, null, 2)}\n`,
        });
        if (result.problems.length) this.error(result.problems.join("\n"));
        this.info(
          `Startup JavaScript: ${result.bytes} / ${maxBytes} bytes (${result.chunks.length} chunks)`,
        );
      },
    },
  };
}
