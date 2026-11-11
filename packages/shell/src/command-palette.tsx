import { useLingui } from "@lingui/react/macro";
import { type ComponentType, useEffect, useState } from "react";
import { useCommandPalette, useCommandPaletteOpen } from "./command-palette-state.tsx";
import type { CommandScope } from "./palette-entries.ts";
import { reportFailedStart } from "./start-command.tsx";
import { WarmUp } from "./warm-up.tsx";

/** Loads the dialog at the first opening, and from then on it stays mounted and closed. */
export function CommandPalette(props: CommandScope) {
  const { i18n } = useLingui();
  const palette = useCommandPalette();
  const opened = useCommandPaletteOpen();
  const [Dialog, setDialog] = useState<ComponentType<CommandScope>>();
  useEffect(() => {
    if (!opened || Dialog) return;
    void import("./command-palette-dialog.tsx").then(
      ({ CommandPaletteDialog }) => setDialog(() => CommandPaletteDialog),
      (error: unknown) => {
        reportFailedStart(i18n, error);
        palette.scheduleClose();
      },
    );
  }, [opened, Dialog, i18n, palette]);
  return (
    <>
      <WarmUp preload={PRELOAD} />
      {Dialog ? <Dialog {...props} /> : null}
    </>
  );
}

const PRELOAD = [() => import("./command-palette-dialog.tsx")];
