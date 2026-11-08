// The PR-title check (.github/workflows/pr-title.yml). PRs are squash-merged, so the title
// becomes the commit on `main` and the changelog entry (ADR 0007). The rules are the
// pr-convention skill's (.agents/skills/pr-convention/SKILL.md); a test keeps the type list
// here and the skill's table in step. The title comes from `PR_TITLE`, never from the
// workflow's command line, so a title cannot inject shell.

export const TITLE_TYPES = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "docs",
  "chore",
  "test",
  "build",
  "ci",
] as const;

// `type(scope)!: description`, loose enough to name what is wrong instead of only "no match".
const HEADER = /^(?<type>[^\s(!:]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?(?<colon>:\s*)(?<rest>.*)$/su;
const SCOPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * What is wrong with a PR title, empty when it follows the convention:
 * `type(scope)!: description` with a known lowercase type, an optional lowercase kebab-case
 * scope, an optional `!`, one space after the colon, and a description that starts lowercase,
 * has no trailing period, and is English. English is checked only by its letters: a letter
 * outside ASCII (ä, ö, ü, ß, …) fails.
 */
export function titleProblems(title: string): string[] {
  const match = HEADER.exec(title);
  if (match?.groups === undefined) {
    return [`must look like "type(scope): description", e.g. "fix(time): …"`];
  }
  const { type = "", scope, colon = "", rest = "" } = match.groups;
  const problems: string[] = [];
  if (!(TITLE_TYPES as readonly string[]).includes(type)) {
    problems.push(
      (TITLE_TYPES as readonly string[]).includes(type.toLowerCase())
        ? `type "${type}" must be lowercase`
        : `type "${type}" must be one of ${TITLE_TYPES.join(", ")}`,
    );
  }
  if (scope !== undefined && !SCOPE.test(scope)) {
    problems.push(`scope "${scope}" must be a lowercase kebab-case name, e.g. "desktop" or "time"`);
  }
  if (colon !== ": ") {
    problems.push(`write exactly one space after the colon`);
  }
  const description = rest.trimEnd();
  if (description === "") {
    problems.push("description must not be empty");
    return problems;
  }
  if (description !== rest) {
    problems.push("description must not end with whitespace");
  }
  if (/^\p{Lu}/u.test(description)) {
    problems.push("description must start lowercase");
  }
  if (description.endsWith(".")) {
    problems.push("description must not end with a period");
  }
  const nonEnglish = [...new Set(description.match(/[^\p{ASCII}]/gu)?.filter(isLetter) ?? [])];
  if (nonEnglish.length > 0) {
    problems.push(`description must be English (found ${nonEnglish.join(" ")})`);
  }
  return problems;
}

function isLetter(character: string): boolean {
  return /\p{L}/u.test(character);
}

function main(): void {
  const title = process.env.PR_TITLE;
  if (title === undefined) {
    console.error("check-pr-title: PR_TITLE is not set");
    process.exit(1);
  }
  const problems = titleProblems(title);
  if (problems.length > 0) {
    console.error(
      `check-pr-title: ${JSON.stringify(title)}\n${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
        "See .agents/skills/pr-convention/SKILL.md.",
    );
    process.exit(1);
  }
  console.log(`check-pr-title: ${JSON.stringify(title)} ok`);
}

if (import.meta.main) main();
