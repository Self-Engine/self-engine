import { newId, type IdSources } from "@self-engine/db";
import type { JsonValue, SettingDeclaration } from "@self-engine/settings";
import { readSetting, type SettingsReader } from "@self-engine/settings-rows";
import type { SpaceId } from "@self-engine/spaces";
import type { Clock, Instant, TimeZone } from "@self-engine/time";
import { resolveTimeZoneSetting, TIME_ZONE_SETTING } from "@self-engine/time/settings";
import type { z } from "zod";
import type { ProtectionRules } from "./registry.ts";

/** What a frame builds each call's context from, set once per Data Process. */
export interface ContextSources {
  readonly clock: Clock;
  readonly ids: IdSources;
  /**
   * The Space of every call: the Personal Space the Data Process made sure of at its start. A
   * test takes a fixed one from `@self-engine/spaces/testing`.
   */
  readonly spaceId: SpaceId;
  /** Every Protection Rule of the Data Process; a write path asks them before it writes. */
  readonly rules: ProtectionRules;
  /**
   * The zone the device runs in, handed in like the clock (ADR 0027): the app's composition
   * passes the runtime's, a test a fixed one. It stands in for a Time Zone that is not set or
   * that this runtime does not know.
   */
  readonly deviceZone: () => TimeZone;
  /**
   * Told the stored name of a Time Zone this runtime does not know, at every call that read it.
   * The Data Process reports each name once per start (D353).
   */
  readonly unknownTimeZone: (name: string) => void;
}

export interface StorageContext {
  readonly now: Instant;
  readonly clock: Clock;
  readonly spaceId: SpaceId;
  /** The rules the write paths ask; a Bridge builds its context with the same ones (D332). */
  readonly rules: ProtectionRules;
  /** The schema supplies the entity brand; generation never needs a cast in module code. */
  newId<Schema extends z.ZodType<string>>(schema: Schema): z.output<Schema>;
  /**
   * A Synced Setting of the call's Space, read through the call's `tx` (D352): the stored value
   * if it passes the declaration's schema, otherwise the declared default. Never writes. A Query
   * that reads one names `SETTINGS_TABLE` among its reads; the contract kit fails it otherwise.
   * A Device Setting does not compile: it stays on its device.
   */
  readSetting<DB, T extends JsonValue>(
    tx: SettingsReader<DB>,
    setting: SettingDeclaration<T, "synced">,
  ): Promise<T>;
  /**
   * The Time Zone of the call (D353): the Setting read through the call's `tx` and resolved by
   * `time`. The device's zone stands in while none is set and for a name this runtime does not
   * know; the Setting stays as it is. A Query that asks for it names `SETTINGS_TABLE` among its
   * reads, as for `readSetting`.
   */
  readTimeZone<DB>(tx: SettingsReader<DB>): Promise<TimeZone>;
}

export function createContext(sources: ContextSources): StorageContext {
  const moment = sources.clock();
  const clock: Clock = () => moment;
  const ids: IdSources = { clock, random: sources.ids.random };
  return {
    now: moment,
    clock,
    spaceId: sources.spaceId,
    rules: sources.rules,
    newId: <Schema extends z.ZodType<string>>(_schema: Schema): z.output<Schema> =>
      newId<z.output<Schema>>(ids),
    readSetting: (tx, setting) => readSetting(tx, sources.spaceId, setting),
    async readTimeZone(tx) {
      const name = await readSetting(tx, sources.spaceId, TIME_ZONE_SETTING);
      const resolved = resolveTimeZoneSetting(name, sources.deviceZone());
      if (resolved.fallback === "unknownName") sources.unknownTimeZone(resolved.name);
      return resolved.timeZone;
    },
  };
}
