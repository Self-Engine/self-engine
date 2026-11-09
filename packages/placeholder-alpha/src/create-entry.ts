import type { CommandContext } from "@self-engine/shell";

export default function createEntry({ writeSearch }: CommandContext) {
  writeSearch((search) => ({ ...search, edit: "new" }));
}
