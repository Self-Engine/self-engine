import type { MessageDescriptor } from "@lingui/core";
import type { CommandOwner, PersonCommand } from "./commands.ts";
import { viewPath } from "./contributions.ts";

const MOST_ROWS = 8;

interface EntryBase {
  readonly key: string;
  readonly moduleId: string;
  /** Translated. */
  readonly moduleName: string;
  /** Translated. */
  readonly label: string;
  /** The label as it is compared, worked out once per opening and not per key press. */
  readonly searched: string;
}

export interface CommandEntry extends EntryBase {
  readonly command: PersonCommand;
  /** In the notation of the platform. */
  readonly shortcut: string | undefined;
}

export interface ViewEntry extends EntryBase {
  readonly to: string;
}

export type PaletteEntry = CommandEntry | ViewEntry;

export const isViewEntry = (entry: PaletteEntry): entry is ViewEntry => "to" in entry;

export interface PaletteOwner extends CommandOwner {
  readonly name: MessageDescriptor;
  readonly views: readonly { readonly id: string; readonly title: MessageDescriptor }[];
}

export interface EntryTools {
  readonly translate: (descriptor: MessageDescriptor) => string;
  readonly formatShortcut: (shortcut: string) => string;
}

/**
 * Every entry the palette can show, in the order of the contributions and with a module's Commands
 * before its Views. A `page` Command needs its module on screen, so another module's stays out.
 */
export function paletteEntries(
  owners: readonly PaletteOwner[],
  activeModuleId: string | undefined,
  { translate, formatShortcut }: EntryTools,
): readonly PaletteEntry[] {
  return owners.flatMap((owner) => {
    const moduleName = translate(owner.name);
    const base = (key: string, label: string): EntryBase => ({
      key: `${owner.id}.${key}`,
      moduleId: owner.id,
      moduleName,
      label,
      searched: label.toLowerCase(),
    });
    const commands = (owner.commands ?? []).flatMap((command): CommandEntry[] => {
      if (command.kind === "input") return [];
      if (command.kind === "page" && owner.id !== activeModuleId) return [];
      const { defaultShortcut } = command;
      return [
        {
          ...base(command.id, translate(command.label)),
          command,
          shortcut: defaultShortcut === undefined ? undefined : formatShortcut(defaultShortcut),
        },
      ];
    });
    const views = owner.views.map((view): ViewEntry => ({
      ...base(`view.${view.id}`, translate(view.title)),
      to: viewPath(owner.id, view.id),
    }));
    return [...commands, ...views];
  });
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

const WORD_START = 0;
const INSIDE_A_WORD = 1;

function matchOf(searched: string, query: string) {
  let at = searched.indexOf(query);
  if (at === -1) return undefined;
  for (; at !== -1; at = searched.indexOf(query, at + 1)) {
    if (at === 0 || !WORD_CHARACTER.test(searched[at - 1]!)) return WORD_START;
  }
  return INSIDE_A_WORD;
}

function whenEmpty(entries: readonly PaletteEntry[], activeModuleId: string | undefined) {
  const active = (entry: PaletteEntry) => entry.moduleId === activeModuleId;
  return [
    ...entries.filter((entry) => active(entry) && !isViewEntry(entry)),
    ...entries.filter((entry) => active(entry) && isViewEntry(entry)),
    ...entries.filter((entry) => !active(entry) && !isViewEntry(entry)),
  ];
}

function whenSearching(
  entries: readonly PaletteEntry[],
  activeModuleId: string | undefined,
  query: string,
) {
  const inOtherModule = (entry: PaletteEntry) => (entry.moduleId === activeModuleId ? 0 : 1);
  return entries
    .flatMap((entry) => {
      const match = matchOf(entry.searched, query);
      return match === undefined ? [] : [{ entry, match }];
    })
    .toSorted((a, b) => a.match - b.match || inOtherModule(a.entry) - inOtherModule(b.entry))
    .map(({ entry }) => entry);
}

export interface PaletteGroup {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly entries: readonly PaletteEntry[];
}

/** What the palette lists for a search: at most eight rows, each module's together. */
export function paletteGroups(
  entries: readonly PaletteEntry[],
  activeModuleId: string | undefined,
  search: string,
): readonly PaletteGroup[] {
  const query = search.trim().toLowerCase();
  const found =
    query === ""
      ? whenEmpty(entries, activeModuleId)
      : whenSearching(entries, activeModuleId, query);
  const groups = new Map<string, PaletteEntry[]>();
  // A Map keeps its first insertion, so the groups stand in the order of their best match.
  for (const entry of found.slice(0, MOST_ROWS)) {
    const rows = groups.get(entry.moduleId);
    if (rows) rows.push(entry);
    else groups.set(entry.moduleId, [entry]);
  }
  return [...groups].map(([moduleId, rows]) => ({
    moduleId,
    moduleName: rows[0]!.moduleName,
    entries: rows,
  }));
}
