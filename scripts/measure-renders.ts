import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import type { TestDataProcess } from "@self-engine/data-process/testing";
import type { RenderModules, startRenderDataProcess } from "./render-data-process.ts";
import { chromium, type Page } from "playwright";
import { runnerImport } from "vite-plus";
import { workingTreeHash } from "./verify-stamp.ts";
import { compareReports, type RenderReport } from "./render-counts.ts";
import { countCommit, difference, type RenderCounts } from "@self-engine/ui/story-render-counts";

/** Parse the diagnostic command; reject misspelled options before launching anything. */
export function options(args: string[]) {
  return parseArgs({
    args,
    options: {
      output: { type: "string", default: ".temp/renders/current.json" },
      compare: { type: "string" },
    },
    strict: true,
  }).values;
}

/** The scenarios of one report; a baseline must have exactly these to be compared. */
export const SCENARIOS = ["change-view", "open-edit-drawer", "rename-one-of-1000"] as const;

/** Read a compatible baseline before allocating a port or starting the app. */
export function readBaseline(path: string): RenderReport {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const count = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (
    !record(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.revision !== "string" ||
    !record(parsed.scenarios)
  ) {
    throw new Error(`Not a render report: ${path}`);
  }
  const scenarios: Record<string, RenderCounts> = {};
  for (const [name, scenario] of Object.entries(parsed.scenarios)) {
    if (
      !record(scenario) ||
      !count(scenario.commits) ||
      !record(scenario.components) ||
      !Object.values(scenario.components).every(count)
    ) {
      throw new Error(`Not a render report: invalid counts in ${path}`);
    }
    const components: Record<string, number> = {};
    for (const [component, value] of Object.entries(scenario.components)) {
      if (count(value)) Object.defineProperty(components, component, { value, enumerable: true });
    }
    Object.defineProperty(scenarios, name, {
      value: { commits: scenario.commits, components },
      enumerable: true,
    });
  }
  if (Object.keys(scenarios).sort().join() !== [...SCENARIOS].sort().join()) {
    throw new Error(`Incompatible render report scenarios: ${path}`);
  }
  return { version: 1, revision: parsed.revision, scenarios };
}

/** Reserve an available loopback port briefly; Vite's strictPort detects a subsequent race. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP port allocated");
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  return address.port;
}

/**
 * A stand-in for the desktop app's preload (`DesktopBridge`), installed before the page loads: the
 * page asks for a port as in the desktop app, and gets one whose messages the script relays to a
 * test Data Process in Node. So the page reads and writes through the real Port (D252), with no
 * Electron. The stable channel on Linux adds no badge and no room for window buttons.
 */
export const BRIDGE_STAND_IN = `
  const channel = new MessageChannel();
  channel.port2.onmessage = (event) => globalThis.__seToDataProcess(event.data);
  globalThis.__seFromDataProcess = (data) => channel.port2.postMessage(data);
  globalThis.desktopBridge = {
    platform: "linux",
    channel: "stable",
    version: undefined,
    async requestDataPort() {
      await globalThis.__seOpenDataPort();
      window.postMessage({ type: "self-engine:data-process", kind: "port" }, location.origin, [
        channel.port1,
      ]);
    },
    retryDataProcess() {},
  };
`;

/**
 * Relays the stand-in's port to a test Data Process with `placeholder-alpha` mounted. Each page
 * load asks for a port of its own, as a reload in the desktop app does.
 */
async function dataProcessFor(page: Page): Promise<TestDataProcess> {
  const { module } = await runnerImport<{ startRenderDataProcess: typeof startRenderDataProcess }>(
    resolve(import.meta.dirname, "render-data-process.ts"),
    { configFile: false, logLevel: "error" },
  );
  const process = await module.startRenderDataProcess();
  let port: ReturnType<TestDataProcess["openPort"]> | undefined;
  await page.exposeFunction("__seOpenDataPort", () => {
    port?.close();
    const opened = process.openPort();
    opened.on("message", (data: unknown) => {
      void page
        .evaluate((message) => Reflect.get(globalThis, "__seFromDataProcess")(message), data)
        .catch(() => {
          // A message for a page that is being left has nowhere to go, and its port is replaced.
        });
    });
    port = opened;
  });
  await page.exposeFunction("__seToDataProcess", (data: unknown) => port?.postMessage(data));
  return process;
}

/** A second client of the same Data Process, which writes as another window would. */
async function writerFor(process: TestDataProcess): Promise<DataConnection<RenderModules>> {
  const connection = createDataConnection<RenderModules>();
  const ready = new Promise<void>((resolvePromise) => {
    const stop = connection.subscribe(() => {
      if (connection.getState().status !== "ready") return;
      stop();
      resolvePromise();
    });
  });
  connection.connect(process.openPort());
  await ready;
  return connection;
}

/**
 * Fill `placeholder-alpha` up to 1,000 entries through its Port, or rename one of them. Every
 * create and the rename reach the page as a Table Change, which reloads its list: only the
 * measured step, the rename, is a single change.
 */
async function renameOneOf1000(
  writer: DataConnection<RenderModules>,
  step: "seed" | "rename",
): Promise<void> {
  const alpha = writer.client.placeholderAlpha;
  if (step === "seed") {
    // Studio work and Garden work exist already.
    for (let number = 3; number <= 1000; number++) await alpha.create({ name: `Entry ${number}` });
    return;
  }
  const target = (await alpha.list({})).find(({ name }) => name === "Entry 500");
  if (!target) throw new Error("Entry 500 was not created");
  await alpha.rename({ id: target.id, name: "Renamed entry" });
}

/** Measure the real app and always release its browser and dev server. */
async function main(): Promise<void> {
  const args = options(process.argv.slice(2));
  const root = resolve(import.meta.dirname, "..");
  const baseline = args.compare ? readBaseline(resolve(root, args.compare)) : undefined;
  const port = await freePort();
  let log = "";
  const server = spawn("pnpm", ["--filter", "@self-engine/web", "dev"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise<void>((resolvePromise, reject) => {
    const deadline = setTimeout(
      () => reject(new Error(`Dev server did not start:\n${log}`)),
      30_000,
    );
    const output = (chunk: Buffer) => {
      log += chunk.toString();
      if (log.includes(`127.0.0.1:${port}`)) {
        clearTimeout(deadline);
        resolvePromise();
      }
    };
    server.stdout.on("data", output);
    server.stderr.on("data", output);
    server.once("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(deadline);
      reject(new Error(`Dev server exited ${code}: ${log}`));
    });
  });
  let browser;
  let dataProcess: TestDataProcess | undefined;
  let writer: DataConnection<RenderModules> | undefined;
  try {
    await ready;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      locale: "en-US",
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    dataProcess = await dataProcessFor(page);
    writer = await writerFor(dataProcess);
    for (const name of ["Studio work", "Garden work"]) {
      await writer.client.placeholderAlpha.create({ name });
    }
    await page.addInitScript({ content: BRIDGE_STAND_IN });
    // Install before React loads. Only this browser process sees the instrumentation.
    await page.addInitScript({
      content: `
      const counts = { commits: 0, components: Object.create(null) };
      const previous = new WeakMap();
      const countCommit = ${countCommit.toString()};
      globalThis.__SE_RENDER_COUNTS__ = counts;
      globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true, renderers: new Map(),
        inject(renderer) { this.renderers.set(1, renderer); return 1; },
        onCommitFiberRoot: (_id, root) => countCommit(root.current, counts, previous),
        onCommitFiberUnmount: () => {}, onPostCommitFiberRoot: () => {}
      };
    `,
    });
    const read = () =>
      page.evaluate<RenderCounts>(() => Reflect.get(globalThis, "__SE_RENDER_COUNTS__"));
    const settle = async () => {
      await page.waitForLoadState("networkidle");
      await page.evaluate(
        () =>
          new Promise<void>((done) =>
            Reflect.get(
              globalThis,
              "requestAnimationFrame",
            )(() => Reflect.get(globalThis, "requestAnimationFrame")(() => done())),
          ),
      );
    };
    // With a desktop bridge the app keeps its address in the hash, as in Electron.
    const overview = `http://127.0.0.1:${port}/#/placeholder-alpha/overview`;
    await page.goto(overview);
    await page
      .getByRole("button", { name: "Studio work", exact: true })
      .waitFor()
      .catch(async (error: unknown) => {
        const evidence = resolve(root, ".temp/renders/failure.txt");
        mkdirSync(dirname(evidence), { recursive: true });
        writeFileSync(
          evidence,
          `${errors.join("\n")}\n${await page.locator("body").innerText()}\n${log}`,
        );
        throw error;
      });
    await settle();
    const scenarios: Record<string, RenderCounts> = {};
    let before = await read();
    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await page.getByRole("heading", { name: "Archive", exact: true, level: 1 }).waitFor();
    await settle();
    scenarios["change-view"] = difference(await read(), before);
    before = await read();
    await page.getByRole("button", { name: "Studio work", exact: true }).click();
    await page.getByRole("dialog", { name: "Studio work", exact: true }).waitFor();
    await settle();
    scenarios["open-edit-drawer"] = difference(await read(), before);
    await page.goto(overview);
    await page.getByRole("button", { name: "Studio work", exact: true }).waitFor();
    await renameOneOf1000(writer, "seed");
    await page.getByRole("button", { name: "Entry 1000", exact: true }).waitFor();
    await settle();
    before = await read();
    await renameOneOf1000(writer, "rename");
    await page.getByRole("button", { name: "Renamed entry", exact: true }).waitFor();
    await settle();
    scenarios["rename-one-of-1000"] = difference(await read(), before);
    if (errors.length) throw new Error(`Application errors:\n${errors.join("\n")}`);
    if (Object.values(scenarios).some((scenario) => Object.keys(scenario.components).length === 0))
      throw new Error(
        "No component work recorded: check the React DevTools hook after a React upgrade",
      );
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const dirty =
      execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).length > 0;
    const report: RenderReport = {
      version: 1,
      revision: `${revision}${dirty ? " (dirty)" : ""} tree:${workingTreeHash(root)}`,
      scenarios,
    };
    const output = resolve(root, args.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Current: ${report.revision}${baseline ? `\nBaseline: ${baseline.revision}` : ""}\n${compareReports(report, baseline)}\n\nReport: ${output}`,
    );
  } finally {
    await browser?.close();
    writer?.disconnect();
    await dataProcess?.close();
    if (server.pid && server.exitCode === null) process.kill(-server.pid, "SIGTERM");
  }
}

if (import.meta.main) await main();
