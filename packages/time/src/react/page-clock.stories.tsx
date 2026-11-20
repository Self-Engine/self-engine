import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { alwaysVisible, fixedClock, requireInstant } from "../testing.ts";
import { resolveTimeZone } from "../zone.ts";
import { ClockReadout } from "./example/clock-readout.tsx";
import { PageClockProvider } from "./page-clock.tsx";

/** 22:30:15 UTC, already the 21st in Bangkok. */
const clock = fixedClock(requireInstant("2026-11-20T22:30:15.000Z"));

const meta = {
  title: "Time/Page Clock",
  component: ClockReadout,
  args: { timeZone: resolveTimeZone("Asia/Bangkok").timeZone },
  decorators: [
    (Story) => (
      <PageClockProvider clock={clock} visibility={alwaysVisible}>
        <Story />
      </PageClockProvider>
    ),
  ],
} satisfies Meta<typeof ClockReadout>;

export default meta;

/** A View with "now" and "today" renders the same every time under a fixed Clock. */
export const FixedClock: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Now 2026-11-20T22:30:15.000Z, today 2026-11-21")).toBeVisible();
  },
};
