import { answersByMount, changingAnswers } from "@self-engine/data-client/testing";
import {
  GARDEN,
  OLD_SITE,
  projectReference,
  projectsAnswers,
  type ProjectsAnswers,
  TAX,
  WEBSITE,
  WEBSITE_TWIN,
} from "@self-engine/projects/testing";
import { settingChange } from "@self-engine/settings";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import {
  SAMPLE_WEEK_ENTRIES,
  timeEntry,
  timeTrackingAnswers,
} from "@self-engine/time-tracking/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt, loadStoryApp, STORY_DEVICE_ZONE, storyRouter } from "./story-app.tsx";

const WEEK = "/time-tracking/week";
const TIME = {
  clock: fixedClock(requireInstant("2026-12-04T10:00:00.000Z")),
  deviceZone: STORY_DEVICE_ZONE,
  region: "de-DE",
} as const;
const ACTIVE = [WEBSITE, WEBSITE_TWIN, GARDEN];
const PROJECTS = { active: { data: ACTIVE }, archived: { data: [OLD_SITE] } };
const ENTRIES = [
  ...SAMPLE_WEEK_ENTRIES,
  timeEntry(8, {
    startedAt: "2026-11-16T15:00:00.000Z",
    endedAt: "2026-11-16T15:30:00.000Z",
    project: projectReference(WEBSITE_TWIN),
    note: "Hosting",
  }),
];

function answers(projects: ProjectsAnswers = PROJECTS, entries = ENTRIES) {
  return answersByMount({
    projects: projectsAnswers(projects),
    timeTracking: timeTrackingAnswers({ entries }),
  });
}

const meta = {
  title: "App/Time Tracking/Project Filter",
  parameters: { layout: "fullscreen" },
  loaders: [
    async () => {
      await loadStoryApp();
      settingsStore.writeAll([
        settingChange(TIME_ZONE_SETTING, TIME_ZONE_SETTING.default),
        settingChange(WEEK_START_SETTING, WEEK_START_SETTING.default),
      ]);
    },
  ],
  args: { address: `${WEEK}?week=2026-11-16` },
  render: ({ address }) => <AppAt access={answers()} address={address} time={TIME} />,
} satisfies Meta<{ readonly address: string }>;
export default meta;
type Story = StoryObj<typeof meta>;
type Canvas = ReturnType<typeof within>;

const projectsGroup = async (canvas: Canvas) =>
  within(await canvas.findByRole("group", { name: "Projects" }));

async function expectTotal(canvas: Canvas, total: string) {
  await waitFor(async () => expect(canvas.getByLabelText("Week total").textContent).toBe(total));
}

export const TheGroupFiltersByIdAndCanClearTheFilter: Story = {
  loaders: [() => ({ calls: [] })],
  render: ({ address }, { loaded }) => {
    const calls = loaded["calls"] as string[];
    const fixed = answers();
    const access = {
      ...fixed,
      call(module, entry, input, signal) {
        calls.push(`${module}.${entry}`);
        return fixed.call(module, entry, input, signal);
      },
    } satisfies ReturnType<typeof answers>;
    return <AppAt access={access} address={address} time={TIME} />;
  },
  play: async ({ canvas, loaded }) => {
    const calls = loaded["calls"] as string[];
    const group = await projectsGroup(canvas);
    const [website, twin] = await group.findAllByRole("link", { name: "Website" });
    await expect(group.queryByRole("link", { name: "Old site" })).toBeNull();
    await expect(website?.querySelector('[data-color-set="teal"] svg')).toBeTruthy();
    await expect(twin?.querySelector('[data-color-set="orange"]')).toHaveTextContent("🌐");

    await expectTotal(canvas, "13:50");
    await waitFor(async () =>
      expect(calls.toSorted()).toEqual([
        "projects.active",
        "projects.archived",
        "timeTracking.days",
      ]),
    );
    const before = calls.length;
    await userEvent.click(website!);
    await expectTotal(canvas, "8:05");
    await expect(calls.slice(before)).toEqual(["timeTracking.days"]);
    await expect(website).toHaveAttribute("aria-current", "true");
    await expect(canvas.getByText("Landing page")).toBeVisible();
    await expect(canvas.queryByText("Hosting")).toBeNull();
    await expect(canvas.queryByText("Emails")).toBeNull();
    const monday = within(canvas.getByRole("region", { name: "Monday, November 16, 2026" }));
    await expect(monday.getByLabelText("Day total")).toHaveTextContent("3:30");
    const totals = within(canvas.getByRole("region", { name: "Week totals" }));
    const [sum] = totals.getAllByRole("listitem");
    await expect(totals.getAllByRole("listitem")).toHaveLength(1);
    await expect(sum).toHaveTextContent("Website8:05");

    await userEvent.click(twin!);
    await expectTotal(canvas, "0:30");
    await expect(canvas.getByText("Hosting")).toBeVisible();
    await expect(canvas.queryByText("Landing page")).toBeNull();

    await userEvent.click(twin!);
    await expectTotal(canvas, "13:50");
    await userEvent.click(group.getByRole("link", { name: "No project" }));
    await expectTotal(canvas, "1:15");
    await expect(canvas.getByText("Emails")).toBeVisible();
    await expect(canvas.queryByText("Hosting")).toBeNull();
    await userEvent.click(group.getByRole("link", { name: /^All$/ }));
    await expectTotal(canvas, "13:50");
    await expect(storyRouter().state.location.search).toEqual({ week: "2026-11-16" });
  },
};

export const AnArchivedProjectFilterSurvivesTheAddressAndWeekNavigation: Story = {
  args: { address: `${WEEK}?week=2026-11-16&project=${OLD_SITE.id}` },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Mon, Nov 16 – Sun, Nov 22" });
    await expectTotal(canvas, "1:00");
    await expect(canvas.getByText("Handover")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Next week" }));
    await expectTotal(canvas, "0:00");
    await expect(storyRouter().state.location.search).toEqual({
      week: "2026-11-23",
      project: OLD_SITE.id,
    });
    await userEvent.click(canvas.getByRole("button", { name: "Previous week" }));
    await expectTotal(canvas, "1:00");

    const control = await canvas.findByRole("combobox", { name: "Filter by project" });
    await expect(control).toHaveValue("Old site");
    await userEvent.click(control);
    await userEvent.click(await screen.findByRole("option", { name: /^All$/ }));
    await expectTotal(canvas, "13:50");
    await userEvent.click(control);
    await userEvent.click(await screen.findByRole("option", { name: "Old site" }));
    await expectTotal(canvas, "1:00");
    await expect(storyRouter().state.location.search).toEqual({
      week: "2026-11-16",
      project: OLD_SITE.id,
    });
  },
};

function changingProjects() {
  return changingAnswers(answers(), {
    projects: { active: ["projects"], archived: ["projects"] },
    timeTracking: { days: ["projects", "time_entries"] },
  });
}

export const ProjectTableChangesUpdateTheGroupAndKeepTheArchivedFilter: Story = {
  loaders: [() => ({ port: changingProjects() })],
  render: ({ address }, { loaded }) => {
    const port = loaded["port"] as ReturnType<typeof changingProjects>;
    return <AppAt access={port.access} address={address} time={TIME} />;
  },
  play: async ({ canvas, loaded }) => {
    const port = loaded["port"] as ReturnType<typeof changingProjects>;
    const group = await projectsGroup(canvas);
    await userEvent.click(await group.findByRole("link", { name: "Garden" }));
    await expectTotal(canvas, "3:00");

    const renamed = { ...GARDEN, title: "Kitchen garden" };
    const archived = { ...renamed, archivedAt: "2026-11-27T10:00:00.000Z" };
    const entriesWith = (project: typeof GARDEN) =>
      ENTRIES.map((entry) =>
        entry.projectId === project.id ? { ...entry, project: projectReference(project) } : entry,
      );
    port.change(
      answers(
        { ...PROJECTS, active: { data: [WEBSITE, WEBSITE_TWIN, renamed, TAX] } },
        entriesWith(renamed),
      ),
      ["projects"],
    );
    await expect(await group.findByRole("link", { name: "Kitchen garden" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(await group.findByRole("link", { name: "Tax" })).toBeVisible();

    port.change(
      answers(
        {
          active: { data: [WEBSITE, WEBSITE_TWIN, TAX] },
          archived: { data: [OLD_SITE, archived] },
        },
        entriesWith(archived),
      ),
      ["projects"],
    );
    const control = canvas.getByRole("combobox", { name: "Filter by project" });
    await waitFor(async () => {
      await expect(group.queryByRole("link", { name: "Kitchen garden" })).toBeNull();
      await expect(control).toHaveValue("Kitchen garden");
    });
    await expect(storyRouter().state.location.search).toEqual({
      week: "2026-11-16",
      project: GARDEN.id,
    });
    await expectTotal(canvas, "3:00");
    await expect(canvas.getByText("Raised beds")).toBeVisible();
  },
};

/** The story's answers, with those of `projects` held until `release` is called. */
function projectsArriveLater() {
  const fixed = answers();
  let release = () => {};
  const arrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  const access = {
    ...fixed,
    async call(module, entry, input, signal) {
      if (module === "projects") await arrived;
      return fixed.call(module, entry, input, signal);
    },
  } satisfies typeof fixed;
  return { access, release };
}

export const ADeepLinkKeepsItsFilterWhileTheProjectsLoad: Story = {
  args: { address: `${WEEK}?week=2026-11-16&project=${WEBSITE.id}` },
  loaders: [() => ({ port: projectsArriveLater() })],
  render: ({ address }, { loaded }) => {
    const port = loaded["port"] as ReturnType<typeof projectsArriveLater>;
    return <AppAt access={port.access} address={address} time={TIME} />;
  },
  play: async ({ canvas, loaded }) => {
    const port = loaded["port"] as ReturnType<typeof projectsArriveLater>;
    await expectTotal(canvas, "8:05");
    const control = await canvas.findByRole("combobox", { name: "Filter by project" });
    // Neither the raw id nor a choice that clears the filter while the list is on its way.
    await expect(control).toHaveValue("Loading");
    await userEvent.click(control);
    const waiting = await screen.findByRole("option", { name: "Loading" });
    await expect(waiting).toHaveAttribute("data-combobox-disabled", "true");
    await userEvent.click(waiting);
    await expect(storyRouter().state.location.search).toEqual({
      week: "2026-11-16",
      project: WEBSITE.id,
    });
    await userEvent.keyboard("{Escape}");

    port.release();
    await waitFor(async () => expect(control).toHaveValue("Website"));
    await expectTotal(canvas, "8:05");
  },
};
