import { useLingui } from "@lingui/react/macro";
import { notifyError } from "@self-engine/ui";
import { createContext, type ReactNode, useContext, useState } from "react";
import { fullCommandId, type PersonCommand } from "./commands.ts";
import { useShellRouting } from "./routing.tsx";
import { runCommand } from "./run-command.ts";

type StartOnce = (fullId: string, work: () => Promise<void>) => Promise<void>;

function createStartOnce(): StartOnce {
  const running = new Set<string>();
  return async (fullId, work) => {
    if (running.has(fullId)) return;
    running.add(fullId);
    try {
      await work();
    } finally {
      running.delete(fullId);
    }
  };
}

const StartOnceContext = createContext<StartOnce | null>(null);

/** Once per Shell: a Command counts as running however a person started it. */
export function CommandStarts({ children }: { readonly children: ReactNode }) {
  const [startOnce] = useState(createStartOnce);
  return <StartOnceContext value={startOnce}>{children}</StartOnceContext>;
}

/**
 * The one way a person starts a Command. It captures the page at the moment of the press, ignores
 * a second start of the same Command while the first is running, and reports a failure.
 */
export function useStartCommand() {
  const { t } = useLingui();
  const address = useShellRouting().useAddress();
  const startOnce = useContext(StartOnceContext);
  if (startOnce === null) throw new Error("Starting a Command needs the Shell");

  return (moduleId: string, command: PersonCommand) =>
    startOnce(fullCommandId(moduleId, command.id), async () => {
      const result = await (command.kind === "page"
        ? runCommand(command, {}, { writeSearch: address.scopedWriteSearch() })
        : runCommand(command, {}, {}));
      if (result.ok) return;
      console.error(result.error);
      notifyError({ message: t`The action could not be completed. Please try again.` });
    });
}
