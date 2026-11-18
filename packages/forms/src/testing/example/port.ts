import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { exampleContract } from "./contract.ts";
import type { ExampleTables } from "./tables.ts";

// The example's hooks, as a module writes them (D249).
const examplePort = portHooks<typeof exampleContract, ExampleTables>("example");

export const useCreateExample = examplePort.operation("create", {
  conflicts: { title_taken: { field: "title", text: msg`This title is already in use.` } },
  // A Reason at one of these columns is shown at its field (D334); `icon` and `id` are not mapped.
  columns: { example_entries: { title: "title", description: "description", color_set: "color" } },
});

export const useUpdateExample = examplePort.operation("update");

export const useExampleEntries = examplePort.query("list");
