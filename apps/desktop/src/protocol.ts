// The custom protocol that serves the renderer. Free of `electron` so it can be tested in
// Node: main.ts passes in Electron's `net.fetch`.

import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const HOST = "app";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Request headers a proxied request must not carry over to the dev server. */
const DROPPED_PROXY_HEADERS = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "host",
  "origin",
  "referer",
  "upgrade-insecure-requests",
]);

/** The start page of the renderer. */
export function desktopUrl(scheme: string): string {
  return `${scheme}://${HOST}/`;
}

/** Whether `url` is the renderer itself, so navigation there stays in the window. */
export function isRendererUrl(url: string, scheme: string): boolean {
  const parsed = URL.parse(url);
  return parsed?.protocol === `${scheme}:` && parsed.host === HOST;
}

/** The inline script of `apps/web/index.html` that paints the first frame; a test compares it. */
const START_SCRIPT_HASH = "sha256-7bXdgxfElyFiApdx3D/SRBbEzayuqlIKvruPtpoSc+4=";

/**
 * The policy of every response. Styles stay `unsafe-inline` for Mantine. With a `devServer`,
 * Vite needs inline scripts for its React refresh preamble and a socket for HMR. Production
 * allows only the start script, and the dev policy must not list it: a hash disables
 * `unsafe-inline`.
 */
export function contentSecurityPolicy(devServer?: URL): string {
  const dev = devServer !== undefined;
  return [
    "default-src 'self'",
    `script-src 'self' ${dev ? "'unsafe-inline'" : `'${START_SCRIPT_HASH}'`}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ` ws://${devServer.host}` : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** `response` with `policy` as its Content-Security-Policy header. */
export function withContentSecurityPolicy(response: Response, policy: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", policy);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The built file for a pathname, or undefined when it would leave `root`. */
function assetPath(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    if (error instanceof URIError) return undefined;
    throw error;
  }
  if (decoded.includes("\0")) return undefined;
  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(root + sep) ? candidate : undefined;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

/** Production: a built file from `assetDirectory`, or `index.html` for an unknown page. */
export async function serveAsset(request: Request, assetDirectory: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response(null, { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405 });
  }
  const root = resolve(assetDirectory);
  const requested = assetPath(root, url.pathname);
  if (requested === undefined) return new Response(null, { status: 404 });

  let file = requested;
  if (!(await isFile(requested))) {
    const wantsPage = request.headers.get("accept")?.includes("text/html") ?? false;
    if (extname(requested) !== "" && !wantsPage) return new Response(null, { status: 404 });
    file = join(root, "index.html");
  }
  const body = request.method === "HEAD" ? null : new Uint8Array(await readFile(file));
  return new Response(body, {
    headers: { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" },
  });
}

/** Development: forwards the request to the Vite dev server. */
export async function proxyToDevServer(
  request: Request,
  devServer: URL,
  fetchUpstream: (url: string, init: RequestInit) => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response(null, { status: 404 });
  // Assigned field by field so a pathname with leading slashes cannot replace the host.
  const target = new URL(devServer);
  target.pathname = url.pathname;
  target.search = url.search;
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!DROPPED_PROXY_HEADERS.has(name) && !name.startsWith("sec-fetch-")) {
      headers.append(name, value);
    }
  }
  return fetchUpstream(target.toString(), { method: request.method, headers });
}
