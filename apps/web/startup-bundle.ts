import { relative } from "node:path";
import type { Plugin } from "vite-plus";

export interface StartupChunk {
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly imports: readonly string[];
  readonly code: string;
  readonly modules: Readonly<Record<string, unknown>>;
}

/** A dependency that may only load on demand, whatever its size. */
export interface LazyOnlyDependency {
  /** How the failure names it: "Zod's full build". */
  readonly name: string;
  /** A part of the id of each of its modules: "/node_modules/zod/v4/classic/". */
  readonly path: string;
  /** What startup code does instead; ends the failure message. */
  readonly instead: string;
}

export interface StartupRules {
  readonly maxBytes: number;
  readonly lazyOnly?: readonly LazyOnlyDependency[];
}

const inDependency = (id: string) => id.includes("/node_modules/");

/**
 * The startup modules of the workspace that import `found` directly or through other dependency
 * modules: the imports to change. A module that only loads on demand may import it and is not named.
 */
function startupImporters(
  found: readonly string[],
  startupModules: ReadonlySet<string>,
  importersOf: (id: string) => readonly string[],
): string[] {
  const seen = new Set(found);
  const queue = [...found];
  const importers = new Set<string>();
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const importer of importersOf(id)) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      if (inDependency(importer)) queue.push(importer);
      else if (startupModules.has(importer)) importers.add(importer);
    }
  }
  return [...importers].sort();
}

/** Follow only static imports: loading a View on demand must not spend the startup budget. */
export function inspectStartup(
  chunks: readonly StartupChunk[],
  lazyModules: ReadonlySet<string>,
  { maxBytes, lazyOnly = [] }: StartupRules,
  importersOf: (id: string) => readonly string[] = () => [],
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
  const startupModules = new Set(startup.flatMap((chunk) => Object.keys(chunk.modules)));
  const eagerLazyModules = [...startupModules].filter((id) => lazyModules.has(id)).sort();
  const problems = eagerLazyModules.map((id) => `Lazy module entered the startup bundle: ${id}`);
  for (const { name, path, instead } of lazyOnly) {
    const found = [...startupModules].filter((id) => id.includes(path));
    if (found.length === 0) continue;
    const importers = startupImporters(found, startupModules, importersOf);
    const from = importers.length > 0 ? `, imported by ${importers.join(", ")}` : "";
    problems.push(`${name} entered the startup bundle${from}: ${instead}`);
  }
  if (bytes > maxBytes)
    problems.push(`Startup JavaScript is ${bytes} bytes; limit is ${maxBytes} bytes`);
  return { bytes, maxBytes, chunks: [...reached].sort(), eagerLazyModules, problems };
}

/** Audit the emitted production graph, including shared chunks. No source-name allowlist. */
export function startupBundle(rules: StartupRules): Plugin {
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
        const workspaceModule = (id: string) => !inDependency(id) && !id.startsWith("\0");
        const lazyModules = new Set(
          [...this.getModuleIds()].filter(
            (id) =>
              workspaceModule(id) && (this.getModuleInfo(id)?.dynamicImporters.length ?? 0) > 0,
          ),
        );
        const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
        const result = inspectStartup(
          chunks,
          lazyModules,
          rules,
          (id) => this.getModuleInfo(id)?.importers ?? [],
        );
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
          `Startup JavaScript: ${result.bytes} / ${rules.maxBytes} bytes (${result.chunks.length} chunks)`,
        );
      },
    },
  };
}
