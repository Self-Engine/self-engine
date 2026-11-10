import { Button } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { roleColor } from "@self-engine/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { EmptyState, ErrorState, LoadingState } from "./index.ts";
import { holdTimers } from "./story-timers.ts";

const meta = {
  title: "UI/State blocks",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const nextStep = fn();

export const EmptyWithIconTextAndAction: Story = {
  render: () => (
    <EmptyState
      action={<Button onClick={nextStep}>New project</Button>}
      description="Projects you create appear here."
      icon={ProjectsIcon}
      title="No projects yet"
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("No projects yet")).toBeVisible();
    await expect(canvas.getByText("Projects you create appear here.")).toBeVisible();
    await expect(canvasElement.querySelector("svg")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "New project" }));
    await expect(nextStep).toHaveBeenCalledOnce();
  },
};

const retry = fn();

export const ErrorWithARetry: Story = {
  render: () => <ErrorState onRetry={retry} title="This part could not be loaded." />,
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("This part could not be loaded.");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(retry).toHaveBeenCalledOnce();
  },
};

export const ErrorWithoutARetryOffersNone: Story = {
  render: () => <ErrorState description="It may have been moved." title="Nothing here." />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("It may have been moved.");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

const close = fn();

export const ErrorCanOfferItsOwnActionInsteadOfARetry: Story = {
  render: () => <ErrorState action={<Button onClick={close}>Close</Button>} title="Not found." />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Not found.");
    await expect(canvas.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(close).toHaveBeenCalledOnce();
  },
};

export const ErrorUsesTheErrorColorRole: Story = {
  render: () => (
    <>
      <ErrorState title="This part could not be loaded." />
      <span data-testid="error-role" style={{ color: roleColor("errorText") }} />
    </>
  ),
  play: async ({ canvas }) => {
    const icon = canvas.getByRole("alert").querySelector("svg");
    await expect(icon).not.toBeNull();
    await expect(getComputedStyle(icon!).color).toBe(
      getComputedStyle(canvas.getByTestId("error-role")).color,
    );
  },
};

/** The block's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];

export const LoadingShowsNothingUntilTheWaitIsOver: Story = {
  beforeEach: () => {
    const timers = holdTimers(200);
    heldWait = timers.held;
    return timers.restore;
  },
  render: () => <LoadingState />,
  play: async ({ canvas }) => {
    await expect(heldWait.size).toBeGreaterThan(0);
    await expect(canvas.queryByRole("status")).toBeNull();
    // The closed dialog of the feedback host waits just as long, and running that one is harmless.
    for (const finish of heldWait.values()) finish();
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
  },
};
