import { expect, test } from "vite-plus/test";
import { backupId, parseBackupId } from "./backup-id.ts";

test("an id names the instant and the kind, and reads back as both", () => {
  const id = backupId(new Date("2026-11-13T08:37:51.194Z"), "before-migration");

  expect(id).toBe("2026-11-13T08-37-51-194Z-before-migration");
  expect(parseBackupId(id)).toEqual({
    takenAt: "2026-11-13T08:37:51.194Z",
    kind: "before-migration",
  });
});

test("ids sort as text in the order their Backups were taken", () => {
  const ids = [
    backupId(new Date("2026-11-13T08:00:00.000Z"), "manual"),
    backupId(new Date("2026-02-01T23:59:59.999Z"), "daily"),
    backupId(new Date("2026-11-13T07:59:59.999Z"), "before-restore"),
  ];

  expect(ids.toSorted()).toEqual([ids[1], ids[2], ids[0]]);
});

test.each([
  ["a path out of the folder", "../self-engine"],
  ["a path below the folder", "2026-11-13T08-37-51-194Z-manual/../../x"],
  ["an unknown kind", "2026-11-13T08-37-51-194Z-hourly"],
  ["a day that does not exist", "2026-02-31T08-37-51-194Z-manual"],
  ["an hour that does not exist", "2026-11-13T25-37-51-194Z-manual"],
  ["a file name with its extension", "2026-11-13T08-37-51-194Z-manual.sqlite"],
  ["nothing", ""],
])("%s is not an id", (_what, id) => {
  expect(parseBackupId(id)).toBeUndefined();
});
