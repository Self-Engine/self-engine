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

/** Returns whether startup may continue with the data folder already set on the app. */
export function acquireSingleInstanceLock(
  app: InstanceApp,
  hidden: boolean,
  getWindow: () => InstanceWindow | undefined,
): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  if (!hidden) {
    app.on("second-instance", () => {
      const window = getWindow();
      if (!window) return;
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    });
  }
  return true;
}
