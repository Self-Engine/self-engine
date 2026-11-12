import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { notifyError } from "@self-engine/ui";
import { type Query, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PortAccess } from "./port-access.ts";
import { noticeFailedReload } from "./reload-notice.tsx";

/** Answers no View shows are dropped after this long (D250). */
export const UNUSED_ANSWER_LIFETIME_MS = 5 * 60 * 1000;

interface DataContext {
  readonly access: PortAccess;
  /** Reports, once per entry, a Query hook whose entry the Data Process calls an Operation. */
  readonly checkQuery: (module: string, entry: string) => void;
  /** Shows a notice of the building block, such as an Operation's unexpected error (D251). */
  readonly notify: (notice: MessageDescriptor) => void;
}

const Context = createContext<DataContext | undefined>(undefined);

/** The Port access and the dev-build report of the nearest `DataProvider`. */
export function useDataContext(): DataContext {
  const context = use(Context);
  if (context === undefined) throw new Error("A Port hook needs a DataProvider above it");
  return context;
}

/**
 * The query cache of the page (D249, D250). An answer stays valid until a Table Change names one
 * of its tables, so nothing reloads on time, window focus, mount or a network change; only Table
 * Changes and reconnects mark answers, and a marked answer on screen reloads at once. A failed
 * reload tells the user once that the answer kept on screen may be outdated (D257).
 */
function createQueryCache(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: noticeFailedReload }),
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: UNUSED_ANSWER_LIFETIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Only a marked answer is stale, so a View shown again reloads only after a change.
        refetchOnMount: true,
        // The Data Process is local: a failure is not transient, and a retry would wait on a clock.
        retry: false,
        // The browser's online state says nothing about a local Data Process.
        networkMode: "always",
        // Keeps unchanged rows the same objects across a reload, so `memo` rows stay drawn.
        structuralSharing: true,
      },
    },
  });
}

/** The module and entry a Query hook keyed its answer under (`portHooks`). */
function entryOf(query: Query): readonly [string, string] | undefined {
  const [module, entry] = query.queryKey;
  return typeof module === "string" && typeof entry === "string" ? [module, entry] : undefined;
}

export interface DataProviderProps {
  /** How the hooks below reach the Data Process: the app's connection, or a stand-in. */
  readonly access: PortAccess;
  /**
   * Where a misuse is reported, such as a Query hook on an Operation (D248). By default the dev
   * build logs it, and a production build reports nothing.
   */
  readonly reportMisuse?: (problem: string) => void;
  /**
   * Where the building block's notices go, such as "not found" after an Operation (D251). By
   * default the feedback system shows them as error notices; a test collects them instead.
   */
  readonly notify?: (notice: MessageDescriptor) => void;
  readonly children?: ReactNode;
}

/** Gives the tree below one query cache and the Port access (D249). */
export function DataProvider({
  access,
  reportMisuse,
  notify = showNotice,
  children,
}: DataProviderProps): ReactNode {
  const [cache] = useState(createQueryCache);
  const context = useMemo<DataContext>(() => {
    const report = reportMisuse ?? defaultReport();
    const reported = new Set<string>();
    return {
      access,
      notify,
      checkQuery: (module, entry) => {
        const name = `${module}.${entry}`;
        if (report === undefined || reported.has(name)) return;
        if (access.describeEntry(module, entry)?.kind !== "operation") return;
        reported.add(name);
        report(`The Query hook for ${name} points at an Operation; use an Operation hook.`);
      },
    };
  }, [access, reportMisuse, notify]);

  useEffect(() => {
    const stopTables = access.onTablesChanged((tables) => {
      if (tables.length === 0) return;
      const changed = new Set(tables);
      void cache.invalidateQueries({
        predicate(query) {
          const key = entryOf(query);
          if (key === undefined) return false;
          const description = access.describeEntry(...key);
          // Before the list arrived nothing can be ruled out; an Operation reads nothing.
          if (description === undefined) return true;
          return description.kind === "query" && description.reads.some((t) => changed.has(t));
        },
      });
    });
    // Table Changes may have been lost while the connection was down (D250).
    const stopReconnect = access.onReconnected(() => void cache.invalidateQueries());
    return () => {
      stopTables();
      stopReconnect();
    };
  }, [access, cache]);

  return createElement(
    QueryClientProvider,
    { client: cache },
    createElement(Context, { value: context }, children),
  );
}

function defaultReport(): ((problem: string) => void) | undefined {
  return import.meta.env.DEV ? (problem) => console.error(problem) : undefined;
}

/** Shows a notice through the feedback system, translated while it is on screen. */
function showNotice(notice: MessageDescriptor): void {
  notifyError({ message: createElement(NoticeText, { notice }) });
}

/** A notice's text in the language of the moment, so it follows a language switch. */
function NoticeText({ notice }: { readonly notice: MessageDescriptor }): ReactNode {
  return useLingui().i18n._(notice);
}
