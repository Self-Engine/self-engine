import { resolveTimeZone } from "@self-engine/time";
import { TimeSettingsProvider, useFirstDayOfWeek, useTimeZone } from "@self-engine/time/react";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { isValidElement } from "react";
import { expect } from "storybook/test";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

function RegionReadout() {
  return (
    <p>
      {useTimeZone()} / {useFirstDayOfWeek()}
    </p>
  );
}

const meta = {
  title: "Settings area/Time Settings",
  loaders: [
    async () => {
      const store = await loadedStoreOn(memoryStorage());
      store.write(TIME_ZONE_SETTING, "Europe/Berlin");
      store.write(WEEK_START_SETTING, "saturday");
      const deviceZone = resolveTimeZone("America/New_York").timeZone;

      return {
        view: (
          <TimeSettingsProvider
            store={store}
            deviceZone={deviceZone}
            region="en-US"
            onError={(error) => {
              throw error;
            }}
          >
            <RegionReadout />
          </TimeSettingsProvider>
        ),
      };
    },
  ],
  render: (_args, { loaded }) => {
    const view: unknown = loaded["view"];
    if (!isValidElement(view)) throw new Error("Time Settings story has no loaded View");
    return view;
  },
} satisfies Meta;

export default meta;

export const FixedSettings: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Europe/Berlin / saturday")).toBeVisible();
  },
};
