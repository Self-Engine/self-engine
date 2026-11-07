import { describe, expect, it } from "vite-plus/test";
import { findAdrProblems } from "./check-adrs.ts";

const accepted = "---\nstatus: accepted\n---\n\n# A decision\n";

describe("findAdrProblems", () => {
  it("accepts uniquely numbered, well-named ADRs with a known status", () => {
    expect(
      findAdrProblems([
        { name: "0001-first-decision.md", content: accepted },
        {
          name: "0002-second-decision.md",
          content: "---\ndate: 2026-11-08\nstatus: proposed\n---\n",
        },
      ]),
    ).toEqual([]);
  });

  it("reports two ADRs that share a number", () => {
    expect(
      findAdrProblems([
        { name: "0009-icons.md", content: accepted },
        { name: "0010-tabs.md", content: accepted },
        { name: "0009-seeds.md", content: accepted },
      ]),
    ).toEqual([
      "ADR 0009 is used by 0009-icons.md, 0009-seeds.md: give the newer one the next free number",
    ]);
  });

  it("reports a file that does not follow the naming scheme", () => {
    expect(
      findAdrProblems([
        { name: "12-short-number.md", content: accepted },
        { name: "0003-Upper-Case.md", content: accepted },
      ]),
    ).toEqual([
      "0003-Upper-Case.md: name must match <4-digit number>-<kebab-case-slug>.md",
      "12-short-number.md: name must match <4-digit number>-<kebab-case-slug>.md",
    ]);
  });

  it("reports a missing, empty or unknown status", () => {
    expect(
      findAdrProblems([
        { name: "0001-no-front-matter.md", content: "# Title\n\n## Status\n\naccepted\n" },
        { name: "0002-no-status.md", content: "---\ndate: 2026-11-08\n---\n" },
        { name: "0003-unknown-status.md", content: "---\nstatus: done\n---\n" },
      ]),
    ).toEqual([
      "0001-no-front-matter.md: must open with YAML front matter (--- … ---) that holds a status",
      "0002-no-status.md: front matter needs a status: line",
      '0003-unknown-status.md: status "done" must be one of proposed, accepted, deprecated, superseded',
    ]);
  });

  it("reads front matter written with Windows line endings", () => {
    expect(
      findAdrProblems([{ name: "0001-crlf.md", content: "---\r\nstatus: accepted\r\n---\r\n" }]),
    ).toEqual([]);
  });
});
