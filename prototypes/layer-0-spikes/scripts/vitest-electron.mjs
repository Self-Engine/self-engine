// Runs `vp test run` with Electron's binary acting as Node (ELECTRON_RUN_AS_NODE=1),
// so native modules see Electron's ABI. Only needed for non-N-API addons.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "apps/desktop-a/package.json"));
const electron = require("electron");
const vp = path.join(root, "node_modules/vite-plus/bin/vp");
const r = spawnSync(electron, [vp, "test", "run", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});
process.exit(r.status ?? 1);
