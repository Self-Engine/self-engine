import type { Health } from "@self-engine/data-protocol";
import { implementer } from "../implementer.ts";

/** Answers with the outcome of the start, which does not change while the process runs. */
export function healthProcedure(health: Health) {
  return implementer.health.handler(() => health);
}
