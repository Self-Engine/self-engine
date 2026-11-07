// Electron 45 ships no install script; download the binary explicitly (like t3code's ensure:electron).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "apps/desktop-a/package.json"));
const installJs = path.join(path.dirname(require.resolve("electron/package.json")), "install.js");
execFileSync(process.execPath, [installJs], { stdio: "inherit" });
