import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ElectronApplication } from "playwright";
import {
  builtDesktopApp,
  launchElectron,
  RENDERER_DIR,
  serveRenderer,
  withDesktopApp,
  type DesktopLaunch,
} from "./desktop-app.ts";
import { DESKTOP_DIR, ensureElectron } from "./ensure-electron.ts";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/layout";

export type ColorMode = "light" | "dark";
export interface DesktopState {
  readonly route: string;
  readonly layoutStep: string;
  readonly errors: readonly string[];
}
export interface VerifyDesktopApp {
  waitForApp(): Promise<void>;
  setWidth(width: number): Promise<void>;
  setSystemTheme(mode: ColorMode): Promise<void>;
  readState(): Promise<DesktopState>;
  screenshot(name: string): Promise<void>;
}
export interface DesktopStep extends DesktopState {
  readonly step: string;
  readonly width: number;
  readonly colorMode: ColorMode;
  readonly screenshot?: string;
}
export interface DesktopSummary {
  readonly passed: boolean;
  readonly steps: readonly DesktopStep[];
}

/** The first View at the desktop reference widths, with the setting left at System. */
export async function verifyDesktop(app: VerifyDesktopApp): Promise<DesktopSummary> {
  const steps: DesktopStep[] = [];
  for (const colorMode of ["light", "dark"] as const) {
    for (const [step, width] of Object.entries(SHELL_REFERENCE_WIDTHS)) {
      let state: DesktopState = { route: "", layoutStep: "", errors: [] };
      let screenshot: string | undefined;
      try {
        await app.waitForApp();
        if (step === "wide") await app.setSystemTheme(colorMode);
        await app.setWidth(width);
        await app.waitForApp();
        state = await app.readState();
        if (state.errors.length > 0) throw new Error(state.errors.join("\n"));
        const expected = step === "narrowest" ? "narrow" : step;
        if (state.layoutStep !== expected) {
          throw new Error(`Expected Layout Step "${expected}", got "${state.layoutStep}".`);
        }
        const name = `${String(steps.length + 1).padStart(2, "0")}-${step}-${state.layoutStep}-${colorMode}.png`;
        await app.screenshot(name);
        screenshot = name;
        state = await app.readState();
        if (state.errors.length > 0) throw new Error(state.errors.join("\n"));
      } catch (error) {
        steps.push({
          step,
          width,
          colorMode,
          ...state,
          ...(screenshot === undefined ? {} : { screenshot }),
          errors:
            state.errors.length > 0
              ? state.errors
              : [error instanceof Error ? error.message : String(error)],
        });
        return { passed: false, steps };
      }
      steps.push({ step, width, colorMode, ...state, screenshot });
    }
  }
  return { passed: true, steps };
}

export function verifyDesktopOptions(args: readonly string[]): {
  executable: string | undefined;
  visible: boolean;
} {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      executable: { type: "string" },
      visible: { type: "boolean", default: false },
    },
  });
  return { executable: values.executable, visible: values.visible };
}

export interface DesktopProcess {
  readonly command: string;
  readonly cwd: string;
}

/** Injected process listings keep the build guard deterministic in tests. */
export function assertNoDesktopDev(root: string, processes: readonly DesktopProcess[]): void {
  for (const { command, cwd } of processes) {
    const script = [...command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)]
      .map((match) => match[1] ?? match[2] ?? match[3]!)
      .find(
        (argument) =>
          argument === "scripts/desktop-dev.ts" || argument.endsWith("/scripts/desktop-dev.ts"),
      );
    if (script !== undefined && resolve(cwd, script) === join(root, "scripts/desktop-dev.ts")) {
      throw new Error("Stop pnpm dev in this checkout before building with verify-desktop.");
    }
  }
}

function desktopProcesses(): DesktopProcess[] {
  const listing = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  return listing.split("\n").flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(.+scripts\/desktop-dev\.ts(?:\s.*)?)$/);
    if (!match) return [];
    const [, pid, command] = match;
    const cwd = execFileSync("lsof", ["-a", "-p", pid!, "-d", "cwd", "-Fn"], { encoding: "utf8" })
      .split("\n")
      .find((field) => field.startsWith("n"))
      ?.slice(1);
    if (cwd === undefined) throw new Error(`Cannot determine the checkout of dev process ${pid}.`);
    return [{ command: command!, cwd }];
  });
}

/** Playwright only translates app operations; the flow owns the check and report rules. */
export function verifyDesktopDriver(app: ElectronApplication, folder: string): VerifyDesktopApp {
  const errors: string[] = [];
  app.on("console", (message) => {
    if (message.type() === "error") errors.push(`main console.error: ${message.text()}`);
  });
  const observed = new WeakSet<object>();
  const observePage = (page: Awaited<ReturnType<ElectronApplication["firstWindow"]>>) => {
    if (observed.has(page)) return;
    observed.add(page);
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });
  };
  app.on("window", observePage);
  for (const page of app.windows()) observePage(page);
  const mainErrors = app.evaluateHandle(() => {
    const failures: string[] = [];
    process.on("uncaughtExceptionMonitor", (error) =>
      failures.push(`main uncaughtException: ${error.message}`),
    );
    process.on("unhandledRejection", (error: unknown) =>
      failures.push(`main unhandledRejection: ${String(error)}`),
    );
    return failures;
  });
  const page = app.firstWindow({ timeout: 30_000 });
  // Playwright defaults to emulated light. Clear that override once, so Electron's native
  // theme drives matchMedia; the flow switches themes only through the main process.
  const nativeMedia = page.then((target) => target.emulateMedia({ colorScheme: null }));
  return {
    async waitForApp() {
      await mainErrors;
      await nativeMedia;
      const target = await page;
      await target
        .locator("[data-layout-step]")
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(async (error: unknown) => {
          const shown = await target
            .locator("body")
            .innerText()
            .catch(() => {
              // Diagnostic text only; the original wait failure is reported below.
              return "";
            });
          throw new Error(
            `The page did not show the Shell. It shows: ${shown.slice(0, 300) || "nothing"}`,
            { cause: error },
          );
        });
    },
    async setWidth(width) {
      await app.evaluate(({ BrowserWindow }, value) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error("The app has no window.");
        window.setContentSize(value, 800);
      }, width);
      const target = await page;
      await target.waitForFunction("(width) => window.innerWidth === width", width);
      await target.evaluate(
        "new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))",
      );
    },
    async setSystemTheme(mode) {
      await app.evaluate(({ nativeTheme }, value) => {
        nativeTheme.themeSource = value;
      }, mode);
      await (await page).locator(`html[data-mantine-color-scheme="${mode}"]`).waitFor();
    },
    async readState() {
      const target = await page;
      return {
        route: new URL(target.url()).hash.slice(1),
        layoutStep:
          (await target.locator("[data-layout-step]").getAttribute("data-layout-step")) ?? "",
        errors: [...errors, ...(await (await mainErrors).jsonValue())],
      };
    },
    async screenshot(name) {
      await (await page).screenshot({ path: join(folder, name), animations: "disabled" });
    },
  };
}

async function main(): Promise<void> {
  const { executable, visible } = verifyDesktopOptions(process.argv.slice(2));
  const root = resolve(import.meta.dirname, "..");
  if (executable === undefined) {
    assertNoDesktopDev(root, desktopProcesses());
    const build = spawnSync("pnpm", ["exec", "vp", "run", "-r", "build"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SELF_ENGINE_CHANNEL: "dev" },
    });
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`Desktop build failed (${build.status}).`);
    ensureElectron(DESKTOP_DIR);
  }
  const folder = join(root, ".temp/verify-desktop", new Date().toISOString().replaceAll(":", "-"));
  mkdirSync(folder, { recursive: true });
  console.log(folder);
  let summary: DesktopSummary = { passed: false, steps: [] };
  const run = async (launch: DesktopLaunch): Promise<void> => {
    await withDesktopApp(
      { ...launch, env: { ...launch.env, SELF_ENGINE_HIDDEN: visible ? "" : "1" } },
      async (app) => {
        summary = await verifyDesktop(verifyDesktopDriver(app, folder));
      },
      launchElectron,
    );
  };
  try {
    if (executable !== undefined) {
      await run({ executablePath: executable, args: [], env: {} });
    } else {
      const server = await serveRenderer(RENDERER_DIR);
      try {
        await run(builtDesktopApp(DESKTOP_DIR, server.url));
      } finally {
        await server.close();
      }
    }
  } catch (error) {
    summary = {
      passed: false,
      steps: [
        ...summary.steps,
        {
          step: "start-or-close",
          width: SHELL_REFERENCE_WIDTHS.wide,
          colorMode: "light",
          route: "",
          layoutStep: "",
          errors: [error instanceof Error ? error.message : String(error)],
        },
      ],
    };
  } finally {
    writeFileSync(join(folder, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (!summary.passed)
    throw new Error(`Desktop check failed. Read ${join(folder, "summary.json")}`);
  console.log(`Desktop check passed: ${summary.steps.length} screenshots.\n${folder}`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
