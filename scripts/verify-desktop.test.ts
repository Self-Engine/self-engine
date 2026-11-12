import { describe, expect, it } from "vite-plus/test";
import {
  verifyDesktop,
  verifyDesktopOptions,
  assertNoDesktopDev,
  failureReport,
  type VerifyDesktopApp,
} from "./verify-desktop.ts";

function fakeApp(): VerifyDesktopApp & {
  widths: number[];
  modes: string[];
  screenshots: string[];
} {
  let width = 1280;
  const widths: number[] = [];
  const modes: string[] = [];
  const screenshots: string[] = [];
  let route = "/alpha/overview";
  return {
    widths,
    modes,
    screenshots,
    async modules() {
      return ["Alpha", "Beta"];
    },
    async openModule(name) {
      route = name === "Alpha" ? "/alpha/overview" : "/beta/list";
    },
    async views() {
      return route.startsWith("/alpha") ? ["Overview", "Archive"] : ["List"];
    },
    async openView(name) {
      route =
        name === "Overview"
          ? "/alpha/overview"
          : name === "Archive"
            ? "/alpha/archive"
            : "/beta/list";
    },
    async openSettings() {
      route = "/settings/appearance";
    },
    async reload() {},
    async deepLink(address) {
      route = address;
    },
    async startMainAction() {
      return false;
    },
    async closeEditDrawer() {
      route = route.split("?")[0]!;
    },
    async isEditDrawerOpen() {
      return route.includes("?edit=");
    },
    async readWindowButtonContent() {
      return [];
    },
    async waitForApp() {},
    async setWidth(value) {
      width = value;
      widths.push(value);
    },
    async setSystemTheme(value) {
      modes.push(value);
    },
    async readState() {
      return {
        route,
        layoutStep: width >= 1200 ? "wide" : width >= 960 ? "medium" : "narrow",
        errors: [],
      };
    },
    async screenshot(name) {
      screenshots.push(name);
    },
  };
}

describe("verifyDesktop", () => {
  it("photographs the first View at every reference width in light and dark and reports each state", async () => {
    const app = fakeApp();
    const result = await verifyDesktop(app);
    expect(result.passed).toBe(true);
    expect(app.widths.slice(0, 8)).toEqual([1280, 1100, 800, 576, 1280, 1100, 800, 576]);
    expect(app.modes.slice(0, 2)).toEqual(["light", "dark"]);
    expect(app.screenshots.slice(0, 8)).toEqual([
      "01-wide-wide-light.png",
      "02-medium-medium-light.png",
      "03-narrow-narrow-light.png",
      "04-narrowest-narrow-light.png",
      "05-wide-wide-dark.png",
      "06-medium-medium-dark.png",
      "07-narrow-narrow-dark.png",
      "08-narrowest-narrow-dark.png",
    ]);
    expect(result.steps[0]).toEqual({
      step: "wide",
      width: 1280,
      route: "/alpha/overview",
      layoutStep: "wide",
      colorMode: "light",
      screenshot: "01-wide-wide-light.png",
      errors: [],
    });
  });
});

it("fails the named step on a wrong Layout Step and keeps earlier screenshots", async () => {
  const app = fakeApp();
  const read = app.readState.bind(app);
  app.readState = async () => ({ ...(await read()), layoutStep: "wide" });
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps).toHaveLength(2);
  expect(result.steps[1]?.errors).toEqual(['Expected Layout Step "medium", got "wide".']);
  expect(app.screenshots).toEqual(["01-wide-wide-light.png"]);
});

it.each([
  "pageerror: broken render",
  "main uncaughtException: broken main",
  "console.error: broken request",
])("fails on %s after preserving the earlier image", async (message) => {
  const app = fakeApp();
  const read = app.readState.bind(app);
  app.readState = async () => ({
    ...(await read()),
    errors: app.widths.length === 2 ? [message] : [],
  });
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps[1]?.step).toBe("medium");
  expect(result.steps[1]?.errors).toEqual([message]);
  expect(app.screenshots).toHaveLength(1);
});

it.each(["Something went wrong!", "Window closed", "Screenshot failed"])(
  "reports a failed operation: %s",
  async (message) => {
    const app = fakeApp();
    app.waitForApp = async () => {
      if (app.screenshots.length === 1) throw new Error(message);
    };
    const result = await verifyDesktop(app);
    expect(result.passed).toBe(false);
    expect(result.steps[1]).toMatchObject({ step: "medium", errors: [message] });
    expect(app.screenshots).toHaveLength(1);
  },
);

it("reports failure before the Shell starts", async () => {
  const app = fakeApp();
  app.waitForApp = async () => {
    throw new Error("The page shows an error page");
  };
  expect(await verifyDesktop(app)).toMatchObject({
    passed: false,
    steps: [{ step: "wide", errors: ["The page shows an error page"] }],
  });
});

describe("verifyDesktopOptions", () => {
  it("defaults to a hidden built app and accepts an executable and visible window", () => {
    expect(verifyDesktopOptions([])).toEqual({ executable: undefined, visible: false });
    expect(verifyDesktopOptions(["--executable", "/Applications/App", "--visible"])).toEqual({
      executable: "/Applications/App",
      visible: true,
    });
  });
  it.each([["--executable"], ["--unknown"], ["extra"]])(
    "rejects invalid arguments %j",
    (...args) => {
      expect(() => verifyDesktopOptions(args)).toThrow();
    },
  );
});

it("refuses a build only for a desktop dev process in the same checkout", () => {
  expect(() =>
    assertNoDesktopDev("/repo", [{ command: "node scripts/desktop-dev.ts", cwd: "/repo" }]),
  ).toThrow("pnpm dev");
  expect(() =>
    assertNoDesktopDev("/repo", [
      { command: "node scripts/desktop-dev.ts", cwd: "/other" },
      { command: "node scripts/verify-desktop.ts", cwd: "/repo" },
    ]),
  ).not.toThrow();
  expect(() =>
    assertNoDesktopDev("/repo", [{ command: "node /repo/scripts/desktop-dev.ts", cwd: "/other" }]),
  ).toThrow("pnpm dev");
});

it("reports errors emitted during the final screenshot", async () => {
  const app = fakeApp();
  const read = app.readState.bind(app);
  app.readState = async () => ({
    ...(await read()),
    errors: app.screenshots.length === 8 ? ["console.error: late error"] : [],
  });
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps[7]).toMatchObject({
    step: "narrowest",
    colorMode: "dark",
    screenshot: "08-narrowest-narrow-dark.png",
    errors: ["console.error: late error"],
  });
});

it("clicks and photographs every discovered View, then Settings", async () => {
  const result = await verifyDesktop(fakeApp());
  expect(result.passed).toBe(true);
  expect(
    result.steps
      .filter(({ screenshot }) => screenshot !== undefined)
      .slice(8, 12)
      .map(({ route, screenshot, width, colorMode }) => ({ route, screenshot, width, colorMode })),
  ).toEqual([
    {
      route: "/alpha/overview",
      screenshot: "09-view-1-1-wide-light.png",
      width: 1280,
      colorMode: "light",
    },
    {
      route: "/alpha/archive",
      screenshot: "10-view-1-2-wide-light.png",
      width: 1280,
      colorMode: "light",
    },
    {
      route: "/beta/list",
      screenshot: "11-view-2-1-wide-light.png",
      width: 1280,
      colorMode: "light",
    },
    {
      route: "/settings/appearance",
      screenshot: "12-settings-wide-light.png",
      width: 1280,
      colorMode: "light",
    },
  ]);
});

it("fails when the Navbar contains no modules", async () => {
  const app = fakeApp();
  app.modules = async () => [];
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps.at(-1)).toMatchObject({
    step: "navigation",
    errors: ["The Navbar contains no modules."],
  });
});

it("reloads Settings and rejects a changed route", async () => {
  const app = fakeApp();
  app.reload = async () => {
    await app.openModule("Alpha");
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps.at(-1)).toMatchObject({
    step: "reload",
    errors: ['Expected route "/settings/appearance", got "/alpha/overview".'],
  });
});

it("opens a full View deep link after navigating away and rejects a wrong destination", async () => {
  const app = fakeApp();
  const addresses: string[] = [];
  const deepLink = app.deepLink.bind(app);
  app.deepLink = async (address) => {
    addresses.push(address);
    await deepLink(address);
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(true);
  expect(addresses).toEqual(["/beta/list"]);
  expect(result.steps.find(({ step }) => step === "deep-link")).toMatchObject({
    route: "/beta/list",
  });
  const ignoring = fakeApp();
  ignoring.deepLink = async () => {};
  const failed = await verifyDesktop(ignoring);
  expect(failed.passed).toBe(false);
  expect(failed.steps.at(-1)).toMatchObject({
    step: "deep-link",
    errors: ['Expected route "/beta/list", got "/settings/appearance".'],
  });
});

it("rejects a deep link that falls back to the start View", async () => {
  const app = fakeApp();
  app.deepLink = async () => {
    await app.openView("Overview");
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps.at(-1)).toMatchObject({
    step: "deep-link",
    errors: ['Expected route "/beta/list", got "/alpha/overview".'],
  });
});

describe("failureReport", () => {
  it("names the failing step, its route and its errors", () => {
    const report = failureReport(
      {
        passed: false,
        steps: [
          { step: "wide", width: 1280, colorMode: "light", route: "/a", layoutStep: "wide", errors: [] },
          {
            step: "narrow",
            width: 800,
            colorMode: "dark",
            route: "/a",
            layoutStep: "medium",
            errors: ['Expected Layout Step "narrow", got "medium".'],
          },
        ],
      },
      "/out",
    );
    expect(report).toBe(
      [
        'Desktop check failed at step "narrow" (800 px, dark, route /a):',
        '  Expected Layout Step "narrow", got "medium".',
        "Screenshots and summary: /out",
      ].join("\n"),
    );
  });
});

it("reopens the edit address from the first module with a main action", async () => {
  const app = fakeApp();
  const read = app.readState.bind(app);
  const openSettings = app.openSettings.bind(app);
  let edit = false;
  let attempts = 0;
  app.openSettings = async () => {
    if (edit) throw new Error("The Edit Drawer covers navigation");
    await openSettings();
  };
  app.closeEditDrawer = async () => {
    edit = false;
  };
  app.startMainAction = async () => {
    attempts++;
    edit = attempts === 2;
    return edit;
  };
  app.readState = async () => {
    const state = await read();
    return { ...state, route: edit ? state.route + "?edit=new" : state.route };
  };
  const deepLink = app.deepLink.bind(app);
  app.deepLink = async (route) => {
    edit = false;
    await deepLink(route);
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(true);
  expect(attempts).toBe(2);
  expect(result.steps.at(-1)).toMatchObject({
    step: "edit-deep-link",
    route: "/beta/list?edit=new",
  });
  app.isEditDrawerOpen = async () => false;
  attempts = 0;
  const failed = await verifyDesktop(app);
  expect(failed.passed).toBe(false);
  expect(failed.steps.at(-1)).toMatchObject({
    step: "edit-deep-link",
    errors: ["The Edit Drawer is not open."],
  });
});

it.each(["darwin", "win32", "linux"])(
  "checks the window-button strip only on macOS (%s)",
  async (platform) => {
    const app = fakeApp();
    let reads = 0;
    app.readWindowButtonContent = async () => {
      reads++;
      return [{ name: "Covered link", x: 20, y: 15, width: 30, height: 20 }];
    };
    const result = await verifyDesktop(app, platform);
    expect(result.passed).toBe(platform !== "darwin");
    expect(reads).toBe(platform === "darwin" ? 1 : 0);
    expect(result.windowButtons).toBe(
      platform === "darwin" ? "checked" : "skipped: native frame until #167",
    );
    if (platform === "darwin")
      expect(result.steps[0]?.errors).toEqual([
        "Shell content overlaps the window-button strip: Covered link",
      ]);
  },
);

it("reports a skipped edit deep link when no module has a main action", async () => {
  const app = fakeApp();
  let attempts = 0;
  app.startMainAction = async () => {
    attempts++;
    return false;
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(true);
  expect(attempts).toBe(2);
  expect(result.editDeepLink).toBe("skipped: no module has a main action");
  expect(result.steps.filter(({ step }) => step === "edit-deep-link")).toEqual([]);
});

it("names the failing View and preserves its preceding screenshots", async () => {
  const app = fakeApp();
  const openView = app.openView.bind(app);
  app.openView = async (name) => {
    if (name === "Archive") throw new Error("Archive could not render");
    await openView(name);
  };
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(false);
  expect(result.steps.at(-1)).toMatchObject({
    step: "view-1-2",
    errors: ["Archive could not render"],
  });
  expect(app.screenshots).toHaveLength(9);
});

it("numbers screenshots consecutively across navigation steps without photographs", async () => {
  const app = fakeApp();
  const result = await verifyDesktop(app);
  expect(result.passed).toBe(true);
  expect(app.screenshots.map((name) => name.slice(0, 2))).toEqual(
    Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  expect(result.steps.filter(({ screenshot }) => screenshot !== undefined)).toHaveLength(14);
});

it("reports a main-process error recorded before the Shell started", async () => {
  const app = fakeApp();
  const read = app.readState.bind(app);
  app.readState = async () => ({
    ...(await read()),
    errors: ["main uncaughtException: startup failure"],
  });
  expect(await verifyDesktop(app)).toMatchObject({
    passed: false,
    steps: [{ step: "wide", errors: ["main uncaughtException: startup failure"] }],
  });
  expect(app.screenshots).toEqual([]);
});
