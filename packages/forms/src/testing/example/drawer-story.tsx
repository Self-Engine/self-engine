// Real Shell fixture: stories exercise its leave guard rather than reproducing it.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  askLeaveGuards,
  Shell,
  type EditDrawerProps,
  type LeaveGuard,
  type ShellContribution,
  type ShellRouting,
  type ViewSearch,
} from "@self-engine/shell";
import { NO_DATA_PROCESS } from "@self-engine/data-client/react";
import { loadStoryShell } from "@self-engine/shell/story-interactions";

export { loadStoryShell };
function routing(): ShellRouting {
  let search: ViewSearch = { edit: "example-1" };
  const listeners = new Set<() => void>();
  const guards = new Set<LeaveGuard>();
  const writeSearch = (update: (previous: ViewSearch) => ViewSearch) => {
    const next = update(search);
    void askLeaveGuards(guards, {
      current: { pathname: "/example", search },
      next: { pathname: "/example", search: next },
    }).then((allowed) => {
      if (!allowed) return;
      search = next;
      for (const listener of listeners) listener();
    });
  };
  const address = {
    search: () => search,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    writeSearch,
    scopedWriteSearch: () => writeSearch,
  };
  return {
    useAddress: () => address,
    useGoToView: () => async () => true,
    useLeaveGuard: (guard, enabled) => {
      useEffect(() => {
        if (!enabled) return;
        guards.add(guard);
        return () => {
          guards.delete(guard);
        };
      }, [guard, enabled]);
    },
    Link: ({ to, search: _search, ...props }) => <a href={to} {...props} />,
  };
}
const Draw = createContext<(props: EditDrawerProps) => ReactNode>(() => null);
function Content(props: EditDrawerProps) {
  return useContext(Draw)(props);
}
export function StoryDrawer({
  children,
}: {
  readonly children: (props: EditDrawerProps) => ReactNode;
}) {
  const [state] = useState(() => {
    const module: ShellContribution = {
      id: "example",
      name: { id: "story-example", message: "Example" },
      icon: () => null,
      color: "blue",
      views: [
        {
          id: "overview",
          title: { id: "story-overview", message: "Overview" },
          load: async () => ({ default: () => null }),
        },
      ],
      editDrawer: async () => ({ default: Content }),
    };
    return { module, routing: routing() };
  });
  return (
    <Draw.Provider value={children}>
      <Shell
        activeModule={state.module}
        activeView={state.module.views[0]}
        contributions={[state.module]}
        settings={state.module}
        data={{ access: NO_DATA_PROCESS, notify: () => {} }}
        routing={state.routing}
        onModuleSidebarCollapsedCommit={() => {}}
        onModuleSidebarWidthCommit={() => {}}
        onNavbarCommit={() => {}}
      >
        <p>Outside drawer</p>
      </Shell>
    </Draw.Provider>
  );
}
