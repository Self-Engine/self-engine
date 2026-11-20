import {
  createSettingsStore,
  type JsonValue,
  type SettingDeclaration,
  type SettingScope,
} from "@self-engine/settings";
import { createTestAdapter, settle } from "@self-engine/settings/testing";
import {
  FOLLOW_DEVICE_ZONE_SETTING,
  reportEachNameOnce,
  type ResolvedTimeZoneSetting,
  resolveTimeZoneSetting,
  resolveWeekStart,
  TIME_ZONE_SETTING,
  type WeekStart,
  WEEK_START_SETTING,
  ZONE_OFFER_DISMISSED_SETTING,
} from "@self-engine/time/settings";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { type FirstDayOfWeek, resolveTimeZone, type TimeZone } from "../index.ts";

const ignoreStorageErrors = () => {};

/** A loaded store whose adapters hold `stored`, each in the scope it belongs to. */
async function storeHolding(
  stored: {
    readonly synced?: Record<string, JsonValue>;
    readonly device?: Record<string, JsonValue>;
  } = {},
) {
  const adapters: Record<SettingScope, ReturnType<typeof createTestAdapter>> = {
    synced: createTestAdapter(stored.synced),
    device: createTestAdapter(stored.device),
  };
  const store = createSettingsStore({ adapters, onError: ignoreStorageErrors });
  await store.load();
  return { store, adapters };
}

const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BANGKOK = zone("Asia/Bangkok");

describe("the declarations", () => {
  it.each([
    ["the Time Zone", TIME_ZONE_SETTING, "time.zone", "synced", null],
    ["follow device", FOLLOW_DEVICE_ZONE_SETTING, "time.followDevice", "device", false],
    ["the week start", WEEK_START_SETTING, "time.weekStart", "synced", "automatic"],
    [
      "zone offer dismissed",
      ZONE_OFFER_DISMISSED_SETTING,
      "time.zoneOfferDismissed",
      "device",
      false,
    ],
  ] as const)("declare %s as %s, %s, default %j", (_name, setting, key, scope, fallback) => {
    expect(setting.key).toBe(key);
    expect(setting.scope).toBe(scope);
    expect(setting.default).toBe(fallback);
  });

  it("keep the scope in the type, so only the Synced ones reach the Data Process", () => {
    expectTypeOf(TIME_ZONE_SETTING).toEqualTypeOf<SettingDeclaration<string | null, "synced">>();
    expectTypeOf(FOLLOW_DEVICE_ZONE_SETTING).toEqualTypeOf<SettingDeclaration<boolean, "device">>();
    expectTypeOf(WEEK_START_SETTING).toEqualTypeOf<SettingDeclaration<WeekStart, "synced">>();
    expectTypeOf(ZONE_OFFER_DISMISSED_SETTING).toEqualTypeOf<
      SettingDeclaration<boolean, "device">
    >();
    expectTypeOf<WeekStart>().toEqualTypeOf<"automatic" | FirstDayOfWeek>();
  });
});

describe("a store", () => {
  it("reads the defaults when nothing is stored", async () => {
    const { store } = await storeHolding();
    expect(store.read(TIME_ZONE_SETTING)).toBeNull();
    expect(store.read(FOLLOW_DEVICE_ZONE_SETTING)).toBe(false);
    expect(store.read(WEEK_START_SETTING)).toBe("automatic");
    expect(store.read(ZONE_OFFER_DISMISSED_SETTING)).toBe(false);
  });

  it("writes each Setting into its own scope and reads it back", async () => {
    const { store, adapters } = await storeHolding();

    store.write(TIME_ZONE_SETTING, "Asia/Calcutta");
    store.write(FOLLOW_DEVICE_ZONE_SETTING, true);
    store.write(WEEK_START_SETTING, "saturday");
    store.write(ZONE_OFFER_DISMISSED_SETTING, true);
    await settle();

    expect(adapters.synced.stored).toEqual(
      new Map<string, JsonValue>([
        ["time.zone", "Asia/Calcutta"],
        ["time.weekStart", "saturday"],
      ]),
    );
    expect(adapters.device.stored).toEqual(
      new Map<string, JsonValue>([
        ["time.followDevice", true],
        ["time.zoneOfferDismissed", true],
      ]),
    );
    expect(store.read(TIME_ZONE_SETTING)).toBe("Asia/Calcutta");
    expect(store.read(WEEK_START_SETTING)).toBe("saturday");
  });

  it("writes null back when the Time Zone is no longer set", async () => {
    const { store, adapters } = await storeHolding({ synced: { "time.zone": "Europe/Berlin" } });
    store.write(TIME_ZONE_SETTING, null);
    await settle();
    expect(adapters.synced.stored.get("time.zone")).toBeNull();
    expect(store.read(TIME_ZONE_SETTING)).toBeNull();
  });

  it.each(["+02:00", "-05:00", "2026-11-20T10:00[Europe/Berlin]", "", "Europe/"])(
    "refuses to write %j as a Time Zone",
    async (value) => {
      const { store } = await storeHolding();
      expect(() => store.write(TIME_ZONE_SETTING, value)).toThrow(/time\.zone/);
    },
  );

  it.each([
    ["an offset", "time.zone", "+02:00"],
    ["a number", "time.zone", 5],
  ])("reads %s stored as the Time Zone as not set", async (_name, key, value) => {
    const { store } = await storeHolding({ synced: { [key]: value } });
    expect(store.read(TIME_ZONE_SETTING)).toBeNull();
  });

  it("keeps a zone name this runtime does not know, for the resolver's fallback", async () => {
    const { store } = await storeHolding({ synced: { "time.zone": "Mars/Olympus_Mons" } });
    expect(store.read(TIME_ZONE_SETTING)).toBe("Mars/Olympus_Mons");
  });

  it.each([
    ["the week start", WEEK_START_SETTING, "time.weekStart", "fortnightly"],
    ["the week start", WEEK_START_SETTING, "time.weekStart", 1],
    ["the Time Zone", TIME_ZONE_SETTING, "time.zone", { name: "Europe/Berlin" }],
  ] as const)(
    "shows %s of a newer version (%j) as the default and leaves it stored",
    async (_name, setting, key, value) => {
      const { store, adapters } = await storeHolding({ synced: { [key]: value } });

      expect(store.read(setting as SettingDeclaration<JsonValue>)).toBe(setting.default);
      store.write(ZONE_OFFER_DISMISSED_SETTING, true);
      await settle();

      expect(adapters.synced.saves).toEqual([]);
      expect(adapters.synced.stored.get(key)).toEqual(value);
    },
  );

  it("shows follow device of a newer version as the default and leaves it stored on the device", async () => {
    const { store, adapters } = await storeHolding({
      device: { "time.followDevice": "sometimes" },
    });

    expect(store.read(FOLLOW_DEVICE_ZONE_SETTING)).toBe(false);
    store.write(WEEK_START_SETTING, "sunday");
    await settle();

    expect(adapters.device.saves).toEqual([]);
    expect(adapters.device.stored.get("time.followDevice")).toBe("sometimes");
  });
});

describe("resolving the Time Zone", () => {
  it("resolves a known name to itself", () => {
    expect(resolveTimeZoneSetting("Europe/Berlin", BANGKOK)).toEqual({
      timeZone: "Europe/Berlin",
      fallback: "none",
    });
  });

  it("keeps the spelling of an alias", () => {
    expect(resolveTimeZoneSetting("Asia/Calcutta", BANGKOK)).toEqual({
      timeZone: "Asia/Calcutta",
      fallback: "none",
    });
  });

  it("gives the device's zone when the Setting is not set, and says so", () => {
    expect(resolveTimeZoneSetting(null, BANGKOK)).toEqual({
      timeZone: BANGKOK,
      fallback: "notSet",
    });
  });

  it("gives the device's zone for a name the runtime does not know, and says so", () => {
    expect(resolveTimeZoneSetting("Mars/Olympus_Mons", BANGKOK)).toEqual({
      timeZone: BANGKOK,
      fallback: "unknownName",
      name: "Mars/Olympus_Mons",
    });
  });

  it("gives the device's zone for text that is no zone name, instead of throwing", () => {
    expect(resolveTimeZoneSetting("+02:00", BANGKOK)).toEqual({
      timeZone: BANGKOK,
      fallback: "unknownName",
      name: "+02:00",
    });
  });

  it("answers with a TimeZone", () => {
    expectTypeOf(resolveTimeZoneSetting).parameters.toEqualTypeOf<[string | null, TimeZone]>();
    expectTypeOf(resolveTimeZoneSetting(null, BANGKOK).timeZone).toEqualTypeOf<TimeZone>();
  });

  it("carries the stored name only where the name is unknown, and the type proves it", () => {
    expectTypeOf<ResolvedTimeZoneSetting>().toEqualTypeOf<
      | { readonly timeZone: TimeZone; readonly fallback: "none" | "notSet" }
      | { readonly timeZone: TimeZone; readonly fallback: "unknownName"; readonly name: string }
    >();
  });
});

describe("reporting each unknown name once", () => {
  it("passes each name on the first time only", () => {
    const told: string[] = [];
    const report = reportEachNameOnce((name) => told.push(name));
    report("Future/City");
    report("Future/Other");
    report("Future/City");
    expect(told).toEqual(["Future/City", "Future/Other"]);
  });

  it("keeps a name it passed on when the report throws, so it does not throw again", () => {
    let calls = 0;
    const report = reportEachNameOnce(() => {
      calls += 1;
      throw new Error("report failed");
    });
    expect(() => report("Future/City")).toThrow("report failed");
    report("Future/City");
    expect(calls).toBe(1);
  });
});

describe("resolving the week start", () => {
  it.each([
    ["de-DE", "monday"],
    ["en-US", "sunday"],
  ] as const)("gives the first day of %s for automatic: %s", (region, day) => {
    expect(resolveWeekStart("automatic", region)).toBe(day);
  });

  it.each(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const)(
    "gives %s for itself, whatever the region",
    (day) => {
      expect(resolveWeekStart(day, "de-DE")).toBe(day);
      expect(resolveWeekStart(day, "en-US")).toBe(day);
    },
  );

  it("takes only a region whose first day it knows", () => {
    // @ts-expect-error A region without an entry in the table is refused at compile time.
    resolveWeekStart("automatic", "fr-FR");
  });
});
