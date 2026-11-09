import { describe, expect, test } from "vite-plus/test";
import { defineMigrations } from "./index.ts";

describe("defineMigrations", () => {
  test("names each file <module>/<number> and keeps its SQL", () => {
    const migrations = defineMigrations("time", {
      "./migrations/0001.sql": "CREATE TABLE a (id TEXT) STRICT;",
      "./migrations/0002.sql": "CREATE TABLE b (id TEXT) STRICT;",
    });

    expect(migrations).toEqual([
      { name: "time/0001", sql: "CREATE TABLE a (id TEXT) STRICT;" },
      { name: "time/0002", sql: "CREATE TABLE b (id TEXT) STRICT;" },
    ]);
  });

  test.each([
    "./migrations/1.sql",
    "./migrations/0001-entries.sql",
    "./migrations/0001.txt",
    "src/sql/0001.sql",
    "./0001.sql",
    "./my-migrations/0001.sql",
  ])("rejects the file path %s", (path) => {
    expect(() => defineMigrations("time", { [path]: "" })).toThrow(path);
  });

  test("accepts a migrations folder nested in the module", () => {
    expect(defineMigrations("time", { "src/migrations/0001.sql": "" })).toEqual([
      { name: "time/0001", sql: "" },
    ]);
  });
});
