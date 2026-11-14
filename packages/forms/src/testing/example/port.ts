import { portHooks } from "@self-engine/data-client/react";
import type { exampleContract } from "./contract.ts";

// The example's hooks, as a module writes them (D249).
const examplePort = portHooks<typeof exampleContract>("example");

export const useCreateExample = examplePort.operation("create");
