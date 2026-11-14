// The example form, written as a module writes its form (D322): it names the Operation, gives the
// starting draft and lays out its fields. It writes no check, no text and no mapping of a message
// to a field: those come from the helper and the Contract. Its labels are plain English, like
// every story's sample text.

import { Button, Stack } from "@mantine/core";
import type { z } from "zod";
import { ColorField, IconField, LongTextField, TextField, useOperationForm } from "../../index.ts";
import { exampleContract, type exampleEntrySchema } from "./contract.ts";
import { useCreateExample } from "./port.ts";

export type ExampleEntry = z.output<typeof exampleEntrySchema>;

export interface ExampleFormProps {
  /** Called once the entry was created, with the Operation's answer. */
  readonly onSuccess: (entry: ExampleEntry) => void;
}

/** Creates an example entry. */
export function ExampleForm({ onSuccess }: ExampleFormProps) {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: null },
    onSuccess,
  });
  return (
    <Stack>
      <TextField form={form} label="Title" name="title" />
      <LongTextField form={form} label="Description" name="description" />
      <IconField form={form} label="Icon" name="icon" />
      <ColorField form={form} label="Color" name="color" />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}
