import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { exampleContract } from "./contract.ts";
import type { ExampleTables } from "./tables.ts";

// The example's hooks, as a module writes them (D249).
const examplePort = portHooks<typeof exampleContract, ExampleTables>("example");

// A Reason at one of these columns is shown at its field (D334); `id`, `icon` and `archived_at` are not mapped.
const columns = {
  example_entries: { title: "title", description: "description", color_set: "color" },
} as const;

export const useCreateExample = examplePort.operation("create", {
  conflicts: { title_taken: { field: "title", text: msg`This title is already in use.` } },
  columns,
});

export const useUpdateExample = examplePort.operation("update", { columns });

export const useDeleteExample = examplePort.operation("delete");

export const useExampleEntries = examplePort.query("list");
