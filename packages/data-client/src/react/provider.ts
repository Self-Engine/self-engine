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
  useRef,
} from "react";
import type { PortAccess } from "./port-access.ts";
import { noticeFailedReload } from "./reload-notice.ts";

/** Answers no View shows are dropped after this long (D250). */
export const UNUSED_ANSWER_LIFETIME_MS = 5 * 60 * 1000;

/**
 * What code outside React needs to call an Operation, such as a Command (D261): the Port access
 * and the one seam every notice of the building block goes through, both the ones the nearest
 * `DataProvider` was given. A story or test that substitutes them collects the notices too.
 */
export interface DataAccess {
  /** How calls reach the Data Process. */
  readonly access: PortAccess;
  /** Shows a notice of the building block, such as an Operation's unexpected error (D251). */
  readonly notify: (notice: MessageDescriptor) => void;
}

interface DataContext extends DataAccess {
  /** Reports, once per entry, a Query hook whose entry the Data Process calls an Operation. */
  readonly checkQuery: (module: string, entry: string) => void;
}

const Context = createContext<DataContext | undefined>(undefined);

/** The Port access and the dev-build report of the nearest `DataProvider`. */
export function useDataContext(): DataContext {
  const context = use(Context);
  if (context === undefined) throw new Error("A Port hook needs a DataProvider above it");
  return context;
}

/**
 * The Port access and notice seam of the nearest `DataProvider`, for what calls an Operation
 * outside React, such as the Shell's Commands (D261): the app and a story hand it on from here.
 * It stays the same object while the provider's access does.
 */
export function useDataAccess(): DataAccess {
  return useDataContext();
}

/**
 * The query cache of the page (D249, D250). An answer stays valid until a Table Change names one
 * of its tables, so nothing reloads on time, window focus, mount or a network change; only Table
 * Changes and reconnects mark answers, and a marked answer on screen reloads at once. A failed
 * reload tells the user once that the answer kept on screen may be outdated (D257).
 */
function createQueryCache(notify: (notice: MessageDescriptor) => void): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: noticeFailedReload(notify) }),
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

/**
 * Marks the answers `changed` picks and reloads those on screen (D250). A first load under way
 * cannot be restarted: the library hands the new reader that same load, whose answer may predate
 * the change and would clear the mark. Such a Query reads once more after that load arrives.
 */
function markChanged(cache: QueryClient, changed: (query: Query) => boolean): void {
  const firstLoads = cache
    .getQueryCache()
    .findAll({ predicate: changed, fetchStatus: "fetching" })
    .filter((query) => query.state.data === undefined);
  void cache.invalidateQueries({ predicate: changed });
  for (const query of firstLoads) readAgainAfter(cache, query);
}

/** First loads that read again once they arrive; one more read covers every change meanwhile. */
const readingAgain = new WeakSet<Query>();

function readAgainAfter(cache: QueryClient, query: Query): void {
  const load = query.promise;
  if (load === undefined || readingAgain.has(query)) return;
  readingAgain.add(query);
  const again = () => {
    readingAgain.delete(query);
    // A load that failed left no answer: the View shows its error and offers a retry.
    if (query.state.status !== "success") return;
    void cache.invalidateQueries({ queryKey: query.queryKey, exact: true });
  };
  load.then(again, again);
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

/** Counts the accesses providers were given, to key the tree below each one's cache. */
let accessGenerations = 0;

/** Gives the tree below one query cache and the Port access (D249). */
export function DataProvider({
  access,
  reportMisuse,
  notify = showNotice,
  children,
}: DataProviderProps): ReactNode {
  // The cache and the context live as long as the provider's access: another access starts with
  // no answers, so none of the old one shows. Callbacks are read through refs, so a parent that
  // passes them inline redraws no hook below.
  const latest = useRef({ notify, reportMisuse });
  useEffect(() => {
    latest.current = { notify, reportMisuse };
  }, [notify, reportMisuse]);
  // A Query hook stays bound to the cache it first drew with, so the tree below is drawn anew for
  // another access, keyed by its cache.
  const { cache, generation } = useMemo(
    () => ({
      cache: createQueryCache((notice) => latest.current.notify(notice)),
      generation: `access-${String(++accessGenerations)}`,
    }),
    [access],
  );
  // The old access's cache stops its timers and drops its answers once it is replaced.
  useEffect(() => () => cache.clear(), [cache]);
  const context = useMemo<DataContext>(() => {
    const reported = new Set<string>();
    return {
      access,
      notify: (notice) => latest.current.notify(notice),
      checkQuery: (module, entry) => {
        const report = latest.current.reportMisuse ?? defaultReport();
        const name = `${module}.${entry}`;
        if (report === undefined || reported.has(name)) return;
        if (access.describeEntry(module, entry)?.kind !== "operation") return;
        reported.add(name);
        report(`The Query hook for ${name} points at an Operation; use an Operation hook.`);
      },
    };
  }, [access]);

  useEffect(() => {
    const stopTables = access.onTablesChanged((tables) => {
      if (tables.length === 0) return;
      const changed = new Set(tables);
      markChanged(cache, (query) => {
        const key = entryOf(query);
        if (key === undefined) return false;
        const description = access.describeEntry(...key);
        // Before the list arrived nothing can be ruled out; an Operation reads nothing.
        if (description === undefined) return true;
        return description.kind === "query" && description.reads.some((t) => changed.has(t));
      });
    });
    // Table Changes may have been lost while the connection was down (D250).
    const stopReconnect = access.onReconnected(() => markChanged(cache, () => true));
    return () => {
      stopTables();
      stopReconnect();
    };
  }, [access, cache]);

  return createElement(
    QueryClientProvider,
    { client: cache, key: generation },
    createElement(Context, { value: context }, children),
  );
}

function defaultReport(): ((problem: string) => void) | undefined {
  return import.meta.env.DEV ? (problem) => console.error(problem) : undefined;
}

/** Shows a notice through the feedback system, translated while it is on screen. */
export function showNotice(notice: MessageDescriptor): void {
  notifyError({ message: createElement(NoticeText, { notice }) });
}

/** A notice's text in the language of the moment, so it follows a language switch. */
function NoticeText({ notice }: { readonly notice: MessageDescriptor }): ReactNode {
  return useLingui().i18n._(notice);
}
