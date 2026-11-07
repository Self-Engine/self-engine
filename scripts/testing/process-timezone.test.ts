import { describe, expect, it } from "vite-plus/test";
import { TEST_TIME_ZONE, testTimeZone } from "./process-timezone.ts";

// Guards the fixed process timezone of the test runs (vite.config.ts): if the runtime ignored
// it, every suite would silently run in the timezone of the machine again.

describe("the test process timezone", () => {
  it("is the configured zone, not the machine's", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(testTimeZone());
  });

  it.runIf(testTimeZone() === TEST_TIME_ZONE)("puts local dates on Chatham time", () => {
    // 15:00 UTC on 24 August is 03:45 on 25 August in Chatham (UTC+12:45).
    const date = new Date("2026-08-24T15:00:00Z");
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([25, 3, 45]);
  });
});

describe("testTimeZone", () => {
  it("defaults to Chatham", () => {
    expect(testTimeZone({})).toBe("Pacific/Chatham");
  });

  it("follows VITEST_TZ when it is set", () => {
    expect(testTimeZone({ VITEST_TZ: "America/Los_Angeles" })).toBe("America/Los_Angeles");
    expect(testTimeZone({ VITEST_TZ: "" })).toBe("Pacific/Chatham");
  });
});
