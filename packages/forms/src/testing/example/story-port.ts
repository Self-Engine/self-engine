// The Port of the example form's stories: Fixed Answers of the invented Contract (D255), with
// every call written down, so a story asserts which call reached the Port.

import type { PortAccess } from "@self-engine/data-client/react";
import { type Contracts, type FixedAnswers, fixedAnswers } from "@self-engine/data-client/testing";
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
