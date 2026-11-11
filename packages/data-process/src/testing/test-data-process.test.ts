import * as driver from "@self-engine/db/better-sqlite3";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { startTestDataProcess } from "./index.ts";

vi.mock("@self-engine/db/better-sqlite3", { spy: true });

afterEach(() => vi.restoreAllMocks());

test.each(["hook", "name"])("closes its own database when startup fails in %s", async (failure) => {
  const database = driver.openDatabase(":memory:");
  const close = vi.spyOn(database, "close");
  vi.mocked(driver.openDatabase).mockReturnValueOnce(database);
  const reason = new Error("backup failed");
  try {
    await expect(
      startTestDataProcess({
        migrations: [{ name: failure === "name" ? "invalid" : "fixture/0001", sql: "SELECT 1;" }],
        beforeMigrations() {
          throw reason;
        },
      }),
    ).rejects.toThrow(failure === "name" ? /must be named/ : reason);
    expect(close).toHaveBeenCalledOnce();
  } finally {
    await database.close();
  }
});

test("leaves a caller's database open when startup fails", async () => {
  const database = driver.openDatabase(":memory:");
  const close = vi.spyOn(database, "close");
  try {
    await expect(
      startTestDataProcess({ database, migrations: [{ name: "invalid", sql: "SELECT 1;" }] }),
    ).rejects.toThrow(/must be named/);
    expect(close).not.toHaveBeenCalled();
    await expect(database.executeScript("SELECT 1;")).resolves.toBeUndefined();
  } finally {
    await database.close();
  }
});
