// The example form, written as a module writes its form (D322): it names the Operation, gives the
// starting draft and lays out its fields. It writes no check and no mapping of a message
// to a field: those come from the helper and the Contract. It gives only its special texts. Its labels are plain English, like
// every story's sample text.

import { msg } from "@lingui/core/macro";
import { Button, Stack } from "@mantine/core";
import type { z } from "zod";
import { LongTextField, OperationFormBody, TextField, useOperationForm } from "../../index.ts";
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
    draft: { title: "", description: "" },
    texts: {
      fields: { title: msg`Give this entry a title of at most 80 characters.` },
      reasons: { description_matches_title: msg`The description must differ from the title.` },
    },
    onSuccess,
  });
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Title" name="title" />
        <LongTextField form={form} label="Description" name="description" />
        <Button type="submit">Save</Button>
      </Stack>
    </OperationFormBody>
  );
}
