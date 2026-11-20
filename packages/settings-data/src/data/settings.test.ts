import type { SettingsTables } from "@self-engine/settings-rows";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { checkContract } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import { settings } from "./index.ts";

test("the Settings Port passes the storage contract kit", async () => {
  // The kit migrates settings before calling the seed, as the Data Process does.
  await expect(
    checkContract(
      settings,
      async (tx, { spaceId }) => {
        await createSettingRows<SettingsTables>(tx, [
          { spaceId, key: "fixture.theme", value: "light" },
          { spaceId, key: "fixture.broken", text: "{broken" },
        ]);
      },
      {
        load: {},
        save: {
          entries: [
            { key: "fixture.theme", value: "dark" },
            { key: "fixture.accent", value: null },
          ],
        },
      },
    ),
  ).resolves.toEqual([]);
});
