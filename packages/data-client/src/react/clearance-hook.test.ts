// @vitest-environment happy-dom

import {
  type Archivable,
  type Convention,
  findReason,
  referenced,
  type RowClearance,
} from "@self-engine/data-protocol";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { fixedAnswers } from "../testing/index.ts";
import { fakePort, held, renderHook, settle, unmountHook } from "./hook-harness.ts";
import {
  type ClearanceQuery,
  clearanceQueryFor,
  type ClearanceState,
  DataProvider,
  useClearance,
} from "./index.ts";

type NoteId = string & { readonly noteId: unique symbol };
type LinkId = string & { readonly linkId: unique symbol };
type Tables = {
  notes: Convention & Archivable & { id: NoteId };
  links: Convention & { id: LinkId };
  local_cache: Convention;
};
const query = clearanceQueryFor<Tables>();
const row = "note-1" as NoteId;
const reason = {
  code: "referenced" as const,
  table: "notes",
  row,
  details: { tables: [{ table: "links", count: 2 }] },
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  unmountHook();
  vi.useRealTimers();
});

test("a Clearance has blocked, free and not-found writes with Reasons like a Refusal", async () => {
  const access = fixedAnswers(
    {},
    {},
    {
      reasons: [referenced],
      clearance: [
        {
          table: "notes",
          row,
          writes: {
            delete: { state: "blocked", reasons: [reason] },
            archive: { state: "free" },
            restore: { state: "notFound" },
          },
        },
      ],
    },
  );
  const clearance = vi.fn(access.clearance.bind(access));
  const asked = query({ table: "notes", rows: [row], writes: ["delete", "archive", "restore"] });
  const hook = await renderHook({ access: { ...access, clearance } }, () => useClearance(asked));
  expect(hook.current()).toEqual({
    status: "content",
    query: asked,
    data: [
      {
        row,
        writes: {
          delete: { state: "blocked", reasons: [{ ...reason, severity: "blocking" }] },
          archive: { state: "free" },
          restore: { state: "notFound" },
        },
      },
    ],
  });
  const state = hook.current();
  const deletion = state.status === "content" ? state.data[0]?.writes.delete : undefined;
  if (deletion?.state !== "blocked") throw new Error("Expected a blocked delete");
  expect(findReason(deletion, referenced)?.details.tables[0]?.count).toBe(2);

  await hook.redraw();
  expect(clearance).toHaveBeenCalledTimes(1);
  await hook.show(false);
  await hook.show(true);
  expect(clearance).toHaveBeenCalledTimes(2);
});

test("a Fixed Clearance fails at setup for a Reason nobody defined", () => {
  expect(() =>
    fixedAnswers(
      {},
      {},
      {
        reasons: [referenced],
        clearance: [
          {
            table: "notes",
            row,
            writes: {
              delete: {
                state: "blocked",
                reasons: [{ ...reason, code: "missing" as "referenced" }],
              },
            },
          },
        ],
      },
    ),
  ).toThrow(/clearance.*no Reason "missing" is defined/);
});

test("a Clearance Query types table names, row ids and archivable writes together", () => {
  const note = query({ table: "notes", rows: [row], writes: ["archive"] });
  expectTypeOf(note.rows[0]).toEqualTypeOf<NoteId>();
  // @ts-expect-error Only a row id of the named table fits.
  query({ table: "links", rows: [row], writes: ["delete"] });
  // @ts-expect-error A table without archived_at cannot be archived.
  query({ table: "links", rows: ["link-1" as LinkId], writes: ["archive"] });
  // @ts-expect-error Local Tables have no Clearance.
  query({ table: "local_cache", rows: ["cache-1"], writes: ["delete"] });
  // @ts-expect-error A Clearance needs at least one row.
  query({ table: "notes", rows: [], writes: ["delete"] });
});

/** A fake Port whose Clearance waits until the test answers it, with the signal of each call. */
function waitingClearance() {
  const port = fakePort();
  const answer = held<readonly RowClearance[]>();
  const signals: AbortSignal[] = [];
  const access = {
    ...port.access,
    clearance: (request: Parameters<typeof port.access.clearance>[0], signal?: AbortSignal) => {
      if (signal !== undefined) signals.push(signal);
      return port.access.clearance(request, signal);
    },
  };
  port.answerClearance(() => answer.promise);
  const free: readonly RowClearance[] = [{ row, writes: { delete: { state: "free" } } }];
  return { port, access, signals, answer: () => answer.resolve(free), free };
}

const deleteNote = query({ table: "notes", rows: [row], writes: ["delete"] });

test("an opening asks once and says what it asked, also when given another Query later", async () => {
  const { access, answer, free } = waitingClearance();
  const clearance = vi.fn(access.clearance);
  let given: ClearanceQuery = deleteNote;
  const hook = await renderHook({ access: { ...access, clearance } }, () => useClearance(given));
  given = query({ table: "notes", rows: [row], writes: ["delete", "archive"] });
  await hook.redraw();
  expect(hook.current()).toEqual({ status: "loading", query: deleteNote });

  answer();
  await vi.waitFor(() => expect(hook.current().status).toBe("content"));

  expect(hook.current()).toEqual({ status: "content", data: free, query: deleteNote });
  expect(clearance).toHaveBeenCalledOnce();
  expect(clearance.mock.calls[0]?.[0]).toEqual(deleteNote);
});

test("a closed opening calls off its Clearance, so none waits for a Port no drawer reads", async () => {
  const { access, signals } = waitingClearance();
  const hook = await renderHook({ access }, () => useClearance(deleteNote));
  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(false);

  await hook.show(false);

  expect(signals[0]?.aborted).toBe(true);
});

test("an opening left on screen keeps one call through Strict Mode's replay and gets its answer", async () => {
  const { port, access, signals, answer, free } = waitingClearance();
  let state: ClearanceState | undefined;
  function Probe() {
    state = useClearance(deleteNote);
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(DataProvider, { access }, createElement(Probe)),
      ),
    ),
  );
  await settle();

  answer();
  await settle();

  expect(port.calls.filter(({ entry }) => entry === "clearance")).toHaveLength(1);
  expect(signals.map((signal) => signal.aborted)).toEqual([false]);
  expect(state).toEqual({ status: "content", data: free, query: deleteNote });
  act(() => root.unmount());
});
