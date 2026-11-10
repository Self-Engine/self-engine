import { Kbd } from "@mantine/core";
import { useEffect, useState } from "react";
import type { CommandScope } from "./palette-entries.ts";

/** Keeps the hotkey library out of the startup bundle: it loads once the first paint is done. */
const loadBindings = () => import("./shortcut-bindings.tsx");

type Bindings = Awaited<ReturnType<typeof loadBindings>>;

/** Undefined until it has loaded. Without it the app goes on, as every action has its button. */
function useBindings() {
  const [bindings, setBindings] = useState<Bindings>();
  useEffect(() => {
    void loadBindings().then(setBindings, (error: unknown) => console.error(error));
  }, []);
  return bindings;
}

export function Shortcuts(props: CommandScope) {
  const Bindings = useBindings()?.ShortcutBindings;
  return Bindings ? <Bindings {...props} /> : null;
}

/** Appears with the library, because the notation is the library's. Nothing depends on the hint. */
export function ShortcutHint({ shortcut }: { readonly shortcut: string }) {
  const bindings = useBindings();
  return bindings ? <Kbd size="xs">{bindings.displayShortcut(shortcut)}</Kbd> : null;
}
