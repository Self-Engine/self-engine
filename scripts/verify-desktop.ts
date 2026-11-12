/// <reference lib="dom" />
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ElectronApplication, Locator } from "playwright";
import {
  builtDesktopApp,
  launchElectron,
  RENDERER_DIR,
  serveRenderer,
  withDesktopApp,
  waitForApp,
  DESKTOP_HIDDEN_ENV,
  type DesktopLaunch,
} from "./desktop-app.ts";
import { DESKTOP_DIR, ensureElectron } from "./ensure-electron.ts";
import {
  SHELL_REFERENCE_WIDTHS,
  SHELL_START_AFTER_WINDOW_BUTTONS_PX,
  SHELL_WINDOW_BUTTON_STRIP_HEIGHT,
  type LayoutStep,
} from "@self-engine/shell/geometry";

export type SystemTheme = "light" | "dark";
export interface DesktopState {
  readonly route: string;
  readonly layoutStep: LayoutStep | undefined;
  readonly errors: readonly string[];
}
export interface WindowButtonContent {
  readonly name: string;
  readonly x: number;
  /** Vertical coordinates relative to the Shell top strip, in unscaled Mantine pixels. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface VerifyDesktopApp {
  waitForApp(): Promise<void>;
  setWidth(width: number): Promise<void>;
  setSystemTheme(mode: SystemTheme): Promise<void>;
  readState(): Promise<DesktopState>;
  screenshot(name: string): Promise<void>;
  modules(): Promise<readonly string[]>;
  openModule(name: string): Promise<void>;
  views(): Promise<readonly string[]>;
  openView(name: string): Promise<void>;
  openSettings(): Promise<void>;
  reload(): Promise<void>;
  deepLink(route: string): Promise<void>;
  startMainAction(): Promise<boolean>;
  isEditDrawerOpen(): Promise<boolean>;
  closeEditDrawer(): Promise<void>;
  readWindowButtonContent(): Promise<readonly WindowButtonContent[]>;
}
export interface DesktopStep extends DesktopState {
  readonly step: string;
  readonly width: number;
  readonly colorMode: SystemTheme;
  readonly screenshot?: string;
}
export interface DesktopSummary {
  readonly passed: boolean;
  readonly windowButtons?: string;
  readonly editDeepLink?: string;
  readonly steps: readonly DesktopStep[];
}

/** One flow owns the rules for both the fake app and the Electron driver. */
export async function verifyDesktop(
  app: VerifyDesktopApp,
  platform: string = process.platform,
): Promise<DesktopSummary> {
  const steps: DesktopStep[] = [];
  const windowButtons = platform === "darwin" ? "checked" : "skipped: native frame until #167";
  let width: number = SHELL_REFERENCE_WIDTHS.wide;
  let colorMode: SystemTheme = "light";
  let screenshotCount = 0;
  const stopped = new Error("Desktop check stopped");
  const capture = async (
    step: string,
    operation: () => Promise<void>,
    {
      expected = "wide",
      photograph = true,
      expectedRoute,
      requireEditor = false,
    }: {
      expected?: LayoutStep;
      photograph?: boolean;
      expectedRoute?: string;
      requireEditor?: boolean;
    } = {},
  ) => {
    let state: DesktopState = { route: "", layoutStep: undefined, errors: [] };
    let screenshot: string | undefined;
    try {
      await app.waitForApp();
      await operation();
      await app.waitForApp();
      state = await app.readState();
      if (state.errors.length > 0) throw new Error(state.errors.join("\n"));
      if (state.layoutStep !== expected) {
        throw new Error(`Expected Layout Step "${expected}", got "${state.layoutStep}".`);
      }
      if (expectedRoute !== undefined && state.route !== expectedRoute) {
        throw new Error(`Expected route "${expectedRoute}", got "${state.route}".`);
      }
      if (requireEditor && !(await app.isEditDrawerOpen()))
        throw new Error("The Edit Drawer is not open.");
      if (platform === "darwin") {
        const blocked = (await app.readWindowButtonContent()).filter(
          ({ x, y, width: w, height }) =>
            w > 0 &&
            height > 0 &&
            x < SHELL_START_AFTER_WINDOW_BUTTONS_PX &&
            x + w > 0 &&
            y < SHELL_WINDOW_BUTTON_STRIP_HEIGHT &&
            y + height > 0,
        );
        if (blocked.length > 0)
          throw new Error(
            `Shell content overlaps the window-button strip: ${blocked.map(({ name }) => name).join(", ")}`,
          );
      }
      if (photograph) {
        const name = `${String(screenshotCount + 1).padStart(2, "0")}-${step}-${state.layoutStep}-${colorMode}.png`;
        await app.screenshot(name);
        screenshot = name;
        screenshotCount++;
        state = await app.readState();
        if (state.errors.length > 0) throw new Error(state.errors.join("\n"));
      }
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
      throw stopped;
    }
    steps.push({
      step,
      width,
      colorMode,
      ...state,
      ...(screenshot === undefined ? {} : { screenshot }),
    });
  };
  let editRoute: string | undefined;
  try {
    for (colorMode of ["light", "dark"] as const) {
      for (const step of Object.keys(
        SHELL_REFERENCE_WIDTHS,
      ) as (keyof typeof SHELL_REFERENCE_WIDTHS)[]) {
        const referenceWidth = SHELL_REFERENCE_WIDTHS[step];
        width = referenceWidth;
        await capture(
          step,
          async () => {
            if (step === "wide") await app.setSystemTheme(colorMode);
            await app.setWidth(width);
          },
          { expected: step === "narrowest" ? "narrow" : step },
        );
      }
    }
    width = SHELL_REFERENCE_WIDTHS.wide;
    colorMode = "light";
    let modules: readonly string[] = [];
    await capture(
      "navigation",
      async () => {
        await app.setWidth(width);
        await app.setSystemTheme(colorMode);
        modules = await app.modules();
        if (modules.length === 0) throw new Error("The Navbar contains no modules.");
      },
      { photograph: false },
    );
    for (const [moduleIndex, module] of modules.entries()) {
      let views: readonly string[] = [];
      await capture(
        `module-${moduleIndex + 1}`,
        async () => {
          await app.openModule(module);
          views = await app.views();
          if (views.length === 0) throw new Error(`Module "${module}" has no Views.`);
        },
        { photograph: false },
      );
      for (const [viewIndex, view] of views.entries()) {
        await capture(`view-${moduleIndex + 1}-${viewIndex + 1}`, () => app.openView(view));
      }
    }
    await capture("settings", () => app.openSettings());
    const settingsRoute = steps.at(-1)!.route;
    await capture("reload", () => app.reload(), { expectedRoute: settingsRoute });
    // A View other than the one the app starts on, so a link that falls back to the start fails.
    const startRoute = steps[0]!.route;
    const viewRoutes = steps
      .filter(({ step }) => step.startsWith("view-"))
      .map(({ route }) => route);
    const viewRoute = viewRoutes.findLast((route) => route !== startRoute) ?? viewRoutes[0]!;
    await capture("deep-link", () => app.deepLink(viewRoute), { expectedRoute: viewRoute });
    await capture(
      "main-action",
      async () => {
        for (const module of modules) {
          await app.openModule(module);
          if (await app.startMainAction()) {
            await app.waitForApp();
            editRoute = (await app.readState()).route;
            if (!new URL(editRoute, "https://desktop.invalid").searchParams.has("edit")) {
              throw new Error("The main action did not leave an edit address.");
            }
            break;
          }
        }
      },
      { photograph: false },
    );
    if (editRoute !== undefined) {
      const address = editRoute;
      await capture(
        "edit-deep-link",
        async () => {
          await app.closeEditDrawer();
          await app.openSettings();
          await app.deepLink(address);
        },
        { expectedRoute: address, requireEditor: true },
      );
    }
  } catch (error) {
    if (error !== stopped) throw error;
    return { passed: false, steps, windowButtons };
  }
  return {
    passed: true,
    steps,
    windowButtons,
    editDeepLink: editRoute === undefined ? "skipped: no module has a main action" : "checked",
  };
}

/** What a failed run prints: the failing step and its errors, so nobody has to open the summary. */
export function failureReport(summary: DesktopSummary, folder: string): string {
  const failed = summary.steps.findLast(({ errors }) => errors.length > 0);
  const heading =
    failed === undefined
      ? "Desktop check failed:"
      : `Desktop check failed at step "${failed.step}" (${failed.width} px, ${failed.colorMode}, route ${failed.route || "none"}):`;
  const errors = failed?.errors ?? ["No step recorded an error."];
  return [
    heading,
    ...errors.map((error) => `  ${error}`),
    `Screenshots and summary: ${folder}`,
  ].join("\n");
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
    let fields: string;
    try {
      fields = execFileSync("lsof", ["-a", "-p", pid!, "-d", "cwd", "-Fn"], { encoding: "utf8" });
    } catch (error) {
      // lsof fails for a process that exited after `ps` listed it; that one cannot clash.
      if (spawnSync("ps", ["-p", pid!]).status !== 0) return [];
      throw new Error(`Cannot read the checkout of dev process ${pid} with lsof.`, {
        cause: error,
      });
    }
    const cwd = fields
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
  const page = app.firstWindow({ timeout: 30_000 });
  // Playwright defaults to emulated light. Clear that override once, so Electron's native
  // theme drives matchMedia; the flow switches themes only through the main process.
  const nativeMedia = page.then((target) => target.emulateMedia({ colorScheme: null }));
  const navbar = page.then((target) =>
    target.getByRole("navigation", { name: "Modules", exact: true }),
  );
  const sidebar = page.then((target) =>
    target.getByRole("navigation", { name: "Module Sidebar", exact: true }),
  );
  const settingsName = "Settings";
  const closeEditorName = "Close editor";
  const names = async (links: Locator) =>
    links.evaluateAll((elements) =>
      elements.map(
        (element) => element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
      ),
    );
  const settle = async () => {
    await (
      await page
    ).evaluate("new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))");
  };
  return {
    async modules() {
      return names((await navbar).getByRole("link")).then((values) =>
        values.filter((name) => name !== settingsName),
      );
    },
    async openModule(name) {
      await (await navbar).getByRole("link", { name, exact: true }).click();
      await settle();
    },
    async views() {
      return names((await sidebar).getByRole("link"));
    },
    async openView(name) {
      await (await sidebar).getByRole("link", { name, exact: true }).click();
      await settle();
    },
    async openSettings() {
      await (await navbar).getByRole("link", { name: settingsName }).click();
      await settle();
    },
    async reload() {
      await (await page).reload();
      await settle();
    },
    async deepLink(route) {
      await (
        await page
      ).evaluate((address) => {
        window.location.hash = address;
      }, route);
      await (await page).reload();
      await settle();
    },
    async startMainAction() {
      const action = (await sidebar).getByRole("button");
      if ((await action.count()) === 0) return false;
      await action.click();
      await (await page).getByRole("button", { name: closeEditorName, exact: true }).waitFor();
      await settle();
      return true;
    },
    async closeEditDrawer() {
      const close = (await page).getByRole("button", { name: closeEditorName, exact: true });
      await close.click();
      await close.waitFor({ state: "hidden" });
      await settle();
    },
    async isEditDrawerOpen() {
      return (await page)
        .getByRole("dialog")
        .filter({
          has: (await page).getByRole("button", { name: closeEditorName, exact: true }),
        })
        .isVisible();
    },
    async readWindowButtonContent() {
      return (await page).locator("[data-layout-step]").evaluate((root) => {
        const style = getComputedStyle(root);
        const scale = Number.parseFloat(style.getPropertyValue("--mantine-scale")) || 1;
        const top = root.getBoundingClientRect().top + Number.parseFloat(style.paddingTop);
        const boxes: WindowButtonContent[] = [];
        // Containers and drag surfaces intentionally reach under the strip. Measure painted
        // text and leaf content instead, including icons and controls without text.
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const element = node instanceof Element ? node : node.parentElement;
          if (!element || !element.checkVisibility()) continue;
          const computed = getComputedStyle(element);
          if (computed.visibility === "hidden" || computed.opacity === "0") continue;
          let rect;
          if (node instanceof Text) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            rect = range.getBoundingClientRect();
          } else {
            if (!element.matches("svg, img, input, button, a, [role=button]")) continue;
            rect = element.getBoundingClientRect();
          }
          boxes.push({
            name:
              element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
            x: rect.x,
            y: (rect.y - top) / scale,
            width: rect.width,
            height: rect.height / scale,
          });
        }
        return boxes;
      });
    },
    async waitForApp() {
      await nativeMedia;
      const target = await page;
      await waitForApp(target);
      // The Shell mounts before lazy Views and drawer bodies. Let their local chunks
      // finish loading (and React's suspense commit settle) before measuring or photographing.
      await target.waitForLoadState("networkidle");
      await settle();
    },
    async setWidth(width) {
      await app.evaluate(({ BrowserWindow }, value) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error("The app has no window.");
        window.setContentSize(value, 800);
      }, width);
      const target = await page;
      await target.waitForFunction((expected) => window.innerWidth === expected, width);
      await settle();
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
        layoutStep: ((await target
          .locator("[data-layout-step]")
          .getAttribute("data-layout-step")) ?? undefined) as LayoutStep | undefined,
        errors: [
          ...errors,
          ...(await app.evaluate(() => {
            const recorded = Reflect.get(globalThis, "__selfEngineMainErrors");
            return Array.isArray(recorded) ? recorded.map(String) : [];
          })),
        ],
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
      {
        ...launch,
        args: [...launch.args, "--lang=en-US"],
        env: { ...launch.env, [DESKTOP_HIDDEN_ENV]: visible ? "" : "1" },
      },
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
          layoutStep: undefined,
          errors: [error instanceof Error ? error.message : String(error)],
        },
      ],
    };
  } finally {
    writeFileSync(join(folder, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (!summary.passed) {
    console.error(failureReport(summary, folder));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Desktop check passed: ${summary.steps.filter(({ screenshot }) => screenshot !== undefined).length} screenshots.\n${folder}`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
