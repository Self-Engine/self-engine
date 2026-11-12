import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";
import { LOADER_DELAY_MS, type QueryDisplayState, QueryStateBlock } from "./index.ts";
import { holdTimers } from "./story-timers.ts";

const meta = {
  title: "UI/Query state block",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Rows = readonly string[];

const ROWS: Rows = ["Website relaunch", "Annual report"];

/** Moves the block to another state, as a Query hook does when its answer arrives. */
let drive: (state: QueryDisplayState<Rows>) => void = () => undefined;

function Driven({ initial }: { readonly initial: QueryDisplayState<Rows> }) {
  const [state, setState] = useState(initial);
  drive = setState;
  return (
    <QueryStateBlock state={state}>
      {(rows) => (
        <ul aria-label="Projects">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      )}
    </QueryStateBlock>
  );
}

/** The loading state's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];

function holdTheWait() {
  const timers = holdTimers(LOADER_DELAY_MS);
  heldWait = timers.held;
  return timers.restore;
}

/** Runs every held wait. The closed dialog of the feedback host waits just as long, harmlessly. */
function finishTheWait() {
  for (const finish of heldWait.values()) finish();
}

export const AFastLoadShowsNoLoadingDisplay: Story = {
  beforeEach: holdTheWait,
  render: () => <Driven initial={{ status: "loading" }} />,
  play: async ({ canvas }) => {
    await expect(heldWait.size).toBeGreaterThan(0);
    await expect(canvas.queryByRole("status")).toBeNull();
    drive({ status: "content", data: ROWS });
    await expect(await canvas.findByText("Website relaunch")).toBeVisible();
    // The answer came before the wait was over: the loading state left and took its wait along.
    finishTheWait();
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

export const ASlowLoadShowsTheLoadingDisplay: Story = {
  beforeEach: holdTheWait,
  render: () => <Driven initial={{ status: "loading" }} />,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("status")).toBeNull();
    finishTheWait();
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
    drive({ status: "content", data: ROWS });
    await expect(await canvas.findByText("Annual report")).toBeVisible();
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

const retry = fn(() => drive({ status: "loading" }));

export const AFailedFirstLoadOffersARetry: Story = {
  beforeEach: () => {
    retry.mockClear();
    return holdTheWait();
  },
  render: () => <Driven initial={{ status: "loadFailed", retry }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("This part could not be loaded.");
    await expect(canvas.queryByRole("list")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(retry).toHaveBeenCalledOnce();
    // Loading again, behind the same wait as the first time.
    await expect(canvas.queryByRole("alert")).toBeNull();
    drive({ status: "content", data: ROWS });
    await expect(await canvas.findByText("Website relaunch")).toBeVisible();
  },
};

export const AReloadKeepsTheContentWithoutALoadingDisplay: Story = {
  beforeEach: holdTheWait,
  render: () => <Driven initial={{ status: "content", data: ROWS }} />,
  play: async ({ canvas }) => {
    drive({ status: "reloading", data: ROWS });
    finishTheWait();
    await expect(canvas.getByRole("list", { name: "Projects" })).toBeVisible();
    await expect(canvas.queryByRole("status")).toBeNull();
    drive({ status: "content", data: [...ROWS, "Tax return"] });
    await expect(await canvas.findByText("Tax return")).toBeVisible();
  },
};

export const AFailedReloadKeepsTheContent: Story = {
  render: () => <Driven initial={{ status: "reloading", data: ROWS }} />,
  play: async ({ canvas }) => {
    drive({ status: "reloadFailed", data: ROWS });
    // The Notice that it may be outdated comes from the data client, once per failure.
    await expect(canvas.getByRole("list", { name: "Projects" })).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};
