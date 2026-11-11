import { useEffect, useRef, useState } from "react";
import { useShellRouting } from "./routing.tsx";
import type { ViewSearch } from "./view-search.ts";

/** The text of a search parameter. The router reads `?q=100` as a number, which is still a text. */
export function searchText(search: ViewSearch, parameter: string): string {
  const text = search[parameter];
  if (typeof text === "string") return text;
  return typeof text === "number" || typeof text === "boolean" ? String(text) : "";
}

interface Arrival {
  /** What is still on its way to the address after this arrival. */
  readonly written: readonly string[];
  /** Whether the field takes the arrived text, because it came from elsewhere, such as Back. */
  readonly adopt: boolean;
}

/**
 * What a text that arrived in the address means to a field. `written` is what the field wrote
 * since the address last showed the field's text, oldest first. The newest of it arriving means
 * the address has caught up, whatever was skipped on the way; an older one is a key press that
 * later ones still follow; any other text was not typed here.
 */
export function afterArrival(written: readonly string[], arrived: string): Arrival {
  if (arrived === written.at(-1)) return { written: [], adopt: false };
  if (written.includes(arrived)) return { written, adopt: false };
  return { written: [], adopt: true };
}

/**
 * A search parameter that a text field edits, such as the text of a search. The field shows what
 * was typed at once and does not wait for the address, which follows a moment later. Typing
 * rewrites the page's entry in the history, so the text survives a reload and coming back to the
 * page while Back leaves the page in one step. A text the address gets from elsewhere, such as
 * Back, replaces what the field shows.
 */
export function useTypedViewSearch(parameter: string): readonly [string, (text: string) => void] {
  const address = useShellRouting().useAddress();
  const [text, setText] = useState(() => searchText(address.search(), parameter));
  const written = useRef<readonly string[]>([]);
  useEffect(() => {
    // Asked on every arrival and not only when the text changes: typing that ends on the text
    // the address already has arrives without changing it.
    const follow = () => {
      const arrived = searchText(address.search(), parameter);
      const { written: onTheWay, adopt } = afterArrival(written.current, arrived);
      written.current = onTheWay;
      if (adopt) setText(arrived);
    };
    // What arrived between the first draw and this subscription.
    follow();
    return address.subscribe(follow);
  }, [address, parameter]);
  const type = (next: string) => {
    setText(next);
    written.current = [...written.current, next];
    address.writeSearch(
      ({ [parameter]: _previous, ...others }) =>
        next === "" ? others : { ...others, [parameter]: next },
      { replace: true },
    );
  };
  return [text, type];
}
