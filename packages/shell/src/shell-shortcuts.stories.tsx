import { ProjectsIcon } from "@self-engine/icons";
import { confirm } from "@self-engine/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import {
  defineOpenCommand,
  definePageCommand,
  Shell,
  type ShellContribution,
  type ShellProps,
} from "./index.ts";
import {
  onMac,
  onWindows,
  SETTINGS,
  shellMeta,
  storyData,
  storyRouting,
} from "./shell-story-helpers.tsx";
import { registeredBindingIds } from "./shortcut-bindings.tsx";

const body = { description: "A stand-in.", schema: z.object({}), run: () => undefined };
const page = { id: "new", kind: "page", label: { id: "story-New", message: "New" } } as const;

const startedInFirst = fn(async () => ({ default: definePageCommand(body) }));
const startedInSecond = fn(async () => ({ default: definePageCommand(body) }));
/** The Port access the open Command was given, to show that the Shell hands on its own. */
const givenData = fn();
const startedOpen = fn(async () => ({
  default: defineOpenCommand({ ...body, run: (_input, { data }) => givenData(data) }),
}));

const load = async () => ({ default: () => null });
const views = [
  { id: "overview", title: { id: "story-Overview", message: "Overview" }, load },
] as const;
const moduleNamed = (id: string) =>
  ({
    id,
    name: { id: `story-${id}`, message: id },
    icon: ProjectsIcon,
    color: "blue",
    views,
  }) as const;

const FIRST: ShellContribution = {
  ...moduleNamed("first"),
  commands: [
    { ...page, defaultShortcut: "Mod+N", load: startedInFirst },
    {
      id: "everywhere",
      kind: "open",
      label: { id: "story-Everywhere", message: "Everywhere" },
      defaultShortcut: "Mod+Shift+E",
      load: startedOpen,
    },
  ],
};
const SECOND: ShellContribution = {
  ...moduleNamed("second"),
  commands: [{ ...page, defaultShortcut: "Mod+N", load: startedInSecond }],
};
const WITHOUT_COMMANDS: ShellContribution = moduleNamed("without-commands");
const MODULES = [FIRST, SECOND, WITHOUT_COMMANDS];

const meta = {
  ...shellMeta,
  title: "Shell/Shortcuts",
  args: {
    ...shellMeta.args,
    contributions: MODULES,
    settings: SETTINGS,
    routing: storyRouting(),
    activeModule: FIRST,
    activeView: views[0],
  },
  beforeEach: () => {
    for (const started of [startedInFirst, startedInSecond, startedOpen, givenData]) {
      started.mockClear();
    }
    return onWindows();
  },
} satisfies Meta<ShellProps>;
export default meta;
type Story = StoryObj<typeof meta>;

const pressNew = () => userEvent.keyboard("{Control>}n{/Control}");
const pressEverywhere = () => userEvent.keyboard("{Control>}{Shift>}e{/Shift}{/Control}");

/** The bindings load after the first paint, so an early press is lost. Ends on the first that lands. */
async function bindingsArrived(press = pressEverywhere, started = startedOpen) {
  await waitFor(async () => {
    await press();
    await expect(started).toHaveBeenCalled();
  });
  started.mockClear();
}

export const AnOpenShortcutWorksInAModuleWithoutCommands: Story = {
  args: { activeModule: WITHOUT_COMMANDS },
  play: async () => {
    await bindingsArrived();
    await pressEverywhere();
    await expect(startedOpen).toHaveBeenCalledOnce();
    // Every Command is given the Shell's Port access and notice seam, an open one as well (D261).
    await waitFor(() => expect(givenData).toHaveBeenLastCalledWith(storyData));
  },
};

export const APageShortcutStartsItsCommandInItsOwnModule: Story = {
  play: async () => {
    await bindingsArrived();
    await pressNew();
    await expect(startedInFirst).toHaveBeenCalledOnce();
    await expect(startedInSecond).not.toHaveBeenCalled();
  },
};

export const APageShortcutDoesNothingInAnotherModule: Story = {
  args: { activeModule: WITHOUT_COMMANDS },
  play: async () => {
    await bindingsArrived();
    await pressNew();
    await expect(startedInFirst).not.toHaveBeenCalled();
    await expect(startedInSecond).not.toHaveBeenCalled();
  },
};

export const TwoModulesCanShareAPageShortcut: Story = {
  args: { activeModule: SECOND },
  play: async () => {
    await bindingsArrived();
    await pressNew();
    await expect(startedInSecond).toHaveBeenCalledOnce();
    await expect(startedInFirst).not.toHaveBeenCalled();
  },
};

export const ModIsControlOutsideMacOS: Story = {
  play: async () => {
    await bindingsArrived();
    await userEvent.keyboard("{Meta>}n{/Meta}");
    await expect(startedInFirst).not.toHaveBeenCalled();
    await userEvent.keyboard("{Control>}n{/Control}");
    await expect(startedInFirst).toHaveBeenCalledOnce();
  },
};

export const ModIsCommandOnMacOS: Story = {
  beforeEach: onMac,
  play: async () => {
    const pressOnMac = () => userEvent.keyboard("{Meta>}{Shift>}e{/Shift}{/Meta}");
    await bindingsArrived(pressOnMac);
    await userEvent.keyboard("{Control>}n{/Control}");
    await expect(startedInFirst).not.toHaveBeenCalled();
    await userEvent.keyboard("{Meta>}n{/Meta}");
    await expect(startedInFirst).toHaveBeenCalledOnce();
  },
};

/** The key's own events, because a scripted press has no way to say that a key repeats. */
function keyEvent(type: "keydown" | "keyup", repeat: boolean) {
  const init = { key: "n", code: "KeyN", ctrlKey: true, bubbles: true, repeat };
  document.body.dispatchEvent(new KeyboardEvent(type, init));
}

/** A task later, so the start before it is over and only the key itself can hold a second back. */
const startFinished = () => new Promise((resolve) => setTimeout(resolve));

export const HoldingAKeyStartsACommandOnce: Story = {
  play: async () => {
    await bindingsArrived();
    keyEvent("keydown", false);
    await startFinished();
    for (let repeats = 0; repeats < 5; repeats += 1) keyEvent("keydown", true);
    await expect(startedInFirst).toHaveBeenCalledOnce();
    keyEvent("keyup", false);
    await startFinished();
    keyEvent("keydown", false);
    keyEvent("keyup", false);
    await expect(startedInFirst).toHaveBeenCalledTimes(2);
  },
};

export const ShortcutsDoNothingWhileAConfirmationIsOpen: Story = {
  play: async () => {
    await bindingsArrived();
    const answer = confirm({ title: "Sure?", message: "Really?", confirmLabel: "Yes" });
    const question = within(await screen.findByRole("dialog", { name: "Sure?" }));
    await pressNew();
    await pressEverywhere();
    await expect(startedInFirst).not.toHaveBeenCalled();
    await expect(startedOpen).not.toHaveBeenCalled();
    await userEvent.click(question.getByRole("button", { name: "Cancel" }));
    await expect(await answer).toBe(false);
    await pressNew();
    await expect(startedInFirst).toHaveBeenCalledOnce();
  },
};

export const TypingInAFieldStartsNothingAndModStillDoes: Story = {
  args: { children: <input aria-label="Field" /> },
  play: async ({ canvas }) => {
    await bindingsArrived();
    const field = canvas.getByRole("textbox", { name: "Field" });
    await userEvent.type(field, "n");
    await expect(field).toHaveValue("n");
    await expect(startedInFirst).not.toHaveBeenCalled();
    await pressNew();
    await expect(startedInFirst).toHaveBeenCalledOnce();
  },
};

/** A Shell whose module the story switches with a button in the page, as navigating would. */
function SwitchingShell(props: ShellProps) {
  const [activeModule, setActiveModule] = useState(props.activeModule);
  const next = activeModule === FIRST ? SECOND : FIRST;
  return (
    <Shell {...props} activeModule={activeModule}>
      <button type="button" onClick={() => setActiveModule(next)}>
        Switch module
      </button>
    </Shell>
  );
}

export const SwitchingModulesKeepsEveryBinding: Story = {
  render: (args) => <SwitchingShell {...args} />,
  play: async ({ canvas }) => {
    await bindingsArrived();
    const before = registeredBindingIds();
    const switchModule = canvas.getByRole("button", { name: "Switch module" });
    await userEvent.click(switchModule);
    await expect(registeredBindingIds()).toEqual(before);
    await pressNew();
    await expect(startedInSecond).toHaveBeenCalledOnce();
    await userEvent.click(switchModule);
    await expect(registeredBindingIds()).toEqual(before);
    await pressNew();
    await expect(startedInFirst).toHaveBeenCalledOnce();
    await expect(startedInSecond).toHaveBeenCalledOnce();
  },
};
