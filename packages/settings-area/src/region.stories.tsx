import type { JsonValue, LocalSettingsStorage, SettingsStore } from "@self-engine/settings";
import {
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  WEEK_START_SETTING,
} from "@self-engine/time/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { storyViewPage } from "./story-page.tsx";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

interface Loaded {
  readonly storage: LocalSettingsStorage;
  readonly store: SettingsStore;
  readonly Page: ComponentType;
}

/**
 * The rows of the region on "Language and region". The device's zone is Europe/Berlin and "now"
 * is in November, so Berlin is at UTC+1 (`story-page.tsx`).
 */
const meta = {
  title: "Settings area/Language and region",
  loaders: [
    async ({ parameters }): Promise<Loaded> => {
      const storage = memoryStorage();
      const store = await loadedStoreOn(storage);
      const stored = (parameters["stored"] ?? {}) as Record<string, JsonValue>;
      if ("zone" in stored) store.write(TIME_ZONE_SETTING, stored["zone"] as string);
      if ("followDevice" in stored) store.write(FOLLOW_DEVICE_ZONE_SETTING, true);
      if ("weekStart" in stored) {
        store.write(WEEK_START_SETTING, stored["weekStart"] as typeof WEEK_START_SETTING.default);
      }
      return { storage, store, Page: storyViewPage("language", { store }) };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as Loaded;
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const picker = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("combobox", { name: "Time Zone" });

/** The options of the open picker, as the listbox shows them. */
const options = () => within(screen.getByRole("listbox")).getAllByRole("option");

/** Nothing set: the picker shows the device's zone, the week start follows the region. */
export const TheRows: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    await expect(picker(canvas)).toHaveValue("Berlin (UTC+1)");
    await expect(picker(canvas)).toBeEnabled();
    await expect(canvas.getByRole("switch", { name: "Follow Device" })).not.toBeChecked();
    const group = canvas.getByRole("radiogroup", { name: "Week Start" });
    await expect(
      [...group.querySelectorAll(".mantine-SegmentedControl-label")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Automatic", "Monday", "Sunday", "Saturday"]);
    const weekStart = within(group);
    await expect(weekStart.getByRole("radio", { name: "Automatic" })).toBeChecked();
    // Showing the device's zone wrote nothing: the Time Zone stays "not set".
    await expect(store.read(TIME_ZONE_SETTING)).toBeNull();
  },
};

/** The open picker narrowed by a search, then a pick that writes the zone's name. */
export const PickAZoneWithASearch: Story = {
  play: async ({ canvas, loaded }) => {
    const { storage, store } = loaded as Loaded;
    await userEvent.click(picker(canvas));
    await waitFor(() => expect(options().length).toBeGreaterThan(300));
    await expect(screen.getByRole("option", { name: "UTC (UTC+0)" })).toBeInTheDocument();

    await userEvent.clear(picker(canvas));
    await userEvent.type(picker(canvas), "Berlin");
    await waitFor(() =>
      expect(options().map((option) => option.textContent)).toEqual(["Berlin (UTC+1)"]),
    );

    await userEvent.clear(picker(canvas));
    await userEvent.type(picker(canvas), "+1");
    await waitFor(() => expect(options().length).toBeLessThan(150));
    await expect(screen.getByRole("option", { name: "Berlin (UTC+1)" })).toBeInTheDocument();
    await expect(screen.queryByRole("option", { name: "UTC (UTC+0)" })).toBeNull();

    await userEvent.clear(picker(canvas));
    await userEvent.type(picker(canvas), "Tokyo");
    await userEvent.click(await screen.findByRole("option", { name: "Tokyo (UTC+9)" }));
    await expect(store.read(TIME_ZONE_SETTING)).toBe("Asia/Tokyo");
    await expect(picker(canvas)).toHaveValue("Tokyo (UTC+9)");
    await waitFor(async () => {
      await expect((await loadedStoreOn(storage)).read(TIME_ZONE_SETTING)).toBe("Asia/Tokyo");
    });
  },
};

/** With "follow device" on, the picker shows the zone and cannot be changed. */
export const FollowDeviceOn: Story = {
  parameters: { stored: { zone: "America/New_York", followDevice: true } },
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    await expect(canvas.getByRole("switch", { name: "Follow Device" })).toBeChecked();
    await expect(picker(canvas)).toHaveValue("New York (UTC-5)");
    await expect(picker(canvas)).toBeDisabled();

    await userEvent.click(canvas.getByRole("switch", { name: "Follow Device" }));
    await expect(store.read(FOLLOW_DEVICE_ZONE_SETTING)).toBe(false);
    await expect(picker(canvas)).toBeEnabled();
  },
};

/** A stored zone in another spelling than the runtime's stands in the list as it is stored. */
export const AStoredAlias: Story = {
  parameters: { stored: { zone: "Asia/Calcutta" } },
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    await expect(picker(canvas)).toHaveValue("Calcutta (UTC+5:30)");
    await userEvent.click(picker(canvas));
    await userEvent.clear(picker(canvas));
    await userEvent.type(picker(canvas), "+5:30");
    await waitFor(() =>
      expect(options().map((option) => option.textContent)).toContain("Calcutta (UTC+5:30)"),
    );
    await expect(
      options().filter((option) => /^(Calcutta|Kolkata) /.test(option.textContent ?? "")),
    ).toHaveLength(1);
    await expect(store.read(TIME_ZONE_SETTING)).toBe("Asia/Calcutta");
  },
};

/** A stored day the row does not offer shows as it is and stays stored until another is chosen. */
export const AStoredDayTheRowDoesNotOffer: Story = {
  parameters: { stored: { weekStart: "wednesday" } },
  play: async ({ canvas, loaded }) => {
    const { storage, store } = loaded as Loaded;
    await expect(canvas.getByRole("radio", { name: "Wednesday" })).toBeChecked();
    await expect(store.read(WEEK_START_SETTING)).toBe("wednesday");
    await waitFor(async () => {
      await expect((await loadedStoreOn(storage)).read(WEEK_START_SETTING)).toBe("wednesday");
    });

    await userEvent.click(canvas.getByRole("radio", { name: "Monday" }));
    await expect(store.read(WEEK_START_SETTING)).toBe("monday");
    await expect(canvas.queryByRole("radio", { name: "Wednesday" })).toBeNull();
  },
};

/** The settings search finds the three rows, and the Time Zone by a zone's place. */
export const FoundByTheSearch: Story = {
  play: async ({ canvas }) => {
    const search = canvas.getByRole("searchbox", { name: "Search settings" });
    await userEvent.type(search, "Buenos Aires");
    await expect(await canvas.findByRole("combobox", { name: "Time Zone" })).toBeVisible();
    await expect(canvas.queryByRole("switch", { name: "Follow Device" })).toBeNull();

    await userEvent.clear(search);
    await userEvent.type(search, "follow device");
    await expect(await canvas.findByRole("switch", { name: "Follow Device" })).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "first day");
    await expect(await canvas.findByRole("radiogroup", { name: "Week Start" })).toBeVisible();
  },
};

/** In German: the rows' titles and the days in the catalog's words. */
export const InGerman: Story = {
  globals: { language: "de" },
  parameters: { stored: { weekStart: "thursday" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Zeitzone" })).toHaveValue("Berlin (UTC+1)");
    await expect(canvas.getByRole("switch", { name: "Gerät folgen" })).toBeInTheDocument();
    const weekStart = within(canvas.getByRole("radiogroup", { name: "Wochenstart" }));
    await expect(weekStart.getByRole("radio", { name: "Donnerstag" })).toBeChecked();
    await expect(weekStart.getByRole("radio", { name: "Automatisch" })).not.toBeChecked();
  },
};
