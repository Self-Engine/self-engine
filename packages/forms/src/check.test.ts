import { activateLanguage, createI18n, type I18n, type Language } from "@self-engine/i18n";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { checkDraft } from "./check.ts";

async function shownIn(language: Language): Promise<I18n> {
  const i18n = createI18n();
  await activateLanguage(i18n, language);
  return i18n;
}

/** What each field shows after the check, in `language`; a field without a message is left out. */
async function messages(
  schema: z.ZodType,
  draft: Readonly<Record<string, unknown>>,
  language: Language,
): Promise<Record<string, string>> {
  const i18n = await shownIn(language);
  const found = checkDraft(schema, draft);
  return Object.fromEntries([...found].map(([field, message]) => [field, i18n._(message)]));
}

/** One field under each rule the helper has a text for, and each way to break it. */
const KNOWN = z.object({
  title: z.string().trim().min(1).max(80),
  code: z.string().min(3),
  initials: z.string().min(1).max(1),
  color: z.string(),
  rate: z.number().min(10).max(1000),
  hours: z.number().positive().lt(24),
  count: z.int(),
});

describe("the check of a draft", () => {
  it("finds nothing in a draft the schema accepts", () => {
    const draft = { title: "Kitchen", code: "abc", initials: "K" };
    expect(
      checkDraft(z.object({ title: KNOWN.shape.title, code: KNOWN.shape.code }), draft).size,
    ).toBe(0);
  });

  it("puts each message at the field of the same name", () => {
    const schema = z.object({ title: z.string().min(1), notes: z.string().max(3) });
    expect([...checkDraft(schema, { title: "", notes: "long" }).keys()]).toEqual([
      "title",
      "notes",
    ]);
  });

  it("puts a message of a nested field at its dotted path", () => {
    const schema = z.object({ lines: z.array(z.object({ amount: z.number().min(1) })) });
    expect([...checkDraft(schema, { lines: [{ amount: 1 }, { amount: 0 }] }).keys()]).toEqual([
      "lines.1.amount",
    ]);
  });

  it("keeps the first message of a field that breaks two rules", async () => {
    const schema = z.object({ code: z.string().min(3).regex(/^\d+$/) });
    expect(await messages(schema, { code: "a" }, "en")).toEqual({
      code: "At least 3 characters.",
    });
  });

  it.each<[Language, Record<string, string>]>([
    [
      "en",
      {
        title: "This field is required.",
        code: "At least 3 characters.",
        initials: "At most 1 character.",
        color: "This field is required.",
        rate: "At least 10.",
        hours: "More than 0.",
        count: "Enter a whole number.",
      },
    ],
    [
      "de",
      {
        title: "Dieses Feld ist erforderlich.",
        code: "Mindestens 3 Zeichen.",
        initials: "Höchstens 1 Zeichen.",
        color: "Dieses Feld ist erforderlich.",
        rate: "Mindestens 10.",
        hours: "Mehr als 0.",
        count: "Gib eine ganze Zahl ein.",
      },
    ],
  ])("gives every known kind of violation its text in %s", async (language, expected) => {
    const draft = {
      title: "   ",
      code: "ab",
      initials: "KM",
      color: null,
      rate: 5,
      hours: 0,
      count: 1.5,
    };
    expect(await messages(KNOWN, draft, language)).toEqual(expected);
  });

  it.each<[Language, Record<string, string>]>([
    ["en", { rate: "At most 1,000.", hours: "Less than 24." }],
    ["de", { rate: "Höchstens 1.000.", hours: "Weniger als 24." }],
  ])("formats the number of an upper bound in %s", async (language, expected) => {
    const schema = z.object({ rate: KNOWN.shape.rate, hours: KNOWN.shape.hours });
    expect(await messages(schema, { rate: 5000, hours: 24 }, language)).toEqual(expected);
  });

  it.each<[Language, string]>([
    ["en", "At least 2 characters."],
    ["de", "Mindestens 2 Zeichen."],
  ])(
    "counts the characters of an empty text against a lower bound above one in %s",
    async (language, text) => {
      expect(await messages(z.object({ code: z.string().min(2) }), { code: "" }, language)).toEqual(
        {
          code: text,
        },
      );
    },
  );

  it.each<[Language, string]>([
    ["en", "Invalid value."],
    ["de", "Ungültiger Wert."],
  ])("shows the catch-all for a violation it does not know in %s", async (language, text) => {
    const schema = z.object({
      email: z.email(),
      pattern: z.string().regex(/^\d+$/),
      choice: z.enum(["a", "b"]),
      large: z.bigint().min(1n),
      tags: z.array(z.string()).min(1),
    });
    const draft = {
      email: "no",
      pattern: "x",
      choice: "c",
      large: 0n,
      tags: [],
    };
    expect(await messages(schema, draft, language)).toEqual({
      email: text,
      pattern: text,
      choice: text,
      large: text,
      tags: text,
    });
  });

  it.each<Language>(["en", "de"])("never shows a text of Zod in %s", async (language) => {
    const unknown = z.object({ email: z.email(), choice: z.enum(["a"]) });
    const cases: [z.ZodType, Record<string, unknown>][] = [
      [KNOWN, { title: "", code: "", initials: "KM", color: 1, rate: 5000, hours: -1, count: 0.5 }],
      [unknown, { email: "no", choice: "b" }],
    ];
    const i18n = await shownIn(language);
    for (const [schema, draft] of cases) {
      const zodTexts = new Set(
        (schema.safeParse(draft).error?.issues ?? []).map((issue) => issue.message),
      );
      expect(zodTexts.size).toBeGreaterThan(0);
      for (const message of checkDraft(schema, draft).values()) {
        expect(zodTexts).not.toContain(i18n._(message));
      }
    }
  });
});
