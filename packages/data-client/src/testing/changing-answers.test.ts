// The Port access of a story that shows what one change redraws (D256): Fixed Answers that switch
// with a Table Change, and the Query-to-tables list the Data Process would send.

import { expect, test } from "vite-plus/test";
import type { PortAccess } from "../react/port-access.ts";
import { changingAnswers } from "./changing-answers.ts";

/** An access whose every call answers `value`. */
const answering = (value: string): PortAccess => ({
  call: () => Promise.resolve(value),
  describeEntry: () => undefined,
  onTablesChanged: () => () => undefined,
  onReconnected: () => () => undefined,
});

const QUERIES = { notes: { list: ["notes"] } };

test("calls answer from the first access until a change, then from the next", async () => {
  const port = changingAnswers(answering("before"), QUERIES);
  await expect(port.access.call("notes", "list", {})).resolves.toBe("before");

  port.change(answering("after"), ["notes"]);

  await expect(port.access.call("notes", "list", {})).resolves.toBe("after");
});

test("a change delivers its Table Change to every listener until it stops", () => {
  const port = changingAnswers(answering("before"), QUERIES);
  const heard: string[][] = [];
  const stop = port.access.onTablesChanged((tables) => heard.push([...tables]));
  port.change(answering("after"), ["notes"]);
  stop();
  port.change(answering("later"), ["notes"]);

  expect(heard).toEqual([["notes"]]);
});

test("each entry is described from the list: a Query with its tables, otherwise an Operation", () => {
  const { access } = changingAnswers(answering("before"), QUERIES);
  expect(access.describeEntry("notes", "list")).toEqual({ kind: "query", reads: ["notes"] });
  expect(access.describeEntry("notes", "update")).toEqual({ kind: "operation" });
});
