import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { PortAccess } from "@self-engine/data-client/react";
import { notifyError } from "@self-engine/ui";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { fullCommandId, type PersonCommand } from "./commands.ts";
import { useShellRouting } from "./routing.tsx";
import { runCommand } from "./run-command.ts";

const START_FAILED = msg`The action could not be completed. Please try again.`;

/** Keeps the cause for the log and tells the person. `i18n` so that an effect can depend on it. */
export function reportFailedStart(i18n: I18n, error: unknown) {
  console.error(error);
  notifyError({ message: i18n._(START_FAILED) });
}

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

interface StartContext {
  readonly startOnce: StartOnce;
  /** The Port access every Command is given (D261). */
  readonly data: PortAccess;
}

const StartContext = createContext<StartContext | null>(null);

/**
 * Once per Shell: a Command counts as running however a person started it, and every Command is
 * given the Shell's Port access.
 */
export function StartOnceProvider({
  data,
  children,
}: {
  readonly data: PortAccess;
  readonly children: ReactNode;
}) {
  const [startOnce] = useState(createStartOnce);
  const context = useMemo(() => ({ startOnce, data }), [startOnce, data]);
  return <StartContext value={context}>{children}</StartContext>;
}

/**
 * The one way a person starts a Command. It captures the page at the moment of the press, ignores
 * a second start of the same Command while the first is running, and reports a failure. With
 * `goFirstTo` it moves to that View first, and runs on the page it arrived at or not at all.
 */
export function useStartCommand() {
  const { i18n } = useLingui();
  const routing = useShellRouting();
  const address = routing.useAddress();
  const goToView = routing.useGoToView();
  const start = useContext(StartContext);
  if (start === null) throw new Error("Starting a Command needs the Shell");
  const { startOnce, data } = start;

  return (moduleId: string, command: PersonCommand, goFirstTo?: string) =>
    startOnce(fullCommandId(moduleId, command.id), async () => {
      try {
        if (goFirstTo !== undefined && !(await goToView(goFirstTo))) return;
        const result = await (command.kind === "page"
          ? runCommand(command, {}, { writeSearch: address.scopedWriteSearch(), data })
          : runCommand(command, {}, { data }));
        if (!result.ok) reportFailedStart(i18n, result.error);
      } catch (error) {
        // The move asks the leave guards, which are a module's code and may throw.
        reportFailedStart(i18n, error);
      }
    });
}
