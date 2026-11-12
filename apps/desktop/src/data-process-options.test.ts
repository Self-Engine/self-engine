import { afterEach, expect, test, vi } from "vite-plus/test";
import type { DataProcessOptions } from "@self-engine/data-process";
type FrameReport = Parameters<NonNullable<DataProcessOptions["report"]>>[0];

const identity = vi.hoisted(() => ({ channel: "dev" }));
vi.mock("./build-channel.ts", () => ({ buildIdentity: identity }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

test.each(["dev", "stable", "nightly"])(
  "frame diagnostics reach the console only in %s development",
  async (channel) => {
    identity.channel = channel;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { dataProcessOptions } = await import("./data-process-options.ts");
    const unexpected: FrameReport = {
      kind: "unexpected-error",
      entry: "create",
      error: new Error("Failed"),
    };
    const large: FrameReport = { kind: "large-result", entry: "list", rows: 1000 };
    dataProcessOptions.report?.(unexpected);
    dataProcessOptions.report?.(large);
    expect(error.mock.calls).toEqual(channel === "dev" ? [[unexpected]] : []);
    expect(warn.mock.calls).toEqual(channel === "dev" ? [[large]] : []);
  },
);
