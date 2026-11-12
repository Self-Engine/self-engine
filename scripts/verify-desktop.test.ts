import { describe, expect, it } from "vite-plus/test";
import {
  verifyDesktop,
  verifyDesktopOptions,
  assertNoDesktopDev,
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
  return {
    widths,
    modes,
    screenshots,
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
        route: "/alpha/overview",
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
    expect(app.widths).toEqual([1280, 1100, 800, 576, 1280, 1100, 800, 576]);
    expect(app.modes).toEqual(["light", "dark"]);
    expect(app.screenshots).toEqual([
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
