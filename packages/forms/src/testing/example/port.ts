import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { exampleContract } from "./contract.ts";

// The example's hooks, as a module writes them (D249).
const examplePort = portHooks<typeof exampleContract>("example");

export const useCreateExample = examplePort.operation("create", {
  conflicts: { title_taken: { field: "title", text: msg`This title is already in use.` } },
});

export const useUpdateExample = examplePort.operation("update");
