// `pnpm verify`: the one gate for humans and agents (ADR 0008). It runs the
// `verify:*` tasks from vite.config.ts through `vp run`, which caches them: format, lint
// (warnings fail), typecheck, the module boundaries (.dependency-cruiser.ts), the ADR check,
// the guard against changed migrations, the theme CSS check, the translations and the workspace
// build, then the tests, the stories in Chromium and the smoke test of the built desktop app
// (desktop-smoke.ts). Every stage's output goes to `.cache/verify.log`; the console gets one
// line per stage, the tail of each failing stage, and a last line `VERIFY: PASS` or
// `VERIFY: FAIL <stages>`.
//
// Under CI (`CI` set, as GitHub Actions does) the format and i18n stages only check: they fail
// on an unformatted file or a stale catalog instead of rewriting it, since a rewrite on the
// runner reaches nobody. Each runs as its own task, `verify:<stage>:check`, so the cache of a
// check run and a write run never replay each other.
//
// The static stages all run even after one fails, so one run reports lint and type errors
// together; the tests run only once they pass, the stories only once the tests pass, and the
// smoke test only once the stories pass. A pass records the verified tree (verify-stamp.ts),
// which the push guard (verify-guard.ts) requires before `git push`.

import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  clearVerifyStamp,
  headTreeHash,
  workingTreeHash,
  writeVerifyStamp,
} from "./verify-stamp.ts";

export const STATIC_STAGES = [
  "format",
  "lint",
  "typecheck",
  "boundaries",
  "adrs",
  "migrations",
  "theme-css",
  "i18n",
  "build",
] as const;
export const TEST_STAGES = ["test", "stories", "smoke"] as const;
export const LOG_FILE = ".cache/verify.log";
const FAILURE_TAIL_LINES = 80;

/** Whether `env` is a CI run: `CI` set to anything but empty, `false` or `0`. */
export function isCi(env: NodeJS.ProcessEnv): boolean {
  const value = env.CI?.trim().toLowerCase();
  return value !== undefined && value !== "" && value !== "false" && value !== "0";
}

/** The stages that rewrite files locally and only check them under CI. */
const CHECK_ONLY_IN_CI: ReadonlySet<string> = new Set(["format", "i18n"]);

/**
 * The `vp run` task of one stage: `verify:<stage>`, except that CI runs
 * `verify:<stage>:check` for a stage that would rewrite files.
 */
export function stageTask(stage: string, env: NodeJS.ProcessEnv): string {
  return CHECK_ONLY_IN_CI.has(stage) && isCi(env) ? `verify:${stage}:check` : `verify:${stage}`;
}

export interface StageResult {
  readonly stage: string;
  readonly ok: boolean;
}

/** The last `count` lines of `output`, ignoring trailing blank lines. */
export function tail(output: string, count: number): string {
  return output.trimEnd().split("\n").slice(-count).join("\n");
}

/**
 * Runs the static stages, then each test stage as long as everything before it passed.
 * `runStage` reports whether one stage passed.
 */
export async function runStages(
  runStage: (stage: string) => Promise<boolean>,
): Promise<StageResult[]> {
  const results: StageResult[] = [];
  for (const stage of STATIC_STAGES) {
    results.push({ stage, ok: await runStage(stage) });
  }
  for (const stage of TEST_STAGES) {
    if (!results.every((result) => result.ok)) break;
    results.push({ stage, ok: await runStage(stage) });
  }
  return results;
}

/** The last line of the gate: `VERIFY: PASS`, or `VERIFY: FAIL` with the failed stages. */
export function summaryLine(results: readonly StageResult[], logFile: string): string {
  const failed = results.filter((result) => !result.ok).map((result) => result.stage);
  return failed.length === 0
    ? "VERIFY: PASS"
    : `VERIFY: FAIL ${failed.join(", ")} (full log: ${logFile})`;
}

/**
 * Runs a command and returns its exit code and its stdout and stderr, interleaved. A command
 * that cannot start (missing binary) counts as exit 1 with the error as its output, so the
 * stage fails like any other instead of the gate dying without its `VERIFY:` line.
 */
export function capture(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (error) =>
      resolvePromise({ code: 1, output: `${output}${error.message}\n` }),
    );
    child.on("close", (code) => resolvePromise({ code: code ?? 1, output }));
  });
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const logPath = join(root, LOG_FILE);
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, "");
  clearVerifyStamp(root);

  // The checkout's own `vp`, not whatever PATH holds.
  const vp = join(root, "node_modules/.bin/vp");
  const results = await runStages(async (stage) => {
    const startedAt = performance.now();
    const { code, output } = await capture(vp, ["run", stageTask(stage, process.env)], root);
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    appendFileSync(logPath, `\n===== ${stage} (exit ${code}, ${seconds}s) =====\n${output}`);
    console.log(`${code === 0 ? "ok  " : "FAIL"} ${stage} (${seconds}s)`);
    if (code !== 0) {
      console.log(`----- ${stage}: last ${FAILURE_TAIL_LINES} lines -----`);
      console.log(tail(output, FAILURE_TAIL_LINES));
      console.log("-----");
    }
    return code === 0;
  });

  const summary = summaryLine(results, LOG_FILE);
  if (summary === "VERIFY: PASS") {
    // After the stages: `format` may have rewritten files, and the stamp covers the result.
    const tree = workingTreeHash(root);
    writeVerifyStamp(root, { tree, verifiedAt: new Date().toISOString() });
    if (tree !== headTreeHash(root)) {
      console.log("note uncommitted changes (formatter output?): commit them before pushing");
    }
  }
  console.log(summary);
  if (summary !== "VERIFY: PASS") process.exitCode = 1;
}

if (import.meta.main) await main();
