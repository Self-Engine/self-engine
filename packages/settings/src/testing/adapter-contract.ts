import { describe, expect, it } from "vite-plus/test";
import type { SettingEntry, SettingsAdapter } from "../core/index.ts";

/** One test's world: the same stored data behind every adapter that `open` returns. */
export interface AdapterContractHarness {
  /** A new adapter over the same data. A second call is a restart. */
  readonly open: () => SettingsAdapter;
}

function sorted(entries: readonly SettingEntry[]): readonly SettingEntry[] {
  return entries.toSorted((a, b) => a.key.localeCompare(b.key));
}

/** The behavior every adapter owes the store, as a suite to run against a real implementation. */
export function describeAdapterContract(name: string, setup: () => AdapterContractHarness): void {
  describe(`the adapter contract: ${name}`, () => {
    it("loads nothing from empty storage", async () => {
      await expect(setup().open().load()).resolves.toEqual([]);
    });

    it("loads what it saved", async () => {
      const adapter = setup().open();

      await adapter.save([{ key: "test.accent", value: "green" }]);

      await expect(adapter.load()).resolves.toEqual([{ key: "test.accent", value: "green" }]);
    });

    it("keeps saved entries across a restart", async () => {
      const harness = setup();

      await harness.open().save([{ key: "test.accent", value: "green" }]);

      await expect(harness.open().load()).resolves.toEqual([
        { key: "test.accent", value: "green" },
      ]);
    });

    it.each([
      ["a string", "text"],
      ["a number", 112.5],
      ["a boolean", false],
      ["null", null],
      ["an array", [1, "two", null]],
      ["an object", { nested: { deep: [true] } }],
    ])("round-trips %s", async (_name, value) => {
      const adapter = setup().open();

      await adapter.save([{ key: "test.value", value }]);

      await expect(adapter.load()).resolves.toEqual([{ key: "test.value", value }]);
    });

    it("applies every entry of a batch", async () => {
      const adapter = setup().open();
      const batch = [
        { key: "test.a", value: 1 },
        { key: "test.b", value: 2 },
      ];

      await adapter.save(batch);

      expect(sorted(await adapter.load())).toEqual(batch);
    });

    it("replaces an entry and leaves the entries it did not receive alone", async () => {
      const adapter = setup().open();
      await adapter.save([
        { key: "test.changed", value: "old" },
        { key: "test.unknown", value: "kept" },
      ]);

      await adapter.save([{ key: "test.changed", value: "new" }]);

      expect(sorted(await adapter.load())).toEqual([
        { key: "test.changed", value: "new" },
        { key: "test.unknown", value: "kept" },
      ]);
    });
  });
}
