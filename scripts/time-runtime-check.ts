// Smoke-only adapter. The program itself depends on time and the runtime alone; no app start
// imports it. Bundle once, then execute identical code in Electron's utility process and page.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { checkRuntime } from "@self-engine/time/check";
import type { ElectronApplication } from "playwright";
import { build } from "vite-plus/pack";

type CheckResult = ReturnType<typeof checkRuntime>;

export function runtimeCheckMessage(runtime: string, result: CheckResult): string {
  if (result.failures.length) {
    throw new Error(`Time check ${runtime}: FAIL\n${result.failures.join("\n")}`);
  }
  return `Time check ${runtime}: PASS (${result.cases} cases, ${result.transitions} transitions, ${result.comparisons} comparisons)`;
}

export async function checkElectronTime(app: ElectronApplication): Promise<void> {
  const started = performance.now();
  const temp = resolve(import.meta.dirname, "../.temp");
  mkdirSync(temp, { recursive: true });
  const directory = mkdtempSync(join(temp, "time-check-"));
  try {
    const entry = createRequire(import.meta.url).resolve("@self-engine/time/check");
    await build({
      config: false,
      entry: { check: entry },
      outDir: directory,
      format: "iife",
      globalName: "TimeCheck",
      platform: "browser",
      deps: { alwaysBundle: [/.*/] },
      dts: false,
      logLevel: "silent",
    });
    const source = readFileSync(join(directory, "check.iife.js"), "utf8");
    const utilityEntry = join(directory, "utility.cjs");
    writeFileSync(
      utilityEntry,
      `${source}\nprocess.parentPort.postMessage(TimeCheck.checkRuntime());\n`,
    );
    const utilityResult = await app.evaluate(
      ({ utilityProcess }, path) =>
        new Promise<CheckResult>((resolveResult, reject) => {
          const child = utilityProcess.fork(path);
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error("Time check utilityProcess timed out after 30 seconds"));
          }, 30_000);
          child.once("message", (result: CheckResult) => {
            clearTimeout(timer);
            child.kill();
            resolveResult(result);
          });
          child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`Time check utilityProcess exited before reporting (code ${code})`));
          });
        }),
      utilityEntry,
    );
    console.log(runtimeCheckMessage("utilityProcess", utilityResult));
    const page = await app.firstWindow();
    // Playwright evaluates in the page's world, using its Temporal and ICU, without imports.
    const pageResult = await page.evaluate<CheckResult>(`${source}\nTimeCheck.checkRuntime()`);
    console.log(runtimeCheckMessage("page", pageResult));
  } finally {
    rmSync(directory, { recursive: true, force: true });
    console.log(
      `Time check added ${(performance.now() - started).toFixed(0)} ms to smoke (bundle, utilityProcess and page).`,
    );
  }
}
