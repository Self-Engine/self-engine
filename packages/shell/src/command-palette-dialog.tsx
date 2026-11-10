import "@mantine/spotlight/styles.css";

import { useLingui } from "@lingui/react/macro";
import { Kbd } from "@mantine/core";
import { createSpotlight, Spotlight, useSpotlight } from "@mantine/spotlight";
import { useEffect, useMemo, useState } from "react";
import {
  type CommandPaletteProps,
  useCommandPalette,
  useCommandPaletteOpen,
} from "./command-palette.tsx";
import { NOT_WINDOW_DRAG_STYLE } from "./navigation-style.ts";
import {
  isViewEntry,
  type PaletteEntry,
  paletteEntries,
  paletteGroups,
} from "./palette-entries.ts";
import { useShellRouting } from "./routing.tsx";
import { displayShortcut } from "./shortcut-bindings.tsx";
import { useStartCommand } from "./start-command.tsx";

type SpotlightStore = ReturnType<typeof createSpotlight>[0];

// It opens over the content header, whose drag region would swallow the clicks.
const SPOTLIGHT_STYLES = { content: NOT_WINDOW_DRAG_STYLE, overlay: NOT_WINDOW_DRAG_STYLE };

function PaletteRow({ entry, onPick }: { entry: PaletteEntry; onPick: () => void }) {
  const { Link } = useShellRouting();
  const start = useStartCommand();
  const rightSection =
    !isViewEntry(entry) && entry.shortcut !== undefined ? (
      <Kbd size="xs">{entry.shortcut}</Kbd>
    ) : undefined;
  if (isViewEntry(entry)) {
    // Mantine's button takes `component` as everywhere, only Spotlight's types do not pass it on.
    const asLink = { component: Link, to: entry.to } as object;
    return <Spotlight.Action {...asLink} label={entry.label} onClick={onPick} />;
  }
  return (
    <Spotlight.Action
      label={entry.label}
      onClick={() => {
        onPick();
        void start(entry.moduleId, entry.command);
      }}
      rightSection={rightSection}
    />
  );
}

/** Only rendered while the palette is open, so a closed palette builds and translates nothing. */
function PaletteResults({
  store,
  owners,
  activeModuleId,
}: CommandPaletteProps & { readonly store: SpotlightStore }) {
  const { t, i18n } = useLingui();
  const palette = useCommandPalette();
  const { query } = useSpotlight(store);
  const { locale } = i18n;
  const entries = useMemo(
    () =>
      paletteEntries(owners, activeModuleId, {
        translate: (descriptor) => i18n._(descriptor),
        formatShortcut: displayShortcut,
      }),
    // `locale` because `i18n` stays the same object through a language switch.
    [owners, activeModuleId, i18n, locale],
  );
  const groups = paletteGroups(entries, activeModuleId, query);
  return (
    <Spotlight.ActionsList>
      {groups.map(({ moduleId, moduleName, entries: rows }) => (
        <Spotlight.ActionsGroup
          aria-label={moduleName}
          key={moduleId}
          label={moduleName}
          role="group"
        >
          {rows.map((entry) => (
            // Back first: the guard of a Command that was started here asks where the focus is.
            <PaletteRow entry={entry} key={entry.key} onPick={palette.returnFocus} />
          ))}
        </Spotlight.ActionsGroup>
      ))}
      {groups.length === 0 && <Spotlight.Empty>{t`Nothing found`}</Spotlight.Empty>}
    </Spotlight.ActionsList>
  );
}

export function CommandPaletteDialog(props: CommandPaletteProps) {
  const { t } = useLingui();
  const palette = useCommandPalette();
  const opened = useCommandPaletteOpen();
  const [[store, actions]] = useState(createSpotlight);
  // Mounted closed first and opened from here, so that the first opening also animates.
  useEffect(() => {
    if (opened) actions.open();
  }, [opened, actions]);
  return (
    <Spotlight.Root
      attributes={{ content: { "aria-label": t`Command palette` } }}
      onSpotlightClose={() => {
        palette.returnFocus();
        palette.finished();
      }}
      // Off, because Mantine returns it a moment later and would take it from a question.
      returnFocus={false}
      shortcut={null}
      store={store}
      styles={SPOTLIGHT_STYLES}
    >
      <Spotlight.Search aria-label={t`Search commands and views`} placeholder={t`Search…`} />
      <PaletteResults {...props} store={store} />
    </Spotlight.Root>
  );
}
