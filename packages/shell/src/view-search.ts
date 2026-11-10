export type ViewSearch = Readonly<Record<string, unknown>>;

/** Search belongs to a module; edit always belongs to the current View. */
export function retainedViewSearch(
  search: ViewSearch,
  from: string,
  to: string,
  shared: readonly string[] = [],
): ViewSearch {
  if (from !== to) return {};
  return Object.fromEntries(
    Object.entries(search).filter(([key]) => key !== "edit" && shared.includes(key)),
  );
}
