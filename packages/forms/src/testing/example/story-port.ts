// The Port of the example form's stories: Fixed Answers of the invented Contract (D255), with
// every call written down, so a story asserts which call reached the Port.

import type { PortAccess } from "@self-engine/data-client/react";
import {
  changingAnswers,
  type Contracts,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import { exampleContract } from "./contract.ts";

const contracts = { example: exampleContract };

export interface PortCall {
  readonly entry: string;
  readonly input: unknown;
}

export interface RecordingPort {
  readonly access: PortAccess;
  /** Every call that reached the Port, in order. */
  readonly calls: PortCall[];
}

/** The entry `create` answers by default. */
export const CREATED = {
  id: "example-1",
  title: "Kitchen",
  description: "Paint the walls.",
  icon: null,
  color: null,
} as const;

/** A Port that answers what `answers` fixes and writes down each call. */
export function recordingPort(
  answers: FixedAnswers<typeof contracts>["example"] = { create: { data: CREATED } },
): RecordingPort {
  return recordingPortOf(contracts, { example: answers });
}

/** A Port of other `contracts` that answers what `answers` fixes and writes down each call. */
export function recordingPortOf<Of extends Contracts>(
  of: Of,
  answers: FixedAnswers<Of>,
): RecordingPort {
  const fixed = fixedAnswers(of, answers);
  const calls: PortCall[] = [];
  return {
    calls,
    access: {
      ...fixed,
      call(module, entry, input, signal) {
        calls.push({ entry, input });
        return fixed.call(module, entry, input, signal);
      },
    },
  };
}

/** The table the example entries live in, as the Data Process would name it (D248). */
const EXAMPLE_TABLE = "example_entries";

type ExampleAnswers = NonNullable<FixedAnswers<typeof contracts>["example"]>;

export interface ChangingPort extends RecordingPort {
  /**
   * Answers from `next` from now on and delivers the Table Change of the example entries, as the
   * Data Process does after another window, an assistant or the sync wrote them.
   */
  readonly change: (next: ExampleAnswers) => void;
}

/**
 * A Port whose stored entries change under an open form (Changing Answers): it answers `first`
 * until the story calls `change`. Only the Operations are written down, not the reloads of the
 * Query.
 */
export function changingPort(first: ExampleAnswers): ChangingPort {
  const answers = (of: ExampleAnswers) => fixedAnswers(contracts, { example: of });
  const port = changingAnswers(answers(first), { example: { list: [EXAMPLE_TABLE] } });
  const calls: PortCall[] = [];
  return {
    calls,
    access: {
      ...port.access,
      call(module, entry, input, signal) {
        if (port.access.describeEntry(module, entry)?.kind !== "query")
          calls.push({ entry, input });
        return port.access.call(module, entry, input, signal);
      },
    },
    change: (next) => port.change(answers(next), [EXAMPLE_TABLE]),
  };
}
