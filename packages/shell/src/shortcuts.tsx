import { type ComponentType, useEffect, useState } from "react";
import type { ShortcutBindingsProps } from "./shortcut-bindings.tsx";

/** Keeps the hotkey library out of the startup bundle: it loads once the first paint is done. */
export function Shortcuts(props: ShortcutBindingsProps) {
  const [Bindings, setBindings] = useState<ComponentType<ShortcutBindingsProps>>();
  useEffect(() => {
    void import("./shortcut-bindings.tsx").then(
      ({ ShortcutBindings }) => setBindings(() => ShortcutBindings),
      // The app goes on without its shortcuts, and every action still has its button.
      (error: unknown) => console.error(error),
    );
  }, []);
  return Bindings ? <Bindings {...props} /> : null;
}
