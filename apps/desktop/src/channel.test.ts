import { describe, expect, it } from "vite-plus/test";
import { desktopDataFolder, desktopScheme } from "./channel.ts";

describe("desktopScheme", () => {
  it("gives development its own scheme", () => {
    expect(desktopScheme(true)).toBe("self-engine-dev");
    expect(desktopScheme(false)).toBe("self-engine");
  });
});

describe("desktopDataFolder", () => {
  it("separates the channels", () => {
    expect(desktopDataFolder(true)).not.toBe(desktopDataFolder(false));
  });

  it.each([true, false])("never uses the old app's folder (development: %s)", (isDevelopment) => {
    expect(desktopDataFolder(isDevelopment)).not.toContain("@self-engine");
  });
});
