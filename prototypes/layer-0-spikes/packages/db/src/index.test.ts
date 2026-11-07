import { expect, test } from "vite-plus/test";
import { openDb, readInfo } from "./index.ts";

test("opens an in-memory db, seeds and reads projects", () => {
  const db = openDb(":memory:");
  const info = readInfo(db);
  expect(info.projects.map((p) => p.name)).toEqual(["Self-Engine Next", "Layer 0", "Spike S2"]);
  expect(info.sqliteVersion).toMatch(/^3\./);
  console.log("[db test]", info.runtime, "sqlite", info.sqliteVersion);
  db.close();
});
