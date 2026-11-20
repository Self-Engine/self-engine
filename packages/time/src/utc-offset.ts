// The offset of a zone from UTC as a person reads it: `UTC+1`, `UTC-3:30`, `UTC+0`. The Time Zone
// picker of the settings and the note at a repeated wall-clock time in a form (`repeatedTimeOffset`)
// show the same text.

/** An offset of whole minutes, rounded from any seconds, as `UTC+1` or `UTC-3:30`. */
export function utcOffsetText(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? "-" : "+";
  const hours = Math.floor(Math.abs(rounded) / 60);
  const rest = Math.abs(rounded) % 60;
  return `UTC${sign}${hours}${rest === 0 ? "" : `:${String(rest).padStart(2, "0")}`}`;
}
