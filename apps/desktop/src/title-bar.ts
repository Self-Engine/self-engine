// Free of `electron` so it can be tested in Node.

/**
 * The window frame per platform. Windows and Linux keep their native frame until #24.
 *
 * On macOS the buttons sit in the Shell's strip: the 52 px wide group is centered over the 68 px
 * icons-only Navbar, which starts 8 px from the window edge, and the 14 px high buttons are
 * level with the middle of the content header, 32 px from the top.
 */
export function titleBarOptions(platform: string) {
  return platform === "darwin"
    ? ({ titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 25 } } as const)
    : {};
}
