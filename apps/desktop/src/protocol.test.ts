import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  contentSecurityPolicy,
  desktopUrl,
  isRendererUrl,
  proxyToDevServer,
  serveAsset,
  withContentSecurityPolicy,
} from "./protocol.ts";

const BASE = "self-engine://app";

describe("desktopUrl", () => {
  it("builds the start page from the scheme", () => {
    expect(desktopUrl("self-engine")).toBe(`${BASE}/`);
  });
});

describe("isRendererUrl", () => {
  it.each([
    [`${BASE}/`, true],
    [`${BASE}/#/about`, true],
    ["self-engine://other/", false],
    ["self-engine-dev://app/", false],
    ["https://example.com/", false],
    ["not a url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isRendererUrl(url, "self-engine")).toBe(expected);
  });
});

describe("contentSecurityPolicy", () => {
  it("allows only the page's start script inline, and no sockets, in production", () => {
    const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
    const startScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    expect(startScript).not.toBe("");
    const hash = createHash("sha256").update(startScript).digest("base64");

    const policy = contentSecurityPolicy();

    // On a failure after editing the script: copy the hash into START_SCRIPT_HASH.
    expect(policy).toContain(`script-src 'self' 'sha256-${hash}';`);
    expect(policy).toContain("connect-src 'self';");
    expect(policy).toContain("object-src 'none'");
  });

  it("opens only what Vite needs in development", () => {
    const policy = contentSecurityPolicy(new URL("http://127.0.0.1:5733/"));
    expect(policy).toContain("script-src 'self' 'unsafe-inline';");
    expect(policy).toContain("connect-src 'self' ws://127.0.0.1:5733;");
  });
});

describe("withContentSecurityPolicy", () => {
  it("adds the header and keeps the response", async () => {
    const response = withContentSecurityPolicy(
      new Response("body", { status: 201, headers: { "content-type": "text/plain" } }),
      "default-src 'self'",
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'self'");
    expect(await response.text()).toBe("body");
  });
});

describe("serveAsset", () => {
  let temp: string;
  let root: string;

  beforeEach(() => {
    temp = mkdtempSync(join(tmpdir(), "protocol-"));
    root = join(temp, "renderer");
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(join(root, "index.html"), "<html>shell</html>");
    writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
    writeFileSync(join(temp, "secret.txt"), "secret");
  });

  afterEach(() => {
    rmSync(temp, { recursive: true, force: true });
  });

  const get = (path: string, init?: RequestInit) => {
    // `new Request` normalizes `..` away, so a traversal needs the encoded form.
    return serveAsset(new Request(`${BASE}${path}`, init), root);
  };

  it("serves a built file with its content type", async () => {
    const response = await get("/assets/app.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await response.text()).toBe("console.log(1)");
  });

  it("serves index.html for the root and for an unknown page", async () => {
    expect(await (await get("/")).text()).toBe("<html>shell</html>");
    expect(await (await get("/some/route")).text()).toBe("<html>shell</html>");
  });

  it("serves index.html for a navigation to a path with an extension", async () => {
    const response = await get("/page.v2", { headers: { accept: "text/html" } });
    expect(await response.text()).toBe("<html>shell</html>");
  });

  it("answers 404 for a missing asset instead of the page", async () => {
    expect((await get("/assets/missing.js")).status).toBe(404);
  });

  it("does not leave the asset directory", async () => {
    expect((await get("/..%2Fsecret.txt")).status).toBe(404);
  });

  it("rejects malformed paths", async () => {
    expect((await get("/%E0%A4%A")).status).toBe(404);
    expect((await get("/a%00b")).status).toBe(404);
  });

  it("answers 404 for another host", async () => {
    const response = await serveAsset(new Request("self-engine://other/index.html"), root);
    expect(response.status).toBe(404);
  });

  it("refuses writes and sends no body for HEAD", async () => {
    expect((await get("/", { method: "POST" })).status).toBe(405);
    const head = await get("/assets/app.js", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});

describe("proxyToDevServer", () => {
  const devServer = new URL("http://127.0.0.1:5733/");

  it("keeps path and query, and drops browser-only headers", async () => {
    const upstream = vi.fn(async () => new Response("module", { status: 200 }));
    const request = new Request(`${BASE}/src/main.tsx?t=1`, {
      headers: {
        accept: "text/javascript",
        origin: "self-engine-dev://app",
        "sec-fetch-mode": "cors",
      },
    });

    const response = await proxyToDevServer(request, devServer, upstream);

    expect(await response.text()).toBe("module");
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:5733/src/main.tsx?t=1");
    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("text/javascript");
    expect(headers.has("origin")).toBe(false);
    expect(headers.has("sec-fetch-mode")).toBe(false);
  });

  it("cannot be pointed at another host by the path", async () => {
    const upstream = vi.fn(async () => new Response(""));
    await proxyToDevServer(new Request(`${BASE}//evil.example/x`), devServer, upstream);
    const [url] = upstream.mock.calls[0] as unknown as [string];
    expect(new URL(url).host).toBe("127.0.0.1:5733");
  });

  it("answers 404 for another host without asking the dev server", async () => {
    const upstream = vi.fn(async () => new Response(""));
    const response = await proxyToDevServer(new Request("self-engine://x/"), devServer, upstream);
    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
