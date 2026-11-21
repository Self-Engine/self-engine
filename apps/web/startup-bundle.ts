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

/** A module that loads on demand, such as a View, and what must not load with it. */
export interface OnDemandRule {
  /** How the failure names it: "The week View of time-tracking". */
  readonly name: string;
  /** A part of its module id: "/packages/time-tracking/src/week.tsx". */
  readonly path: string;
  /** What it must not bring, by itself or through the chunks it imports statically. */
  readonly without: readonly LazyOnlyDependency[];
}

export interface StartupRules {
  readonly maxBytes: number;
  readonly lazyOnly?: readonly LazyOnlyDependency[];
  readonly onDemand?: readonly OnDemandRule[];
}

const inDependency = (id: string) => id.includes("/node_modules/");

/**
 * The modules of the workspace in `loaded` that import `found` directly or through other dependency
 * modules: the imports to change. A module outside `loaded` may import it and is not named.
 */
function importersWithin(
  found: readonly string[],
  loaded: ReadonlySet<string>,
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
      else if (loaded.has(importer)) importers.add(importer);
    }
  }
  return [...importers].sort();
}

/** The chunks that `from` loads with them: themselves and every chunk they import statically. */
function staticallyReached(byName: ReadonlyMap<string, StartupChunk>, from: readonly string[]) {
  const reached = new Set<string>();
  const visit = (name: string): void => {
    if (reached.has(name)) return;
    const chunk = byName.get(name);
    if (!chunk) throw new Error(`Missing startup chunk ${name}`);
    reached.add(name);
    chunk.imports.forEach(visit);
  };
  from.forEach(visit);
  return reached;
}

/** The problems of the modules that load on demand: what each brings although its rule forbids it. */
function inspectOnDemand(
  chunks: readonly StartupChunk[],
  byName: ReadonlyMap<string, StartupChunk>,
  rules: readonly OnDemandRule[],
  importersOf: (id: string) => readonly string[],
): string[] {
  const problems: string[] = [];
  for (const rule of rules) {
    const own = chunks.filter((chunk) =>
      Object.keys(chunk.modules).some((id) => id.includes(rule.path)),
    );
    if (own.length === 0) {
      problems.push(`${rule.name} is missing from the build: no module matches ${rule.path}`);
      continue;
    }
    const reached = staticallyReached(
      byName,
      own.map((chunk) => chunk.fileName),
    );
    const loaded = new Set(
      [...reached].flatMap((name) => Object.keys(byName.get(name)?.modules ?? {})),
    );
    for (const { name, path, instead } of rule.without) {
      const found = [...loaded].filter((id) => id.includes(path));
      if (found.length === 0) continue;
      const importers = importersWithin(found, loaded, importersOf);
      const from = importers.length > 0 ? `, imported by ${importers.join(", ")}` : "";
      problems.push(`${name} loads with ${rule.name}${from}: ${instead}`);
    }
  }
  return problems;
}

/** Follow only static imports: loading a View on demand must not spend the startup budget. */
export function inspectStartup(
  chunks: readonly StartupChunk[],
  lazyModules: ReadonlySet<string>,
  { maxBytes, lazyOnly = [], onDemand = [] }: StartupRules,
  importersOf: (id: string) => readonly string[] = () => [],
) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const reached = staticallyReached(
    byName,
    chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName),
  );
  if (reached.size === 0) throw new Error("No startup entry found");
  const startup = chunks.filter((chunk) => reached.has(chunk.fileName));
  const bytes = startup.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
  const startupModules = new Set(startup.flatMap((chunk) => Object.keys(chunk.modules)));
  const eagerLazyModules = [...startupModules].filter((id) => lazyModules.has(id)).sort();
  const problems = eagerLazyModules.map((id) => `Lazy module entered the startup bundle: ${id}`);
  for (const { name, path, instead } of lazyOnly) {
    const found = [...startupModules].filter((id) => id.includes(path));
    if (found.length === 0) continue;
    const importers = importersWithin(found, startupModules, importersOf);
    const from = importers.length > 0 ? `, imported by ${importers.join(", ")}` : "";
    problems.push(`${name} entered the startup bundle${from}: ${instead}`);
  }
  problems.push(...inspectOnDemand(chunks, byName, onDemand, importersOf));
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
