// Test-only reference for reading a Setting (D352); no runtime entry imports it.
import { oc } from "@orpc/contract";
import { refusal } from "@self-engine/db/schema";
import { defineSetting } from "@self-engine/settings";
import { z } from "zod";

/** The Setting the module reads: a Synced Setting, owned by the module through its key's prefix. */
export const workdayHours = defineSetting({
  key: "workday.hours",
  scope: "synced",
  default: 8,
  schema: z.int().min(1).max(24),
});

export const workdayContract = {
  hours: oc.output(z.int()),
  readHours: oc.output(z.int()).errors(refusal),
  /** The Time Zone of the call, as a module that computes days and times gets it. */
  zone: oc.output(z.string()),
};
