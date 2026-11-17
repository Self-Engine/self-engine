// `projects` is guarded without code of its own (D337): the frame's reference check reads the
// foreign key of the `project-entries` test module, which refers to a project as `time-tracking`
// will. Through the Port of the test Data Process, as a View, a Command or an assistant calls it.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { checkConventions } from "@self-engine/db/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { projectEntries } from "../../test/project-entries-module/data/index.ts";
import { projectIdSchema } from "../contracts/index.ts";
import { projects } from "./index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

async function start() {
  const process = await startTestDataProcess({ modules: { projects, projectEntries } });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      ProtocolContract & {
        projects: typeof projects.contract;
        projectEntries: typeof projectEntries.contract;
      }
    >
  >(new RPCLink({ port: process.openPort() }));
  return { process, client };
}

/** The Reasons of the Refusal a write answers with. */
async function refusalOf(write: Promise<unknown>) {
  const error: unknown = await write.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toMatchObject({ code: "REFUSED" });
  return (error as { data: { reasons: unknown[] } }).data.reasons;
}

test("the project tables follow the conventions, the referring column's index included", async () => {
  const { process } = await start();
  await expect(checkConventions(process.database)).resolves.toEqual([]);
});

test("a project an entry refers to is not deleted, the Clearance says so beforehand, and it is archived", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  await client.projectEntries.create({ projectId: project.id, label: "Design" });
  await client.projectEntries.create({ projectId: project.id, label: "Build" });
  const referenced = {
    code: "referenced",
    severity: "blocking",
    table: "projects",
    row: project.id,
    details: { tables: [{ table: "project_entries", count: 2 }] },
  };

  await expect(
    client.clearance({ table: "projects", rows: [project.id], writes: ["delete", "archive"] }),
  ).resolves.toEqual([
    {
      row: project.id,
      writes: { delete: { state: "blocked", reasons: [referenced] }, archive: { state: "free" } },
    },
  ]);
  await expect(refusalOf(client.projects.delete({ id: project.id }))).resolves.toEqual([
    referenced,
  ]);
  await expect(client.projects.archive({ id: project.id })).resolves.toMatchObject({
    id: project.id,
  });
});

test("an entry is created for an archived project and refused for a deleted or unknown one", async () => {
  const { client } = await start();
  const archived = await client.projects.create({ title: "Archived" });
  await client.projects.archive({ id: archived.id });
  const deleted = await client.projects.create({ title: "Deleted" });
  await client.projects.delete({ id: deleted.id });
  const unknown = projectIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");

  await expect(
    client.projectEntries.create({ projectId: archived.id, label: "Late work" }),
  ).resolves.toMatchObject({ projectId: archived.id });
  for (const projectId of [deleted.id, unknown])
    await expect(
      refusalOf(client.projectEntries.create({ projectId, label: "Work" })),
    ).resolves.toEqual([
      expect.objectContaining({
        code: "target_deleted",
        table: "project_entries",
        field: "project_id",
        details: { target: { table: "projects", id: projectId } },
      }),
    ]);
  await expect(client.projectEntries.list({})).resolves.toHaveLength(1);
});

test("an entry of a deleted project is not restored, and the Clearance says so beforehand", async () => {
  const { client } = await start();
  const project = await client.projects.create({ title: "Website" });
  const entry = await client.projectEntries.create({ projectId: project.id, label: "Design" });
  await client.projectEntries.delete({ id: entry.id });
  await client.projects.delete({ id: project.id });
  const targetDeleted = {
    code: "target_deleted",
    severity: "blocking",
    table: "project_entries",
    row: entry.id,
    field: "project_id",
    details: { target: { table: "projects", id: project.id } },
  };

  await expect(
    client.clearance({ table: "project_entries", rows: [entry.id], writes: ["restore"] }),
  ).resolves.toEqual([
    { row: entry.id, writes: { restore: { state: "blocked", reasons: [targetDeleted] } } },
  ]);
  await expect(refusalOf(client.projectEntries.restore({ id: entry.id }))).resolves.toEqual([
    targetDeleted,
  ]);

  // Once its project is back, the entry comes back too.
  await client.projects.restore({ id: project.id });
  await expect(client.projectEntries.restore({ id: entry.id })).resolves.toEqual(entry);
});
