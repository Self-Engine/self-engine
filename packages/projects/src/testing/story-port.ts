// The Port of the `projects` stories: Fixed Answers (D255) that a story can change under an open
// View, as another window, an assistant or the sync would (Changing Answers), with every Operation
// written down, so a story asserts which call reached the Port.

import type { PortAccess } from "@self-engine/data-client/react";
import { changingAnswers } from "@self-engine/data-client/testing";

export interface PortCall {
  readonly entry: string;
  readonly input: unknown;
}

export interface ProjectsStoryPort<Answers = object> {
  readonly access: PortAccess;
  /** Every Operation that reached the Port, in order; the reloads of a Query are left out. */
  readonly calls: PortCall[];
  /** Answers `next` over the succeeding answers from now on, and delivers the Table Change. */
  readonly change: (next: Answers) => void;
}

/** The table of `projects`, as the Data Process's Query-to-tables list names it (D248). */
const TABLE = "projects";

/**
 * A Port that answers what `answersOf(first)` builds. `afterCall` runs after each Operation
 * answered, so a story can change the stored projects the way that Operation would.
 */
export function storyPortOf<Answers>(
  answersOf: (answers: Answers) => PortAccess,
  first: Answers,
  afterCall?: (call: PortCall, port: ProjectsStoryPort<Answers>) => void,
): ProjectsStoryPort<Answers> {
  const changing = changingAnswers(answersOf(first), { projects: { active: [TABLE] } });
  const calls: PortCall[] = [];
  const port: ProjectsStoryPort<Answers> = {
    calls,
    access: {
      ...changing.access,
      async call(module, entry, input, signal) {
        if (changing.access.describeEntry(module, entry)?.kind === "query")
          return changing.access.call(module, entry, input, signal);
        const call = { entry, input };
        calls.push(call);
        const answer = await changing.access.call(module, entry, input, signal);
        afterCall?.(call, port);
        return answer;
      },
    },
    change: (next) => changing.change(answersOf(next), [TABLE]),
  };
  return port;
}
