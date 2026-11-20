// An example View for the page clock's story and test: both render it with a fixed Clock.

import type { TimeZone } from "../../zone.ts";
import { useNow, useToday } from "../page-clock.tsx";

export function ClockReadout({ timeZone }: { readonly timeZone: TimeZone }) {
  const now = useNow("second");
  const today = useToday(timeZone);
  return (
    <p>
      Now {now}, today {today}
    </p>
  );
}
