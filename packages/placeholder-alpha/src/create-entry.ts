import type { CommandContext } from "@self-engine/shell";
import { NEW_ENTRY_ID } from "./sample-data.ts";

export default function createEntry({ writeSearch }: CommandContext) {
  writeSearch((search) => ({ ...search, edit: NEW_ENTRY_ID }));
}
