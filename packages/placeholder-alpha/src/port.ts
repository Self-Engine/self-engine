import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { z } from "zod";
import type { entrySchema, placeholderAlphaContract } from "./contracts/index.ts";

// The module's hooks, built from its Contract and its mount name (D249). The Contract arrives as a
// type only, so its schemas never load in the app (D255); the module names no tables (D248).
const alphaPort = portHooks<typeof placeholderAlphaContract>("placeholderAlpha");

/** An entry as the Port answers it. */
export type Entry = z.output<typeof entrySchema>;

/** The input of the list: it has no filters. */
export const ALL_ENTRIES = {};

const nameTaken = {
  conflicts: {
    name_taken: { text: msg`An entry with this name already exists.`, field: "name" },
  },
} as const;

export const useEntries = alphaPort.query("list");
export const useCreateEntry = alphaPort.operation("create", nameTaken);
export const useRenameEntry = alphaPort.operation("rename", nameTaken);
export const useDeleteEntry = alphaPort.operation("delete");
/**
 * Undo has no form to show a conflict at: when another entry took the name meanwhile, the text is
 * shown as a notice, and the field is the input's only one (D251).
 */
export const useRestoreEntry = alphaPort.operation("restore", {
  conflicts: {
    name_taken: {
      text: msg`The entry could not come back: another entry has its name now.`,
      field: "id",
    },
  },
});

/** `create` for the Commands, which run outside React and are given the Port access (D261). */
export const createEntry = alphaPort.run("create", nameTaken);
