import { decideZoneOffer, type ZoneOfferDecision } from "@self-engine/time/settings";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { resolveTimeZone, type TimeZone } from "../index.ts";

const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BERLIN = zone("Europe/Berlin");
const KOLKATA = zone("Asia/Kolkata");

describe("the offer to switch to the device's zone", () => {
  // Every combination of the four inputs: the stored zone against the device's (another, the
  // same, the same under another name, not set, unknown to this runtime), "follow device" and
  // "dismissed".
  it.each([
    // stored,              device,  follow, dismissed, decision
    ["Europe/Berlin", KOLKATA, false, false, "offer"],
    ["Europe/Berlin", KOLKATA, false, true, "nothing"],
    ["Europe/Berlin", KOLKATA, true, false, "follow"],
    ["Europe/Berlin", KOLKATA, true, true, "follow"],
    ["Europe/Berlin", BERLIN, false, false, "nothing"],
    ["Europe/Berlin", BERLIN, false, true, "nothing"],
    ["Europe/Berlin", BERLIN, true, false, "nothing"],
    ["Europe/Berlin", BERLIN, true, true, "nothing"],
    ["Asia/Calcutta", KOLKATA, false, false, "nothing"],
    ["Asia/Calcutta", KOLKATA, false, true, "nothing"],
    ["Asia/Calcutta", KOLKATA, true, false, "nothing"],
    ["Asia/Calcutta", KOLKATA, true, true, "nothing"],
    [null, KOLKATA, false, false, "nothing"],
    [null, KOLKATA, false, true, "nothing"],
    [null, KOLKATA, true, false, "nothing"],
    [null, KOLKATA, true, true, "nothing"],
    ["Mars/Olympus_Mons", KOLKATA, false, false, "nothing"],
    ["Mars/Olympus_Mons", KOLKATA, false, true, "nothing"],
    ["Mars/Olympus_Mons", KOLKATA, true, false, "nothing"],
    ["Mars/Olympus_Mons", KOLKATA, true, true, "nothing"],
  ] as const)(
    "stored %j, device %s, follow %s, dismissed %s: %s",
    (stored, device, followDevice, dismissed, kind) => {
      expect(decideZoneOffer({ stored, device, followDevice, dismissed }).kind).toBe(kind);
    },
  );

  it("names both zones in an offer, and the stored name exactly as it was stored", () => {
    expect(
      decideZoneOffer({
        stored: "europe/berlin",
        device: KOLKATA,
        followDevice: false,
        dismissed: false,
      }),
    ).toEqual({ kind: "offer", stored: BERLIN, storedName: "europe/berlin", device: KOLKATA });
  });

  it("names the device's zone to follow", () => {
    expect(
      decideZoneOffer({
        stored: "Europe/Berlin",
        device: KOLKATA,
        followDevice: true,
        dismissed: false,
      }),
    ).toEqual({ kind: "follow", device: KOLKATA });
  });

  it("answers with zones only where it offers or follows", () => {
    expectTypeOf<ZoneOfferDecision>().toEqualTypeOf<
      | { readonly kind: "nothing" }
      | {
          readonly kind: "offer";
          readonly stored: TimeZone;
          readonly storedName: string;
          readonly device: TimeZone;
        }
      | { readonly kind: "follow"; readonly device: TimeZone }
    >();
  });
});
