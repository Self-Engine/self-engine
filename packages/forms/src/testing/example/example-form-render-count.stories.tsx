// The render-count gate of a form (D256, D318): typing in one field redraws no other field. The
// draft lives outside React's state, and each field hears only of its own message, also while
// every change is checked after a failed save. The counts are fixed numbers, not shares.

import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ExampleForm } from "./example-form.tsx";
import { fieldsDrawnDuring } from "./fields-drawn.ts";
import { type RecordingPort, recordingPort } from "./story-port.ts";

const meta = {
  title: "Forms/Example form/Render count",
  loaders: [() => ({ port: recordingPort() })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded["port"] as RecordingPort).access}>
      <ExampleForm onSuccess={() => undefined} />
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const FIELDS = ["TextField", "LongTextField"] as const;

export const TypingInOneFieldRedrawsNoOtherField: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("textbox", { name: "Title" });
    const description = canvas.getByRole("textbox", { name: "Description" });

    // Before the first save, typing redraws no field at all, not even the one typed in.
    await expect(await fieldsDrawnDuring(FIELDS, () => userEvent.type(title, "Kitchen"))).toEqual({
      TextField: 0,
      LongTextField: 0,
    });
    await expect(
      await fieldsDrawnDuring(FIELDS, () => userEvent.type(description, "Paint the walls.")),
    ).toEqual({ TextField: 0, LongTextField: 0 });

    // After a failed save every change is checked, and still only the field whose message
    // changes draws: once when its message goes, and not again while its text stays valid.
    await userEvent.clear(title);
    await userEvent.clear(description);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await fieldsDrawnDuring(FIELDS, () => userEvent.type(title, "Kitchen"))).toEqual({
      TextField: 1,
      LongTextField: 0,
    });
    await expect(
      await fieldsDrawnDuring(FIELDS, () => userEvent.type(description, "Paint the walls.")),
    ).toEqual({ TextField: 0, LongTextField: 1 });
    await expect(await fieldsDrawnDuring(FIELDS, () => userEvent.type(title, " and hall"))).toEqual(
      {
        TextField: 0,
        LongTextField: 0,
      },
    );
    await expect((loaded["port"] as RecordingPort).calls).toEqual([]);
  },
};
