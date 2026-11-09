import { describe, expect, it } from "vite-plus/test";
import { titleBarOptions } from "./title-bar.ts";

describe("titleBarOptions", () => {
  it("hides the macOS title bar and places the buttons in the Shell's strip", () => {
    expect(titleBarOptions("darwin")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 25 },
    });
  });

  it.each(["win32", "linux"])("leaves the frame of %s alone", (platform) => {
    expect(titleBarOptions(platform)).toEqual({});
  });
});
