import { msg } from "@lingui/core/macro";
import { useViewSearch } from "@self-engine/shell";

export const clients = [
  { id: "studio", name: msg`Studio`, entry: msg`Studio work` },
  { id: "garden", name: msg`Garden`, entry: msg`Garden work` },
];

/** The address of an entry that does not exist yet. */
export const NEW_ENTRY_ID = "new";

/** Unknown or malformed filters mean all sample entries. */
export function useClientFilter() {
  return useViewSearch((search) =>
    clients.some(({ id }) => id === search.client) ? String(search.client) : undefined,
  );
}
