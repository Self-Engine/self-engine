// The Settings of the Time Zone and the week start, declared by `time`, which owns both values
// (D356). The page and the Data Process load this entry, so it holds only the declarations, small
// schemas of `zod/mini`, the two resolving functions and the decision about the offer to switch:
// no React, no Zod full build, no calendar arithmetic (the boundary check holds it). The main
// entry of `time` imports no repo package.

import { defineSetting } from "@self-engine/settings";
import { z } from "zod/mini";
import {
  type FirstDayOfWeek,
  firstDayOfWeekForRegion,
  firstDayOfWeekSchema,
  type Region,
} from "../first-day-of-week.ts";
import { NAME_SHAPE, resolveTimeZoneOr, sameTimeZone, type TimeZone } from "../zone.ts";

// Here as well as in the main entry, so that startup code compares zones without the schemas.
export { sameTimeZone };

/**
 * The user's Time Zone (D147): a zone name, or `null` while none is set. Open to names this
 * runtime does not know, so that a zone of a newer runtime stays stored; `resolveTimeZoneSetting`
 * falls back for it. Closed to offsets and other text, which read as `null`. The name keeps the
 * spelling it was chosen in (D282).
 */
export const TIME_ZONE_SETTING = defineSetting({
  key: "time.zone",
  scope: "synced",
  default: null,
  schema: z.nullable(z.string().check(z.regex(NAME_SHAPE))),
});

/** Whether the Time Zone follows the device without asking (D147). */
export const FOLLOW_DEVICE_ZONE_SETTING = defineSetting({
  key: "time.followDevice",
  scope: "synced",
  default: false,
  schema: z.boolean(),
});

/** The stored week start: `automatic` follows the region of the App Language (D355). */
export type WeekStart = "automatic" | FirstDayOfWeek;

export const WEEK_START_SETTING = defineSetting<WeekStart, "synced">({
  key: "time.weekStart",
  scope: "synced",
  default: "automatic",
  schema: z.union([z.literal("automatic"), firstDayOfWeekSchema]),
});

/** That this device no longer offers to switch to its zone (D147). */
export const ZONE_OFFER_DISMISSED_SETTING = defineSetting({
  key: "time.zoneOfferDismissed",
  scope: "device",
  default: false,
  schema: z.boolean(),
});

/**
 * Why the device's zone stands in, if it does: `notSet` while no zone is stored, `unknownName`
 * for a stored name this runtime does not know (the caller reports it, D353).
 */
export type TimeZoneFallback = "none" | "notSet" | "unknownName";

export interface ResolvedTimeZoneSetting {
  readonly timeZone: TimeZone;
  readonly fallback: TimeZoneFallback;
}

/**
 * The Time Zone the Setting's value gives. The device's zone is an argument, never asked of the
 * runtime here, because the Data Process gets it handed in as a source. Never throws.
 */
export function resolveTimeZoneSetting(
  value: string | null,
  deviceZone: TimeZone,
): ResolvedTimeZoneSetting {
  if (value === null) return { timeZone: deviceZone, fallback: "notSet" };
  if (!NAME_SHAPE.test(value)) return { timeZone: deviceZone, fallback: "unknownName" };
  const { timeZone, deviceFallback } = resolveTimeZoneOr(value, () => deviceZone);
  return { timeZone, fallback: deviceFallback ? "unknownName" : "none" };
}

/** The first day of the week the Setting's value gives: `automatic` takes the region's. */
export function resolveWeekStart(value: WeekStart, region: Region): FirstDayOfWeek {
  return value === "automatic" ? firstDayOfWeekForRegion(region) : value;
}

/** What the page knows when it asks whether to offer the device's zone (D147). */
export interface ZoneOfferInputs {
  /** The value of `TIME_ZONE_SETTING`. */
  readonly stored: string | null;
  /** The zone the device runs in now. */
  readonly device: TimeZone;
  /** The value of `FOLLOW_DEVICE_ZONE_SETTING`. */
  readonly followDevice: boolean;
  /** The value of `ZONE_OFFER_DISMISSED_SETTING` on this device. */
  readonly dismissed: boolean;
}

/**
 * `nothing`, the offer to switch from the stored zone to the device's, or to follow the device's
 * zone without a question.
 */
export type ZoneOfferDecision =
  | { readonly kind: "nothing" }
  | {
      readonly kind: "offer";
      /** The stored zone, resolved: for display and comparison. */
      readonly stored: TimeZone;
      /** The Setting's value exactly as it was stored (D282), to write it back. */
      readonly storedName: string;
      readonly device: TimeZone;
    }
  | { readonly kind: "follow"; readonly device: TimeZone };

const NOTHING: ZoneOfferDecision = { kind: "nothing" };

/**
 * Whether the device's zone is offered, followed, or neither (D147). Two names of one zone are
 * one zone. An unset zone makes no offer: it resolves to the device's zone already, and the Data
 * Process stores that at its start (D353). Nor does a name this runtime does not know: it is a
 * newer version's choice, which stays untouched (D353). One resolve and one comparison.
 */
export function decideZoneOffer({
  stored,
  device,
  followDevice,
  dismissed,
}: ZoneOfferInputs): ZoneOfferDecision {
  if (stored === null) return NOTHING;
  const { timeZone, fallback } = resolveTimeZoneSetting(stored, device);
  if (fallback !== "none" || sameTimeZone(timeZone, device)) return NOTHING;
  if (followDevice) return { kind: "follow", device };
  return dismissed ? NOTHING : { kind: "offer", stored: timeZone, storedName: stored, device };
}
