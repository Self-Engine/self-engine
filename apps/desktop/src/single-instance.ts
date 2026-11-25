interface InstanceApp {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: "second-instance", listener: () => void): void;
}

interface InstanceWindow {
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/**
 * Takes Electron's single-instance lock for the data folder already set on the app, and returns
 * whether startup may continue. Without the lock the app quits: another instance runs on this
 * data folder, and it brings its window to the front.
 *
 * `shownWindow` is the window this instance has shown. A second start during this one's own
 * start finds none: the window shows itself after its first paint. A hidden run never has one,
 * so a second start cannot bring it to the screen.
 */
export function acquireSingleInstanceLock(
  app: InstanceApp,
  shownWindow: () => InstanceWindow | undefined,
): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("second-instance", () => {
    const window = shownWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  return true;
}
