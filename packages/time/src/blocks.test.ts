import { describe, expect, test } from "vite-plus/test";
import {
  endOfBlock,
  instantSchema,
  resolveTimeZone,
  startOfBlock,
  wholeMinuteOf,
} from "./index.ts";

const at = (text: string) => instantSchema.parse(text);
const zone = (name: string) => resolveTimeZone(name).timeZone;
const berlin = zone("Europe/Berlin");
const kathmandu = zone("Asia/Kathmandu");

describe("wholeMinuteOf", () => {
  test("cuts seconds and milliseconds toward the past", () => {
    expect(wholeMinuteOf(at("2026-03-02T10:07:30.500Z"))).toBe("2026-03-02T10:07:00.000Z");
  });

  test("keeps an Instant on a whole minute", () => {
    expect(wholeMinuteOf(at("2026-03-02T10:07:00.000Z"))).toBe("2026-03-02T10:07:00.000Z");
  });
});

describe("the Blocks of the clock", () => {
  test("an Instant lies in the Block that starts on the clock's step before it", () => {
    const instant = at("2026-03-02T09:07:30.000Z"); // 10:07:30 in Berlin
    expect(startOfBlock(instant, 15, berlin)).toBe("2026-03-02T09:00:00.000Z");
    expect(endOfBlock(instant, 15, berlin)).toBe("2026-03-02T09:15:00.000Z");
  });

  test("an Instant on a border starts its Block and ends the one before", () => {
    const instant = at("2026-03-02T09:15:00.000Z");
    expect(startOfBlock(instant, 15, berlin)).toBe(instant);
    expect(endOfBlock(instant, 15, berlin)).toBe(instant);
  });

  test("Blocks follow the clock of a Time Zone whose offset is no whole hour", () => {
    // 10:07:30 in Kathmandu (UTC+5:45); its hour runs from 10:00 to 11:00 there.
    const instant = at("2026-03-02T04:22:30.000Z");
    expect(startOfBlock(instant, 60, kathmandu)).toBe("2026-03-02T04:15:00.000Z");
    expect(endOfBlock(instant, 60, kathmandu)).toBe("2026-03-02T05:15:00.000Z");
    expect(startOfBlock(instant, 30, kathmandu)).toBe("2026-03-02T04:15:00.000Z");
    expect(endOfBlock(instant, 30, kathmandu)).toBe("2026-03-02T04:45:00.000Z");
  });

  test("the hour the clocks repeat holds two Blocks of an hour each", () => {
    // Berlin on 25 October 2026: 02:00 – 03:00 runs once in summer time, once in winter time.
    const firstTwoThirty = at("2026-10-25T00:30:00.000Z");
    const secondTwoThirty = at("2026-10-25T01:30:00.000Z");
    expect(startOfBlock(firstTwoThirty, 60, berlin)).toBe("2026-10-25T00:00:00.000Z");
    expect(endOfBlock(firstTwoThirty, 60, berlin)).toBe("2026-10-25T01:00:00.000Z");
    expect(startOfBlock(secondTwoThirty, 60, berlin)).toBe("2026-10-25T01:00:00.000Z");
    expect(endOfBlock(secondTwoThirty, 60, berlin)).toBe("2026-10-25T02:00:00.000Z");
  });

  test("a step that does not divide the hour is refused", () => {
    // @ts-expect-error -- 7 minutes are no Block of the clock.
    expect(() => startOfBlock(at("2026-03-02T09:07:30.000Z"), 7, berlin)).toThrow(RangeError);
  });
});
