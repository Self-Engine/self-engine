import type { PortAccess } from "@self-engine/data-client/react";
import { notifyError } from "@self-engine/ui";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";
import { defineInputCommand, defineOpenCommand, definePageCommand } from "./commands.ts";
import { runCommand } from "./run-command.ts";

vi.mock("@self-engine/ui", () => ({ notifyError: vi.fn() }));

const schema = z.object({ name: z.string().min(1) });
const description = "Creates a thing.";
const named = { name: "Studio" };

/** The Port access a Command is given; these Commands never call it. */
const data: PortAccess = {
  call: () => Promise.reject(new Error("No Port in this test")),
  describeEntry: () => undefined,
  onTablesChanged: () => () => undefined,
  onReconnected: () => () => undefined,
};

function inputCommand(run: (input: { name: string }) => unknown) {
  const definition = defineInputCommand({ description, schema, run });
  return { load: async () => ({ default: definition }) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(notifyError).mockClear();
});

describe("the runner's core", () => {
  test("runs valid input and returns what the handler returned", async () => {
    const result = await runCommand(
      inputCommand(({ name }) => `made ${name}`),
      named,
      { data },
    );
    expect(result).toEqual({ ok: true, value: "made Studio" });
  });

  test("hands the handler what the schema produced", async () => {
    const trimming = z.object({ name: z.string().trim() });
    const run = vi.fn();
    const definition = defineInputCommand({ description, schema: trimming, run });
    await runCommand({ load: async () => ({ default: definition }) }, { name: " a " }, { data });
    expect(run).toHaveBeenCalledWith({ name: "a" }, { data });
  });

  test("rejects invalid input without running the handler", async () => {
    const run = vi.fn();
    const result = await runCommand(inputCommand(run), { name: "" }, { data });
    expect(result.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  test("returns a failing load as a failure", async () => {
    const offline = new Error("offline");
    const command = { load: () => Promise.reject<never>(offline) };
    await expect(runCommand(command, named, { data })).resolves.toEqual({
      ok: false,
      error: offline,
    });
  });

  test("returns a handler that throws or rejects as a failure", async () => {
    const offline = new Error("offline");
    const throwing = inputCommand(() => {
      throw offline;
    });
    const rejecting = inputCommand(() => Promise.reject(offline));
    await expect(runCommand(throwing, named, { data })).resolves.toEqual({
      ok: false,
      error: offline,
    });
    await expect(runCommand(rejecting, named, { data })).resolves.toEqual({
      ok: false,
      error: offline,
    });
  });

  test("runs two calls in a row, also while the first is still going", async () => {
    const run = vi.fn();
    const command = inputCommand(run);
    await Promise.all([
      runCommand(command, { name: "one" }, { data }),
      runCommand(command, { name: "two" }, { data }),
    ]);
    expect(run.mock.calls.map(([input]) => input)).toEqual([{ name: "one" }, { name: "two" }]);
  });

  test("shows nothing, whatever happens", async () => {
    const consoleError = vi.spyOn(console, "error");
    await runCommand(
      inputCommand(() => undefined),
      named,
      { data },
    );
    await runCommand(
      inputCommand(() => undefined),
      { name: "" },
      { data },
    );
    await runCommand(
      inputCommand(() => {
        throw new Error("offline");
      }),
      named,
      { data },
    );
    expect(notifyError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("gives every Command the Port access, and a page Command also the address", async () => {
    const writeSearch = vi.fn();
    const noInput = z.object({});
    const page = definePageCommand({
      description,
      schema: noInput,
      run: (_input, context) => context.writeSearch((search) => search),
    });
    const open = defineOpenCommand({ description, schema: noInput, run: (_input, c) => c });
    const input = defineInputCommand({ description, schema, run: (_input, c) => c.data });
    await runCommand({ load: async () => ({ default: page }) }, {}, { writeSearch, data });
    expect(writeSearch).toHaveBeenCalledOnce();
    await expect(
      runCommand({ load: async () => ({ default: open }) }, {}, { data }),
    ).resolves.toEqual({ ok: true, value: { data } });
    await expect(
      runCommand({ load: async () => ({ default: input }) }, named, { data }),
    ).resolves.toEqual({ ok: true, value: data });
  });
});

// Compiled, not run: the core asks for the context the Command's kind needs.
function whatCannotBeCalled() {
  const page = definePageCommand({ description, schema: z.object({}), run: () => undefined });
  // @ts-expect-error A page Command cannot run without the address capability.
  void runCommand({ load: async () => ({ default: page }) }, {}, { data });
  const open = defineOpenCommand({ description, schema: z.object({}), run: () => undefined });
  // @ts-expect-error No Command runs without the Port access.
  void runCommand({ load: async () => ({ default: open }) }, {}, {});
}
void whatCannotBeCalled;
