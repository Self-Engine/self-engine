// A refused save whose Reason names a column (D334, D337): the example's create hook maps the
// columns `title`, `description` and `color_set` to their fields, so such a Reason is shown at its
// field, and every other Reason in the shared Notice. The Reasons are the story's own, with their
// texts composed as the app composes them, and the frame's `target_deleted`.

import type { I18n } from "@lingui/core";
import { I18nProvider, useLingui } from "@lingui/react";
import { Button, Stack, TextInput } from "@mantine/core";
import { useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  DataProvider,
  type FrameReasons,
  type ReasonText,
  type RefusedNotice,
  refusalTexts,
} from "@self-engine/data-client/react";
import type { FixedAnswers, FixedReason } from "@self-engine/data-client/testing";
import { defineReason, referenced, targetDeleted } from "@self-engine/db/schema";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import {
  ColorField,
  OperationFormBody,
  TextField,
  useFieldBinding,
  useOperationForm,
} from "../../index.ts";
import { exampleContract } from "./contract.ts";
import { ExampleForm } from "./example-form.tsx";
import { useCreateExample, useUpdateExample } from "./port.ts";
import { CREATED, type RecordingPort, recordingPortOf } from "./story-port.ts";

/** A rule of the story: some titles are kept for the archive. */
const titleReserved = defineReason("title_reserved", z.object({ title: z.string() }));
/** A rule of the story without a field: the space holds no more entries. */
const spaceFull = defineReason("space_full", z.object({ limit: z.number() }));

type StoryReasons = FrameReasons | typeof titleReserved | typeof spaceFull;

const titleReservedText: ReasonText<typeof titleReserved> = ({ details }) =>
  `“${details.title}” is kept for the archive.`;
const spaceFullText: ReasonText<typeof spaceFull> = ({ details }) =>
  `This space holds no more than ${String(details.limit)} entries.`;

const texts = refusalTexts(
  [{ title_reserved: titleReservedText, space_full: spaceFullText }],
  () => undefined,
);

/** A Reason as a Fixed Answer gives it: one of the story's, without the severity the frame sets. */
type StoryReason = FixedReason<StoryReasons>;

const TABLE = "example_entries";
const ROW = "example-1";
const RESERVED = {
  code: "title_reserved",
  table: TABLE,
  row: ROW,
  field: "title",
  details: { title: "Kitchen" },
} as const satisfies StoryReason;
const FULL = {
  code: "space_full",
  table: TABLE,
  row: ROW,
  details: { limit: 3 },
} as const satisfies StoryReason;
/** The frame's Reason at the column `color_set`: the chosen color set was deleted meanwhile. */
const COLOR_DELETED = {
  code: "target_deleted",
  table: TABLE,
  row: ROW,
  field: "color_set",
  details: { target: { table: "color_sets", id: "ocean" } },
} as const satisfies StoryReason;

interface Loaded {
  readonly port: RecordingPort;
  readonly created: () => void;
}

/** The example's Port, whose create is refused with these Reasons. */
const loadRefused =
  (...reasons: readonly [StoryReason, ...StoryReason[]]) =>
  (): Loaded => ({
    port: recordingPortOf(
      { example: exampleContract },
      { example: { create: { refused: reasons } } },
      { reasons: [referenced, targetDeleted, titleReserved, spaceFull] },
    ),
    created: fn(),
  });

function SwitchLanguage() {
  const { i18n } = useLingui();
  return <Button onClick={() => void activateLanguage(i18n, "de")}>Deutsch</Button>;
}

const meta = {
  title: "Forms/Example form/Reason at a field",
  globals: { language: "en" },
  loaders: [loadRefused(RESERVED)],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
      <ExampleForm onSuccess={(loaded as Loaded).created} />
    </DataProvider>
  ),
  // The notices live in Mantine's store, which outlives a story; they stay until the story ends.
  beforeEach: () => {
    clearNotices();
    return holdTimers(8000).restore;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The fields and the button, found as a user finds them. */
function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    description: () => canvas.getByRole("textbox", { name: "Description" }),
    color: () => canvas.getByRole("radiogroup", { name: "Color" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

/** Fills in the texts so that the Check accepts the draft, and saves. */
async function fillInAndSave(form: ReturnType<typeof formIn>) {
  await userEvent.type(form.title(), "Kitchen");
  await userEvent.type(form.description(), "Paint the walls.");
  await form.save();
}

/** The shared Notice of a Refusal on screen, if any. */
const noticeOnScreen = () =>
  document.querySelector<HTMLElement>(".mantine-Notification-root") ?? undefined;

/** The texts of the Reasons the shared Notice tells, once it is on screen: one, or a list. */
async function reasonsInTheNotice(): Promise<readonly (string | null)[]> {
  await waitFor(() => expect(noticeOnScreen()).toBeDefined());
  const notice = noticeOnScreen()!;
  const items = within(notice).queryAllByRole("listitem");
  if (items.length > 0) return items.map((item) => item.textContent);
  return [notice.querySelector(".mantine-Notification-description")?.textContent ?? null];
}

/** The refused save has ended: the form takes input again. */
const saveEnded = (form: ReturnType<typeof formIn>) =>
  waitFor(() => expect(form.title()).toBeEnabled());

export const AReasonAtAFieldIsShownThereAndTheDraftStays: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );
    // What was typed stays, the form stays open, and no Notice repeats the Reason.
    await expect(form.title()).toHaveValue("Kitchen");
    await expect(form.description()).toHaveValue("Paint the walls.");
    await expect((loaded as Loaded).created).not.toHaveBeenCalled();
    await expect(noticeOnScreen()).toBeUndefined();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const ChangingTheFieldRemovesTheMessage: Story = {
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    // A change elsewhere leaves it; a change to its field answers it.
    await userEvent.type(form.description(), " Twice.");
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");
    await userEvent.type(form.title(), " two");
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

export const AReasonWithoutAFieldOrAtAColumnNotMappedGoesToTheNotice: Story = {
  loaders: [loadRefused(FULL, { ...RESERVED, field: "id" })],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await expect(await reasonsInTheNotice()).toEqual([
      "This space holds no more than 3 entries.",
      "“Kitchen” is kept for the archive.",
    ]);
    await saveEnded(form);
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
    await expect(form.title()).toHaveValue("Kitchen");
  },
};

export const OneAtAFieldAndOneWithoutAreEachShownInTheirPlace: Story = {
  loaders: [loadRefused(RESERVED, FULL)],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await expect(await reasonsInTheNotice()).toEqual(["This space holds no more than 3 entries."]);
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");
  },
};

export const ACheckOutranksAReasonAtTheSameField: Story = {
  loaders: [loadRefused({ ...RESERVED, field: "description" })],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    // A failed Check first: from then on every change checks the whole draft (D321).
    await form.save();
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.description()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    // A title equal to the description breaks a rule the Check reports at the description.
    await userEvent.clear(form.title());
    await userEvent.type(form.title(), "Paint the walls.");
    await expect(form.description()).toHaveAccessibleDescription(
      "The description must differ from the title.",
    );
    // Once the rule holds again, the Reason shows again: its field did not change.
    await userEvent.type(form.title(), "!");
    await expect(form.description()).toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

export const TheMessageFollowsALanguageSwitch: Story = {
  loaders: [
    loadRefused(COLOR_DELETED),
    // Its own instance: a switch still loading when the next story starts changes only this one.
    async () => {
      const i18n = createI18n();
      await activateLanguage(i18n, "en");
      return { i18n };
    },
  ],
  render: (_args, { loaded }) => (
    <I18nProvider i18n={(loaded as { readonly i18n: I18n }).i18n}>
      <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
        <Stack>
          <SwitchLanguage />
          <ExampleForm onSuccess={(loaded as Loaded).created} />
        </Stack>
      </DataProvider>
    </I18nProvider>
  ),
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.color()).toHaveAccessibleDescription("The linked entry is no longer available."),
    );

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Deutsch" }));
    await waitFor(() =>
      expect(form.color()).toHaveAccessibleDescription(
        "Der verknüpfte Eintrag (Eintrag) ist nicht mehr verfügbar.",
      ),
    );
  },
};

/**
 * A form that maps the column `description` but shows no description field, and names the entry
 * the Notice of a refused save concerns.
 */
function FormWithoutItsDescription({ created }: { readonly created: () => void }) {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "Kitchen", description: "Paint the walls.", icon: null, color: null },
    entryName: "Kitchen",
    onSuccess: created,
  });
  return (
    <Stack>
      <TextField form={form} name="title" label="Title" />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

export const AReasonAtAFieldTheFormDoesNotShowGoesToTheNoticeWithTheEntry: Story = {
  loaders: [loadRefused({ ...RESERVED, field: "description" }, FULL)],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
      <FormWithoutItsDescription created={(loaded as Loaded).created} />
    </DataProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));

    // No Reason is lost: the one whose field is not on screen joins the Notice, under the entry.
    await expect(await reasonsInTheNotice()).toEqual([
      "“Kitchen” is kept for the archive.",
      "This space holds no more than 3 entries.",
    ]);
    await expect(noticeOnScreen()?.querySelector(".mantine-Notification-title")?.textContent).toBe(
      "Kitchen",
    );
  },
};

/** What the example's create answers in a story of this file. */
type CreateAnswer = NonNullable<
  NonNullable<FixedAnswers<{ example: typeof exampleContract }, StoryReasons>["example"]>["create"]
>;

/**
 * The example's Port, answering its creates in turn: the first with the first answer, and so on;
 * the last answers every create after it. Each call waits until the story lets it through.
 */
function answersInTurn(...answers: readonly [CreateAnswer, ...CreateAnswer[]]) {
  const ports = answers.map((create) =>
    recordingPortOf(
      { example: exampleContract },
      { example: { create } },
      { reasons: [referenced, targetDeleted, titleReserved, spaceFull] },
    ),
  );
  let calls = 0;
  let gate = Promise.withResolvers<void>();
  return {
    access: {
      ...ports[0]!.access,
      async call(module: string, entry: string, input: unknown, signal?: AbortSignal) {
        const port = ports[Math.min(calls, ports.length - 1)]!;
        calls += 1;
        await gate.promise;
        return port.access.call(module, entry, input, signal);
      },
    },
    /** Lets the waiting call through; the next one waits again. */
    release() {
      gate.resolve();
      gate = Promise.withResolvers<void>();
    },
  };
}

type TurnPort = ReturnType<typeof answersInTurn>;

/** Saves and lets the answer in. */
async function saveAndAnswer(form: ReturnType<typeof formIn>, port: TurnPort) {
  await form.save();
  port.release();
  await saveEnded(form);
}

export const ARetryThatMeetsAConflictShowsTheConflictNotTheOldReason: Story = {
  loaders: [() => ({ port: answersInTurn({ refused: [RESERVED] }, { conflict: "title_taken" }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as { port: TurnPort }).port.access} reasonTexts={texts}>
      <ExampleForm onSuccess={() => undefined} />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const { port } = loaded as { port: TurnPort };
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await saveAndAnswer(form, port);
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");

    // The next save, its title unchanged, meets another answer at the same field.
    await userEvent.type(form.description(), " Twice.");
    await saveAndAnswer(form, port);
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("This title is already in use."),
    );
  },
};

export const ASaveThatSucceedsLeavesNoOldReason: Story = {
  loaders: [() => ({ port: answersInTurn({ refused: [RESERVED] }, { data: CREATED }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as { port: TurnPort }).port.access} reasonTexts={texts}>
      <ExampleForm onSuccess={() => undefined} />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const { port } = loaded as { port: TurnPort };
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await saveAndAnswer(form, port);
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");

    await userEvent.type(form.description(), " Twice.");
    await saveAndAnswer(form, port);
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

/** The example form with a button beside it that chooses a color by code, as a module may. */
function FormWithAColorSetByCode() {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: "ocean" },
    entryName: "Kitchen",
  });
  return (
    <Stack>
      <OperationFormBody form={form}>
        <Stack>
          <TextField form={form} label="Title" name="title" />
          <TextField form={form} label="Description" name="description" />
          <ColorField form={form} label="Color" name="color" />
          <Button type="submit">Save</Button>
        </Stack>
      </OperationFormBody>
      <Button onClick={() => form.setValue("color", "blue")}>Choose blue</Button>
    </Stack>
  );
}

export const AReasonAtAFieldChangedDuringTheSaveGoesToTheNotice: Story = {
  loaders: [() => ({ port: answersInTurn({ refused: [COLOR_DELETED] }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as { port: TurnPort }).port.access} reasonTexts={texts}>
      <FormWithAColorSetByCode />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const { port } = loaded as { port: TurnPort };
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await form.save();
    // While the save of "ocean" waits, the module chooses another color.
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Choose blue" }));
    port.release();

    // The Reason speaks of the color that was sent, which the field no longer shows.
    await expect(await reasonsInTheNotice()).toEqual(["The linked entry is no longer available."]);
    await saveEnded(form);
    await expect(form.color()).not.toHaveAccessibleDescription(
      "The linked entry is no longer available.",
    );
  },
};

/** A form whose description is a field of the module's own that reports text with "?" unfinished. */
function FormWithAnUnfinishedDescription() {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: null },
  });
  const field = useFieldBinding(form, "description");
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Title" name="title" />
        <TextInput
          label="Description"
          ref={field.ref}
          error={field.error}
          onBlur={field.onBlur}
          onChange={(event) => {
            const text = event.currentTarget.value;
            if (text.includes("?")) field.onUnfinished();
            else field.onChange(text);
          }}
        />
        <Button type="submit">Save</Button>
      </Stack>
    </OperationFormBody>
  );
}

/** The same form, with a button beside it that reports the description unfinished by code. */
function FormWithADescriptionReportedUnfinishedByCode() {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: null },
    entryName: "Kitchen",
  });
  const field = useFieldBinding(form, "description");
  return (
    <Stack>
      <OperationFormBody form={form}>
        <Stack>
          <TextField form={form} label="Title" name="title" />
          <TextInput
            label="Description"
            ref={field.ref}
            error={field.error}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.currentTarget.value)}
          />
          <Button type="submit">Save</Button>
        </Stack>
      </OperationFormBody>
      <Button onClick={() => field.onUnfinished()}>Report unfinished</Button>
    </Stack>
  );
}

export const AReasonAtAFieldThatTurnedUnfinishedDuringTheSaveGoesToTheNotice: Story = {
  loaders: [() => ({ port: answersInTurn({ refused: [{ ...RESERVED, field: "description" }] }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as { port: TurnPort }).port.access} reasonTexts={texts}>
      <FormWithADescriptionReportedUnfinishedByCode />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const { port } = loaded as { port: TurnPort };
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await form.save();
    // The form locks its fields while a save waits, so only code can report text unfinished then.
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Report unfinished" }));
    port.release();

    // The Reason speaks of the description that was sent, which the field no longer holds.
    await expect(await reasonsInTheNotice()).toEqual(["“Kitchen” is kept for the archive."]);
    await saveEnded(form);
    await expect(form.description()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

export const TypingUnfinishedTextAnswersTheReasonAtItsField: Story = {
  loaders: [() => ({ port: answersInTurn({ refused: [{ ...RESERVED, field: "description" }] }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as { port: TurnPort }).port.access} reasonTexts={texts}>
      <FormWithAnUnfinishedDescription />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const { port } = loaded as { port: TurnPort };
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await saveAndAnswer(form, port);
    await expect(form.description()).toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );

    // Text that is no value yet is a change to the field: the Reason is answered at once, and
    // the field's own message waits until the user leaves it, as before.
    await userEvent.type(form.description(), "?");
    await expect(form.description()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
    await expect(form.description()).not.toHaveAccessibleDescription(
      "Complete or clear this field.",
    );
  },
};

/** An edit form of a stored entry, with buttons that store another title, as another window may. */
function FormFollowingItsStoredTitle() {
  const [title, setTitle] = useState("Original");
  const form = useOperationForm({
    entry: exampleContract.update,
    operation: useUpdateExample(),
    draft: { id: ROW, title, description: "Paint the walls.", icon: null, color: null },
    edit: { identity: { id: ROW } },
  });
  return (
    <Stack>
      <OperationFormBody form={form}>
        <Stack>
          <TextField form={form} label="Title" name="title" />
          <Button type="submit">Save</Button>
        </Stack>
      </OperationFormBody>
      <Button onClick={() => setTitle("Kitchen")}>Store Kitchen</Button>
      <Button onClick={() => setTitle("Hall")}>Store Hall</Button>
    </Stack>
  );
}

export const AStoredValueTheFieldFollowsAnswersTheReasonAtIt: Story = {
  loaders: [
    (): Loaded => ({
      port: recordingPortOf(
        { example: exampleContract },
        { example: { update: { refused: [RESERVED] } } },
        { reasons: [referenced, targetDeleted, titleReserved, spaceFull] },
      ),
      created: fn(),
    }),
  ],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
      <FormFollowingItsStoredTitle />
    </DataProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = formIn(canvasElement);
    await userEvent.clear(form.title());
    await userEvent.type(form.title(), "Kitchen");
    await form.save();
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    // Stored as typed, the field is unchanged again; then it follows the next stored title.
    await userEvent.click(canvas.getByRole("button", { name: "Store Kitchen" }));
    await userEvent.click(canvas.getByRole("button", { name: "Store Hall" }));
    await waitFor(() => expect(form.title()).toHaveValue("Hall"));
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

/** What the shared Notice runs as it appears in the next story: code that changes the form. */
let whenNoticed: () => void = () => undefined;

/**
 * The example form with its color "ocean"; as the first Notice appears, it chooses blue by code,
 * or draws the form without its color field.
 */
function FormTheNoticeChanges({ removesTheColor }: { readonly removesTheColor: boolean }) {
  const [colorShown, setColorShown] = useState(true);
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: "ocean" },
    entryName: "Kitchen",
  });
  useLayoutEffect(() => {
    whenNoticed = removesTheColor
      ? () => flushSync(() => setColorShown(false))
      : () => form.setValue("color", "blue");
  });
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Title" name="title" />
        <TextField form={form} label="Description" name="description" />
        {colorShown && <ColorField form={form} label="Color" name="color" />}
        <Button type="submit">Save</Button>
      </Stack>
    </OperationFormBody>
  );
}

/**
 * A save of "ocean" refused at its color and with a Reason no field shows: the first Notice runs
 * code that changes the color field before the form takes the answer.
 */
const changedAsTheNoticeAppears = (removesTheColor: boolean): Story => {
  const notices: RefusedNotice[] = [];
  return {
    loaders: [loadRefused(COLOR_DELETED, FULL)],
    beforeEach: () => {
      notices.length = 0;
    },
    render: (_args, { loaded }) => (
      <DataProvider
        access={(loaded as Loaded).port.access}
        reasonTexts={texts}
        notifyRefused={(notice) => {
          notices.push(notice);
          const run = whenNoticed;
          whenNoticed = () => undefined;
          run();
        }}
      >
        <FormTheNoticeChanges removesTheColor={removesTheColor} />
      </DataProvider>
    ),
    play: async ({ canvasElement }) => {
      const form = formIn(canvasElement);
      await userEvent.type(form.title(), "Kitchen");
      await userEvent.type(form.description(), "Paint the walls.");
      await form.save();
      await saveEnded(form);

      // Each Reason is told once: the color's no longer describes its field, so a Notice tells it.
      await waitFor(() =>
        expect(notices.map(({ reasons }) => reasons.map(({ code }) => code))).toEqual([
          ["space_full"],
          ["target_deleted"],
        ]),
      );
      await expect(notices[1]?.entry).toBe("Kitchen");
      if (!removesTheColor)
        await expect(form.color()).not.toHaveAccessibleDescription(
          "The linked entry is no longer available.",
        );
    },
  };
};

export const AReasonAtAFieldThatChangesAsTheNoticeAppearsGoesToANotice =
  changedAsTheNoticeAppears(false);
export const AReasonAtAFieldThatGoesAsTheNoticeAppearsGoesToANotice =
  changedAsTheNoticeAppears(true);

/** The same Reason texts, with another wording for the reserved title. */
const rewordedTexts = refusalTexts(
  [
    {
      title_reserved: ({ details }) => `“${details.title}” stays in the archive.`,
      space_full: spaceFullText,
    } satisfies { title_reserved: ReasonText<typeof titleReserved>; space_full: unknown },
  ],
  () => undefined,
);

/** The example form under a provider whose Reason texts a button replaces, as the app may. */
function FormUnderTextsThatChange({ access }: { readonly access: Loaded["port"]["access"] }) {
  const [reasonTexts, setReasonTexts] = useState(texts);
  return (
    <DataProvider access={access} reasonTexts={reasonTexts}>
      <Stack>
        <Button onClick={() => setReasonTexts(rewordedTexts)}>Reword</Button>
        <ExampleForm onSuccess={() => undefined} />
      </Stack>
    </DataProvider>
  );
}

export const AReasonAtAFieldFollowsNewReasonTexts: Story = {
  render: (_args, { loaded }) => (
    <FormUnderTextsThatChange access={(loaded as Loaded).port.access} />
  ),
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Reword" }));
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” stays in the archive."),
    );
  },
};
