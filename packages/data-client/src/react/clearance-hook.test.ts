// @vitest-environment happy-dom

import { findReason, referenced } from "@self-engine/data-protocol";
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { fixedAnswers } from "../testing/index.ts";
import { renderHook, unmountHook } from "./hook-harness.ts";
import { clearanceQueryFor, useClearance } from "./index.ts";

type NoteId = string & { readonly noteId: unique symbol };
type LinkId = string & { readonly linkId: unique symbol };
type Tables = {
  notes: { id: NoteId; archived_at: string | null };
  links: { id: LinkId };
  local_cache: { id: string };
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
  const call = vi.fn(access.call.bind(access));
  const hook = await renderHook({ access: { ...access, call } }, () =>
    useClearance(query({ table: "notes", rows: [row], writes: ["delete", "archive", "restore"] })),
  );
  expect(hook.current()).toEqual({
    status: "content",
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
  expect(call).toHaveBeenCalledTimes(1);
  await hook.show(false);
  await hook.show(true);
  expect(call).toHaveBeenCalledTimes(2);
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
