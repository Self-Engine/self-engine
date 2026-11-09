import { createSettingsStore, type JsonValue, type SettingsStore } from "@self-engine/settings";
import { createTestAdapter, settle, type TestAdapter } from "@self-engine/settings/testing";
import { describe, expect, it } from "vite-plus/test";
import { SHELL_SETTINGS } from "./shell-settings.ts";

const ignoreStorageErrors = () => {};

/** A loaded store whose device adapter holds `stored`. */
async function storeHolding(stored: Readonly<Record<string, JsonValue>>) {
  const adapters: Record<"synced" | "device", TestAdapter> = {
    synced: createTestAdapter(),
    device: createTestAdapter(stored),
  };
  const store = createSettingsStore({ adapters, onError: ignoreStorageErrors });
  await store.load();
  return { store, adapters };
}

function shellLayoutOf(store: SettingsStore) {
  return {
    navbar: store.read(SHELL_SETTINGS.navbar),
    moduleSidebarWidth: store.read(SHELL_SETTINGS.moduleSidebarWidth),
    moduleSidebarCollapsed: store.read(SHELL_SETTINGS.moduleSidebarCollapsed),
  };
}

const STANDARD_LAYOUT = {
  navbar: { collapsed: false, expandedWidth: 220 },
  moduleSidebarWidth: 240,
  moduleSidebarCollapsed: false,
};

describe("the Shell's Device Settings", () => {
  it.each([
    ["navbar", "shell.navbar"],
    ["moduleSidebarWidth", "shell.moduleSidebarWidth"],
    ["moduleSidebarCollapsed", "shell.moduleSidebarCollapsed"],
  ] as const)("declares %s as %s on the device", (field, key) => {
    expect(SHELL_SETTINGS[field].key).toBe(key);
    expect(SHELL_SETTINGS[field].scope).toBe("device");
  });

  it("starts from the standard layout", async () => {
    const { store } = await storeHolding({});
    expect(shellLayoutOf(store)).toEqual(STANDARD_LAYOUT);
  });

  it("keeps what is stored", async () => {
    const { store } = await storeHolding({
      "shell.navbar": { collapsed: true, expandedWidth: 260 },
      "shell.moduleSidebarWidth": 320,
      "shell.moduleSidebarCollapsed": true,
    });
    expect(shellLayoutOf(store)).toEqual({
      navbar: { collapsed: true, expandedWidth: 260 },
      moduleSidebarWidth: 320,
      moduleSidebarCollapsed: true,
    });
  });

  it("leaves a width outside the limits to the Shell, which clamps it when shown", async () => {
    const { store } = await storeHolding({
      "shell.navbar": { collapsed: false, expandedWidth: 9000 },
      "shell.moduleSidebarWidth": 10,
    });
    expect(shellLayoutOf(store)).toEqual({
      ...STANDARD_LAYOUT,
      navbar: { collapsed: false, expandedWidth: 9000 },
      moduleSidebarWidth: 10,
    });
  });

  it.each([
    ["shell.navbar", "wide"],
    ["shell.navbar", 220],
    ["shell.navbar", null],
    ["shell.navbar", []],
    ["shell.navbar", {}],
    ["shell.navbar", { collapsed: true }],
    ["shell.navbar", { expandedWidth: 260 }],
    ["shell.navbar", { collapsed: "yes", expandedWidth: 260 }],
    ["shell.navbar", { collapsed: true, expandedWidth: "260" }],
    ["shell.moduleSidebarWidth", "320"],
    ["shell.moduleSidebarWidth", null],
    ["shell.moduleSidebarWidth", {}],
    ["shell.moduleSidebarCollapsed", "yes"],
    ["shell.moduleSidebarCollapsed", 1],
    ["shell.moduleSidebarCollapsed", null],
  ])("uses the default for a broken %s (%j)", async (key, value) => {
    const { store } = await storeHolding({ [key]: value });
    expect(shellLayoutOf(store)).toEqual(STANDARD_LAYOUT);
  });

  it("keeps the valid entries beside a broken one", async () => {
    const { store } = await storeHolding({
      "shell.navbar": "wide",
      "shell.moduleSidebarWidth": 320,
    });
    expect(shellLayoutOf(store)).toEqual({ ...STANDARD_LAYOUT, moduleSidebarWidth: 320 });
  });

  it("is back after a restart, and stays on the device", async () => {
    const { store, adapters } = await storeHolding({});

    store.write(SHELL_SETTINGS.navbar, { collapsed: true, expandedWidth: 260 });
    store.write(SHELL_SETTINGS.moduleSidebarWidth, 320);
    store.write(SHELL_SETTINGS.moduleSidebarCollapsed, true);
    await settle();

    expect(adapters.synced.saves).toEqual([]);
    expect(adapters.device.saves).toEqual([
      [{ key: "shell.navbar", value: { collapsed: true, expandedWidth: 260 } }],
      [{ key: "shell.moduleSidebarWidth", value: 320 }],
      [{ key: "shell.moduleSidebarCollapsed", value: true }],
    ]);

    const restarted = createSettingsStore({ adapters, onError: ignoreStorageErrors });
    await restarted.load();
    expect(shellLayoutOf(restarted)).toEqual({
      navbar: { collapsed: true, expandedWidth: 260 },
      moduleSidebarWidth: 320,
      moduleSidebarCollapsed: true,
    });
  });

  it("hands the same stored object to every reader, as a rendering hook needs", async () => {
    const { store } = await storeHolding({
      "shell.navbar": { collapsed: true, expandedWidth: 260 },
    });
    expect(store.read(SHELL_SETTINGS.navbar)).toBe(store.read(SHELL_SETTINGS.navbar));
  });
});
