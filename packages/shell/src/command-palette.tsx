import { useLingui } from "@lingui/react/macro";
import { notifyError } from "@self-engine/ui";
import { type ComponentType, useEffect, useState } from "react";
import {
  type CommandPaletteProps,
  useCommandPalette,
  useCommandPaletteOpen,
} from "./command-palette-state.tsx";

/** Loads the dialog at the first opening, and from then on it stays mounted and closed. */
export function CommandPalette(props: CommandPaletteProps) {
  const { t } = useLingui();
  const palette = useCommandPalette();
  const opened = useCommandPaletteOpen();
  const [Dialog, setDialog] = useState<ComponentType<CommandPaletteProps>>();
  const failureMessage = t`The action could not be completed. Please try again.`;
  useEffect(() => {
    if (!opened || Dialog) return;
    void import("./command-palette-dialog.tsx").then(
      ({ CommandPaletteDialog }) => setDialog(() => CommandPaletteDialog),
      (error: unknown) => {
        console.error(error);
        notifyError({ message: failureMessage });
        palette.finished();
      },
    );
  }, [opened, Dialog, failureMessage, palette]);
  return Dialog ? <Dialog {...props} /> : null;
}
