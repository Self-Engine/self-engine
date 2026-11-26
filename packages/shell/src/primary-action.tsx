import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import { useContext } from "react";
import type { PersonCommand } from "./commands.ts";
import { NavigationOverlayContext } from "./routing.tsx";
import { useStartCommand } from "./start-command.tsx";

export function PrimaryAction({
  moduleId,
  command,
}: {
  readonly moduleId: string;
  readonly command: PersonCommand;
}) {
  const { i18n } = useLingui();
  const start = useStartCommand();
  // Starting the action ends the overlay's job, as picking a View does: what the action opens
  // belongs to the page, and the focus returns to the page afterwards (ADR 0041).
  const closeOverlay = useContext(NavigationOverlayContext);
  return (
    <Button
      onClick={() => {
        closeOverlay?.();
        void start(moduleId, command);
      }}
    >
      {i18n._(command.label)}
    </Button>
  );
}
