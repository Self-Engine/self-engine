import { Kbd } from "@mantine/core";
import { type ComponentType, useEffect, useState } from "react";
import type { ShortcutBindingsProps } from "./shortcut-bindings.tsx";

/** Keeps the hotkey library out of the startup bundle: it loads once the first paint is done. */
const loadBindings = () => import("./shortcut-bindings.tsx");

export function Shortcuts(props: ShortcutBindingsProps) {
  const [Bindings, setBindings] = useState<ComponentType<ShortcutBindingsProps>>();
  useEffect(() => {
    void loadBindings().then(
      ({ ShortcutBindings }) => setBindings(() => ShortcutBindings),
      // The app goes on without its shortcuts, and every action still has its button.
      (error: unknown) => console.error(error),
    );
  }, []);
  return Bindings ? <Bindings {...props} /> : null;
}

/** Appears with the library, because the notation is the library's. Nothing depends on the hint. */
export function ShortcutHint({ shortcut }: { readonly shortcut: string }) {
  const [shown, setShown] = useState<string>();
  useEffect(() => {
    void loadBindings().then(
      ({ displayShortcut }) => setShown(displayShortcut(shortcut)),
      // `Shortcuts` has reported the same failed load.
      () => undefined,
    );
  }, [shortcut]);
  return shown === undefined ? null : <Kbd size="xs">{shown}</Kbd>;
}
