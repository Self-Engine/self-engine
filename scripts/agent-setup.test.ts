import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

// Guards the agent setup (docs/agents/domain.md, AGENTS.md "Agent skills"): one instruction
// file for every agent, one skill source, and no dangling links in the docs agents read.

const root = resolve(import.meta.dirname, "..");
const AGENT_DOCS = [
  "AGENTS.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
];
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g;

function relativeLinks(file: string): string[] {
  const text = readFileSync(resolve(root, file), "utf8");
  return [...text.matchAll(MARKDOWN_LINK)]
    .map((match) => match[1] ?? "")
    .filter((target) => !/^[a-z]+:/.test(target) && !target.startsWith("#"))
    .map((target) => target.split("#")[0] ?? "");
}

describe("agent setup", () => {
  it("serves CLAUDE.md as a symlink to AGENTS.md", () => {
    expect(lstatSync(resolve(root, "CLAUDE.md")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(resolve(root, "CLAUDE.md"))).toBe("AGENTS.md");
  });

  it.each(AGENT_DOCS)("resolves every relative link in %s", (file) => {
    const missing = relativeLinks(file).filter(
      (target) => !existsSync(resolve(root, dirname(file), target)),
    );
    expect(missing).toEqual([]);
  });

  it("links every skill in .agents/skills from .claude/skills, and nothing else", () => {
    const sources = readdirSync(resolve(root, ".agents/skills")).sort();
    const links = readdirSync(resolve(root, ".claude/skills")).sort();
    expect(links).toEqual(sources);
    for (const name of links) {
      expect(readlinkSync(resolve(root, ".claude/skills", name))).toBe(
        `../../.agents/skills/${name}`,
      );
      expect(existsSync(resolve(root, ".agents/skills", name, "SKILL.md"))).toBe(true);
    }
  });
});
