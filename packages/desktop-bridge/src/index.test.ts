import { describe, expect, it } from "vite-plus/test";
import { type PageMessage, pageMessageData, readPageMessage } from "./index.ts";

describe("page messages", () => {
  it.each<PageMessage>([
    { kind: "port" },
    { kind: "gone" },
    { kind: "stopped" },
    { kind: "failed", failure: { state: "migrationFailed", migration: "time/0002" } },
    { kind: "failed", failure: { state: "databaseNewer", migration: "finance/0007" } },
  ])("reads back what the preload sends: %j", (message) => {
    expect(readPageMessage(pageMessageData(message))).toEqual(message);
  });

  it.each([
    ["another string", "self-engine:data-port"],
    ["null", null],
    ["another type", { type: "other", kind: "port" }],
    ["an unknown kind", { type: "self-engine:data-process", kind: "restart" }],
    [
      "a failure that is no failure state",
      { type: "self-engine:data-process", kind: "failed", failure: { state: "ready" } },
    ],
    [
      "a failure without its migration",
      { type: "self-engine:data-process", kind: "failed", failure: { state: "databaseNewer" } },
    ],
  ])("ignores %s", (_case, data) => {
    expect(readPageMessage(data)).toBeUndefined();
  });
});
