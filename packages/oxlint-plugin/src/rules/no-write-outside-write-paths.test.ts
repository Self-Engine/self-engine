import { describe, expect, it } from "vite-plus/test";
import { lintFixture, lintFixtures } from "../testing/lint-fixture.ts";

const RULE = "no-write-outside-write-paths";

describe("self-engine/no-write-outside-write-paths", () => {
  it("reports an insert into a synced table", () => {
    const hits = lintFixture(
      RULE,
      'await tx.insertInto("notes").values({ title: "Note" }).execute();',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("write paths");
  });

  it("reports an update of a synced table", () => {
    expect(
      lintFixture(RULE, 'await tx.updateTable("notes").set({ title: "Edited" }).execute();'),
    ).toHaveLength(1);
  });

  it("reports a delete from a synced table", () => {
    expect(
      lintFixture(RULE, 'await tx.deleteFrom("notes").where("title", "=", "Old").execute();'),
    ).toHaveLength(1);
  });

  it("accepts a write to a Local Table, also under an alias", () => {
    expect(
      lintFixtures(RULE, [
        'await tx.insertInto("local_audit").values({ title: "Kept here" }).execute();',
        'await tx.updateTable("local_audit").set({ title: "Edited" }).execute();',
        'await tx.deleteFrom("local_audit as a").where("a.title", "=", "Old").execute();',
      ]),
    ).toEqual([[], [], []]);
  });

  it("reports a write whose method is named by a string or a template without expressions", () => {
    expect(
      lintFixtures(RULE, [
        'await tx["deleteFrom"]("notes").execute();',
        "await tx[`deleteFrom`](`notes`).execute();",
      ]).map((hits) => hits.length),
    ).toEqual([1, 1]);
  });

  it("reads a table named by a template without expressions", () => {
    expect(lintFixture(RULE, "await tx[`deleteFrom`](`local_audit`).execute();")).toEqual([]);
  });

  it("reports a write whose table it cannot read, since it may be synced", () => {
    expect(
      lintFixtures(RULE, [
        "await tx.insertInto(table).values(row).execute();",
        "await tx.deleteFrom(`local_${name}`).execute();",
      ]).map((hits) => hits.length),
    ).toEqual([1, 1]);
  });

  it("accepts the write paths themselves", () => {
    const [writePaths, frame] = lintFixtures(
      RULE,
      [
        {
          path: "shared-entry.ts",
          source: "await db.insertInto(String(table)).values(row).execute();",
        },
        { path: "frame.ts", source: "await db.insertInto(String(table)).values(row).execute();" },
      ],
      "packages/storage/src/core",
    );
    expect([writePaths, frame?.length]).toEqual([[], 1]);
  });

  it("accepts reads", () => {
    expect(lintFixture(RULE, 'await tx.selectFrom("notes").selectAll().execute();')).toEqual([]);
  });

  it("accepts a named exception and nothing beside it", () => {
    const insert = 'await tx.insertInto("spaces").values(row).execute();';
    const [named, elsewhere] = lintFixtures(
      RULE,
      [
        { path: "personal-space.ts", source: insert },
        { path: "shared-space.ts", source: insert },
      ],
      "packages/spaces/src",
    );
    const [otherWrite] = lintFixtures(
      RULE,
      [{ path: "personal-space.ts", source: 'await tx.deleteFrom("spaces").execute();' }],
      "packages/spaces/src",
    );
    expect([named, elsewhere?.length, otherWrite?.length]).toEqual([[], 1, 1]);
  });

  it("leaves tests, stories and test helpers that seed rows alone", () => {
    const seed = 'await db.insertInto("notes").values(row).execute();';
    const results = lintFixtures(
      RULE,
      [
        { path: "notes/src/data/notes.test.ts", source: seed },
        { path: "notes/src/views/list.stories.tsx", source: seed },
        { path: "notes/src/testing/seed.ts", source: seed },
        { path: "notes/src/data/index.ts", source: seed },
      ],
      "packages",
    );
    expect(results.map((hits) => hits.length)).toEqual([0, 0, 0, 1]);
  });
});
