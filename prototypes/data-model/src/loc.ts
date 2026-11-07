/** Counts code lines (non-blank, non-comment) per file and inside `#region delta|report` blocks. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const isCode = (l: string) => {
  const t = l.trim();
  return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
};

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f));
}

console.log("| Datei | Codezeilen gesamt | davon in #region (handgeschrieben pro Änderung/Report) |\n|---|---|---|");
for (const f of [...files("v1"), ...files("v2"), ...files("v3"), ...files("shared"), ...files("changes"), ...files("reports")]) {
  const lines = readFileSync(join(root, f), "utf8").split("\n");
  let inRegion = false;
  let region = 0;
  for (const l of lines) {
    if (/#region (delta|report)/.test(l)) inRegion = true;
    else if (/#endregion/.test(l)) inRegion = false;
    else if (inRegion && isCode(l)) {
      // array literals count one line per element: the developer writes each one
      region++;
    }
  }
  const total = lines.filter(isCode).length;
  console.log(`| ${f} | ${total} | ${/changes|reports/.test(f) ? region : "–"} |`);
}
