import { Button } from "@mantine/core";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/geometry";
import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellContribution, type ShellProps } from "./index.ts";
import { INDICATOR_MAX_WIDTH } from "./module-indicators.tsx";
import {
  appRegionOf,
  atFrameWidth,
  atViewport,
  type Canvas,
  collapseToggle,
  codeOnItsWay,
  CountingIndicator,
  countingIndicator,
  ENTRIES,
  freshPerRun,
  INDICATOR_ARRIVES,
  indicatorPlaceOf,
  momentShown,
  paneOf,
  SETTINGS,
  SHOWN_ON_ARRIVAL_MS,
  type Story,
  shellMeta,
  VIEWPORTS,
  widthOf,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Module Indicator",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

const projects = ENTRIES[0]!;
const time = ENTRIES[1]!;
const third = ENTRIES[2]!;

/** `projects` with an indicator; `time` is the active module of every story. */
const INDICATING: ShellContribution = { ...projects, indicator: countingIndicator() };
const WITH_INDICATOR = { contributions: [INDICATING, time, third] };

/** The content header, whatever the page title. */
const headerOf = (canvas: Canvas) =>
  canvas.getByRole("heading", { level: 1 }).parentElement!.parentElement!;

const fullForm = (canvas: Canvas) =>
  canvas.findByRole("button", { name: "Count up" }, INDICATOR_ARRIVES);

async function expectShortForm(canvas: Canvas) {
  const counter = await canvas.findByText("0", {}, INDICATOR_ARRIVES);
  await expect(counter).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "Count up" })).toBeNull();
}

const atStep = (viewport: keyof typeof VIEWPORTS, form: "full" | "short"): Story => ({
  ...atViewport(viewport),
  args: WITH_INDICATOR,
  play: async ({ canvas }) => {
    if (form === "full") await expect(await fullForm(canvas)).toBeVisible();
    else await expectShortForm(canvas);
    // In the content header, which keeps its height.
    const place = indicatorPlaceOf(canvas.getByText(form === "full" ? "Counted 0" : "0"));
    await expect(headerOf(canvas).contains(place)).toBe(true);
    await expect(Math.round(headerOf(canvas).getBoundingClientRect().height)).toBe(48);
  },
});

export const FullFormAtTheWideStep = atStep("wide", "full");
export const FullFormAtTheMediumStep = atStep("medium", "full");
export const ShortFormAtTheNarrowStep = atStep("narrow", "short");
export const ShortFormOnThePhone = atStep("phone", "short");

/** The form follows the step while the indicator stays mounted, so its own state is kept. */
export const TheFormFollowsTheLayoutStep: Story = {
  ...atViewport("wide"),
  args: WITH_INDICATOR,
  play: async ({ canvas }) => {
    await userEvent.click(await fullForm(canvas));
    await expect(canvas.getByText("Counted 1")).toBeVisible();
    await atFrameWidth(SHELL_REFERENCE_WIDTHS.narrow, async () => {
      await waitFor(() => expect(canvas.queryByRole("button", { name: "Count up" })).toBeNull());
      await expect(canvas.getByText("1")).toBeVisible();
    });
    await expect(await fullForm(canvas)).toBeVisible();
    await expect(canvas.getByText("Counted 1")).toBeVisible();
  },
};

export const ShownInItsOwnModule: Story = {
  ...atViewport("wide"),
  args: {
    ...WITH_INDICATOR,
    activeModule: INDICATING,
    activeView: { ...projects.views[0], title: { id: "story-Projects", message: "Projects" } },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(await fullForm(canvas)).toBeVisible();
  },
};

export const ShownInTheSettings: Story = {
  ...atViewport("wide"),
  args: { ...WITH_INDICATOR, activeModule: SETTINGS, activeView: SETTINGS.views[0] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(await fullForm(canvas)).toBeVisible();
  },
};

/** The indicator's code, held back until the story lets it arrive. */
function heldIndicator() {
  let arrive!: () => void;
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  const module: ShellContribution = {
    ...projects,
    indicator: {
      load: async () => {
        await arrived;
        return { default: CountingIndicator };
      },
    },
  };
  return { module, arrive };
}

const held = freshPerRun(heldIndicator, ({ module }) => [module, time, third]);

export const TheIconHoldsThePlaceUntilTheCodeArrives: Story = {
  ...atViewport("wide"),
  ...held.story,
  play: async ({ canvas }) => {
    const icon = canvas.getByRole("img", { name: "Projects" });
    await expect(headerOf(canvas).contains(icon)).toBe(true);
    await expect(indicatorPlaceOf(icon)).toHaveAttribute("data-color-set", "blue");
    const header = headerOf(canvas).getBoundingClientRect().toJSON();
    const content = canvas.getByText("Page content").getBoundingClientRect().toJSON();
    held.now.arrive();
    await expect(await fullForm(canvas)).toBeVisible();
    await expect(canvas.queryByRole("img", { name: "Projects" })).toBeNull();
    await expect(headerOf(canvas).getBoundingClientRect().toJSON()).toEqual(header);
    await expect(canvas.getByText("Page content").getBoundingClientRect().toJSON()).toEqual(
      content,
    );
  },
};

const onItsWay = freshPerRun(
  () => codeOnItsWay(CountingIndicator),
  (code) => [{ ...projects, indicator: { load: code.load } }, time, third],
);

export const TheIndicatorShowsAsSoonAsItsCodeArrives: Story = {
  ...atViewport("wide"),
  ...onItsWay.story,
  play: async ({ canvas }) => {
    const shownAt = await momentShown(
      () => canvas.queryByRole("button", { name: "Count up" }),
      INDICATOR_ARRIVES.timeout,
    );
    await expect(shownAt - onItsWay.now.arrivedAt()).toBeLessThan(SHOWN_ON_ARRIVAL_MS);
  },
};

const LONG_TITLE =
  "A page title far too long for the content header, which has to shorten before the indicator does";

const longTitleAt = (viewport: keyof typeof VIEWPORTS, form: "full" | "short"): Story => ({
  ...atViewport(viewport),
  args: {
    ...WITH_INDICATOR,
    activeView: { ...time.views[0], title: { id: "story-long", message: LONG_TITLE } },
  },
  play: async ({ canvas }) => {
    if (form === "full") await fullForm(canvas);
    else await expectShortForm(canvas);
    const title = canvas.getByRole("heading", { name: LONG_TITLE });
    await expect(title.scrollHeight).toBeGreaterThan(title.clientHeight);
    const place = indicatorPlaceOf(canvas.getByText(form === "full" ? "Counted 0" : "0"));
    // The indicator keeps its whole width, within its form's maximum.
    await expect(place.scrollWidth).toBeLessThanOrEqual(place.clientWidth);
    await expect(widthOf(place)).toBeLessThanOrEqual(INDICATOR_MAX_WIDTH[form]);
    await expect(place.getBoundingClientRect().right).toBeLessThanOrEqual(
      paneOf(canvas, "Page content").getBoundingClientRect().right,
    );
    await expect(Math.round(headerOf(canvas).getBoundingClientRect().height)).toBe(48);
  },
});

export const ALongTitleShortensBeforeTheFullForm = longTitleAt("medium", "full");
export const ALongTitleShortensBeforeTheShortForm = longTitleAt("phone", "short");

export const TwoIndicatorsInTheOrderOfTheModuleList: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      { ...projects, indicator: countingIndicator() },
      time,
      { ...third, indicator: countingIndicator() },
    ],
    // The third module is active, and still its indicator comes second.
    activeModule: third,
    activeView: third.views[0],
  },
  play: async ({ canvas }) => {
    await waitFor(
      () => expect(canvas.getAllByRole("button", { name: "Count up" })).toHaveLength(2),
      INDICATOR_ARRIVES,
    );
    const colors = canvas
      .getAllByRole("button", { name: "Count up" })
      .map((button) => indicatorPlaceOf(button).dataset["colorSet"]);
    await expect(colors).toEqual(["blue", "orange"]);
  },
};

export const TheHeaderDragsTheWindowAndTheIndicatorTakesClicksAndTab: Story = {
  ...atViewport("wide"),
  args: WITH_INDICATOR,
  play: async ({ canvas }) => {
    const button = await fullForm(canvas);
    await expect(appRegionOf(headerOf(canvas))).toBe("drag");
    await expect(appRegionOf(indicatorPlaceOf(button))).toBe("no-drag");
    // Reached with Tab right after the page title, whose own line has nothing to focus.
    collapseToggle(canvas).focus();
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(button);
    await expect(within(indicatorPlaceOf(button)).getByText("Counted 2")).toBeVisible();
  },
};

const renderFailure = new Error("broken indicator render");

function BrokenIndicator() {
  const [broken, setBroken] = useState(false);
  if (broken) throw renderFailure;
  return <Button onClick={() => setBroken(true)}>Break indicator</Button>;
}

function RecoveredIndicator() {
  return <span>Recovered indicator</span>;
}

export const AnIndicatorRenderFailureLeavesTheOtherIndicatorWorking: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      {
        ...projects,
        indicator: {
          load: async () => ({ default: RecoveredIndicator }),
        },
      },
      time,
      { ...third, indicator: countingIndicator() },
    ],
  },
  beforeEach: ({ args }) => {
    // A fresh load identity keeps the story repeatable after a successful retry.
    const indicator = args.contributions[0]!.indicator!;
    const load = spyOn(indicator, "load").mockResolvedValueOnce({ default: BrokenIndicator });
    return () => load.mockRestore();
  },
  play: async ({ canvas }) => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    const healthy = await fullForm(canvas);
    await userEvent.click(healthy);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Break indicator" }, INDICATOR_ARRIVES),
    );

    const retry = await within(headerOf(canvas)).findByRole("button", {
      name: "Projects indicator failed. Try again.",
    });
    // React reports the failure that the boundary caught.
    await expect(reported.mock.calls.some((call) => call.includes(renderFailure))).toBe(true);
    reported.mockRestore();
    await expect(canvas.getByText("Page content")).toBeVisible();
    await expect(healthy).toBeVisible();
    await userEvent.click(healthy);
    await expect(canvas.getByText("Counted 2")).toBeVisible();

    collapseToggle(canvas).focus();
    await userEvent.tab();
    await expect(retry).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByText("Recovered indicator")).toBeVisible();
    await expect(canvas.getByText("Counted 2")).toBeVisible();
  },
};
