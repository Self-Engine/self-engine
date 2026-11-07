// Dev runner (t3code style): vite dev server for the renderer, `vp pack --watch`
// for main/preload, Electron restarted whenever dist-electron changes.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const dir = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(dir, "package.json"));
const electronPath = require("electron");
const vp = path.join(dir, "node_modules/.bin/vp");
const url = "http://localhost:5173/";
const t0 = Date.now();
const children = [];
const run = (cmd, args, env = {}) => {
  // detached = own process group, so shutdown can kill the vp shim and its node child.
  const c = spawn(cmd, args, {
    cwd: dir,
    stdio: "inherit",
    detached: true,
    env: { ...process.env, ...env },
  });
  children.push(c);
  return c;
};

run(vp, ["dev"]);
run(vp, ["pack", "--watch"]);

let app = null;
let timer = null;
function startElectron() {
  const env = { ...process.env, VITE_DEV_SERVER_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  app = spawn(electronPath, ["."], { cwd: dir, stdio: "inherit", env });
  console.log(`[dev] electron started (${Date.now() - t0} ms since dev start)`);
}
function restart() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (app) {
      const old = app;
      app = null;
      old.once("exit", startElectron);
      old.kill();
      console.log("[dev] main/preload changed -> restarting electron");
    } else startElectron();
  }, 150);
}

async function waitReady() {
  for (;;) {
    const built =
      fs.existsSync(path.join(dir, "dist-electron/main.cjs")) &&
      fs.existsSync(path.join(dir, "dist-electron/preload.cjs"));
    const up = await fetch(url).then(
      () => true,
      () => false,
    );
    if (built && up) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}
await waitReady();
startElectron();
fs.watch(path.join(dir, "dist-electron"), (_e, f) => {
  if (f === "main.cjs" || f === "preload.cjs") restart();
});
const shutdown = () => {
  app?.kill();
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {}
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
