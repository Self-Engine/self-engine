import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  type DesktopApp,
  type DesktopLaunch,
  builtDesktopApp,
  rendererFile,
  serveRenderer,
  withDesktopApp,
} from "./desktop-app.ts";

const http = vi.hoisted(() => ({
  request: vi.fn<(request: IncomingMessage, response: ServerResponse) => void>(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, createReadStream: vi.fn(original.createReadStream) };
});

vi.mock("node:http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:http")>()),
  createServer: (handler: (request: IncomingMessage, response: ServerResponse) => void) => {
    http.request.mockImplementation(handler);
    return {
      listen: (_port: number, _host: string, ready: () => void) => ready(),
      address: () => ({ port: 4321 }),
      closeAllConnections: () => {},
      close: (closed: () => void) => closed(),
    };
  },
}));

const LAUNCH: DesktopLaunch = {
  executablePath: "/apps/Self-Engine Nightly.app/Contents/MacOS/Self-Engine Nightly",
  args: ["--some-flag"],
  env: { SOME_VARIABLE: "value" },
};

interface Started {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  closed: boolean;
}

function fakeLauncher(): {
  readonly started: Started[];
  launch: (options: Omit<Started, "closed">) => Promise<DesktopApp>;
} {
  const started: Started[] = [];
  return {
    started,
    launch: async (options) => {
      const entry: Started = { ...options, closed: false };
      started.push(entry);
      return {
        close: async () => {
          entry.closed = true;
        },
      };
    },
  };
}

function profileOf(started: Started): string {
  const flag = started.args.find((arg) => arg.startsWith("--user-data-dir="));
  if (flag === undefined) throw new Error("no --user-data-dir");
  return flag.slice("--user-data-dir=".length);
}

describe("withDesktopApp", () => {
  it("starts the executable with its arguments, its environment and a temporary data folder", async () => {
    const launcher = fakeLauncher();
    let profileDuringRun: string | undefined;
    const result = await withDesktopApp(
      LAUNCH,
      async (_app, profile) => {
        profileDuringRun = profile;
        expect(existsSync(profile)).toBe(true);
        return "done";
      },
      launcher.launch,
    );
    expect(result).toBe("done");
    const [started] = launcher.started;
    if (started === undefined) throw new Error("not started");
    expect(started.executablePath).toBe(LAUNCH.executablePath);
    expect(started.args).toEqual(["--some-flag", `--user-data-dir=${profileDuringRun}`]);
    expect(started.env.SOME_VARIABLE).toBe("value");
    expect(profileOf(started).startsWith(realpathSync(tmpdir()))).toBe(true);
  });

  it("starts Electron as an app even when the caller runs as Node inside Electron", async () => {
    vi.stubEnv("ELECTRON_RUN_AS_NODE", "1");
    try {
      const launcher = fakeLauncher();
      await withDesktopApp(LAUNCH, async () => {}, launcher.launch);
      const [started] = launcher.started;
      if (started === undefined) throw new Error("not started");
      expect(started.env).not.toHaveProperty("ELECTRON_RUN_AS_NODE");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("closes the app and removes the data folder afterwards", async () => {
    const launcher = fakeLauncher();
    await withDesktopApp(LAUNCH, async () => {}, launcher.launch);
    const [started] = launcher.started;
    if (started === undefined) throw new Error("not started");
    expect(started.closed).toBe(true);
    expect(existsSync(profileOf(started))).toBe(false);
  });

  it("closes the app and removes the data folder when the run fails", async () => {
    const launcher = fakeLauncher();
    const run = withDesktopApp(
      LAUNCH,
      async () => {
        throw new Error("check failed");
      },
      launcher.launch,
    );
    await expect(run).rejects.toThrow("check failed");
    const [started] = launcher.started;
    if (started === undefined) throw new Error("not started");
    expect(started.closed).toBe(true);
    expect(existsSync(profileOf(started))).toBe(false);
  });

  it("removes the data folder when the app does not start", async () => {
    let profile: string | undefined;
    const run = withDesktopApp(
      LAUNCH,
      async () => {},
      async (options) => {
        profile = options.args.at(-1)?.slice("--user-data-dir=".length);
        throw new Error("no binary");
      },
    );
    await expect(run).rejects.toThrow("no binary");
    expect(profile !== undefined && existsSync(profile)).toBe(false);
  });
});

describe("serveRenderer", () => {
  it.each([false, true])("handles a stream failure when headers sent is %s", async (headersSent) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "desktop-app-")));
    const file = join(root, "index.html");
    writeFileSync(file, "<html></html>");
    const stream = new fs.ReadStream(file);
    const read = vi.mocked(fs.createReadStream).mockReturnValue(stream);
    const server = await serveRenderer(root);
    const request = new IncomingMessage(new Socket());
    request.url = "/";
    const response = new ServerResponse(request);
    try {
      http.request(request, response);
      if (headersSent) response.write("partial page");
      expect(() => stream.emit("error", new Error("file disappeared"))).not.toThrow();
      if (headersSent) {
        expect(response.destroyed).toBe(true);
      } else {
        expect(response.statusCode).toBe(500);
        expect(response.writableEnded).toBe(true);
      }
    } finally {
      await new Promise<void>((closed) => stream.close(() => closed()));
      response.destroy();
      read.mockReset();
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("builtDesktopApp", () => {
  it("starts the desktop app's build with Electron and loads the renderer from a URL", () => {
    const launch = builtDesktopApp(
      "/repo/apps/desktop",
      "http://127.0.0.1:4321/",
      () => "/bin/electron",
    );
    expect(launch).toEqual({
      executablePath: "/bin/electron",
      args: ["/repo/apps/desktop"],
      env: { VITE_DEV_SERVER_URL: "http://127.0.0.1:4321/" },
    });
  });
});

describe("rendererFile", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function renderer(): string {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "desktop-app-")));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html></html>");
    writeFileSync(join(dir, "assets", "main.js"), "");
    return dir;
  }

  it("serves a built file", () => {
    const root = renderer();
    expect(rendererFile(root, "/assets/main.js")).toBe(join(root, "assets", "main.js"));
  });

  it("serves the page for its start and for an unknown page", () => {
    const root = renderer();
    expect(rendererFile(root, "/")).toBe(join(root, "index.html"));
    expect(rendererFile(root, "/projects")).toBe(join(root, "index.html"));
  });

  it("finds no file for a missing asset or a path outside the build", () => {
    const root = renderer();
    expect(rendererFile(root, "/assets/missing.js")).toBeUndefined();
    expect(rendererFile(root, "/../package.json")).toBeUndefined();
    expect(rendererFile(root, "/%2e%2e/package.json")).toBeUndefined();
  });

  it("finds no file for a decoded path containing NUL", () => {
    expect(rendererFile(renderer(), "/%00")).toBeUndefined();
  });

  it("finds no page when the fallback is missing or is a directory", () => {
    const root = renderer();
    rmSync(join(root, "index.html"));
    expect(rendererFile(root, "/projects")).toBeUndefined();
    mkdirSync(join(root, "index.html"));
    expect(rendererFile(root, "/projects")).toBeUndefined();
  });
});
