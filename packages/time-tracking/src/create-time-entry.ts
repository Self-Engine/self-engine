import { defineInputCommand } from "@self-engine/shell";
import { timeEntryCreateInput } from "./contracts/index.ts";
import { createTimeEntry } from "./port.ts";

// The Command checks with the input schema of the Contract, so a wrong or unknown field, or an
// end not after the start, is answered as the input error with its field before any call; the
// Data Process checks the same again. It loads only when it runs.
export default defineInputCommand({
  description:
    "Creates a time entry. timeKind is work (the default), short_break (a break that counts), rest_break (a break that does not count) or leisure (time outside work, never counts); an entry that is not work takes no projects and no breaks. startedAt and endedAt are required Instants (ISO 8601 in UTC, such as 2026-11-18T08:00:00.000Z); the end lies at least one second after the start. projects (the ordered list of the entry's projects, the Lead Project first, each { projectId, weight } with weight an optional whole number from 1 to 10000; without weights the projects get equal parts) and note are optional, and so is breaks: a list of breaks inside the entry, each with timeKind short_break (counts) or rest_break (does not count, with changedByLimit false), startedAt and endedAt; a break lies after the start and before the end, at least one second long, and overlaps no other. Answers with the entry, or with the input error and its field.",
  schema: timeEntryCreateInput,
  run: (input, { data }) => createTimeEntry(data, input),
});
