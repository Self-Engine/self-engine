import { createSettingsStore, type SettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING, ZONE_OFFER_DISMISSED_SETTING } from "@self-engine/time/settings";
import { clearNotices } from "@self-engine/ui/story-notices";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { watchDeviceZone } from "./device-zone.tsx";
import { DeviceZoneOffer } from "./device-zone-offer.tsx";

const BANGKOK: TimeZone = resolveTimeZone("Asia/Bangkok").timeZone;
/** The device of every story is in Bangkok, whatever the browser running it says. */
const inBangkok = watchDeviceZone(document, () => BANGKOK);

/** The story's store: the Time Zone stored in Berlin, as a trip to Bangkok finds it. */
let store: SettingsStore;

async function storedInBerlin() {
  clearNotices();
  store = createSettingsStore({
    adapters: {
      synced: createTestAdapter({ "time.zone": "Europe/Berlin" }),
      device: createTestAdapter(),
    },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
}

const meta = {
  title: "App/Device zone offer",
  beforeEach: storedInBerlin,
  render: () => <DeviceZoneOffer store={store} device={inBangkok} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const OFFER =
  "This device is in the time zone Asia/Bangkok. Switch from Europe/Berlin to Asia/Bangkok?";

async function noticeWith(text: string) {
  const notice = (await screen.findByText(text)).closest<HTMLElement>(
    '[role="alert"], [role="status"]',
  );
  if (notice === null) throw new Error(`"${text}" is not in a notice`);
  return within(notice);
}

const noticeGone = (text: string) => waitFor(() => expect(screen.queryByText(text)).toBeNull());

export const TheOfferNamesBothZones: Story = {
  play: async () => {
    const notice = await noticeWith(OFFER);
    await expect(notice.getByRole("button", { name: "Switch" })).toBeVisible();
    await expect(notice.getByRole("button", { name: "Don't ask again" })).toBeVisible();
  },
};

export const TheOfferNamesBothZonesInGerman: Story = {
  globals: { language: "de" },
  play: async () => {
    const notice = await noticeWith(
      "Dieses Gerät ist in der Zeitzone Asia/Bangkok. Von Europe/Berlin auf Asia/Bangkok umstellen?",
    );
    await expect(notice.getByRole("button", { name: "Umstellen" })).toBeVisible();
    await expect(notice.getByRole("button", { name: "Nicht mehr fragen" })).toBeVisible();
  },
};

export const SwitchStoresTheDeviceZoneAndOffersToUndoIt: Story = {
  play: async () => {
    await userEvent.click((await noticeWith(OFFER)).getByRole("button", { name: "Switch" }));
    await noticeGone(OFFER);
    await expect(store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");

    const confirmation = await noticeWith("The time zone is now Asia/Bangkok.");
    await userEvent.click(confirmation.getByRole("button", { name: "Undo" }));
    await expect(store.read(TIME_ZONE_SETTING)).toBe("Europe/Berlin");
  },
};

export const DontAskAgainStoresItOnThisDevice: Story = {
  play: async () => {
    await userEvent.click(
      (await noticeWith(OFFER)).getByRole("button", { name: "Don't ask again" }),
    );
    await noticeGone(OFFER);
    await expect(store.read(ZONE_OFFER_DISMISSED_SETTING)).toBe(true);
    await expect(store.read(TIME_ZONE_SETTING)).toBe("Europe/Berlin");
  },
};
