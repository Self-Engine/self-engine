import { msg, plural } from "@lingui/core/macro";
import { describe, expect, test } from "vite-plus/test";
import {
  activateLanguage,
  createI18n,
  type CatalogLoader,
  type I18n,
  type Language,
} from "./index.ts";

const loadFixture: CatalogLoader = async (language) => {
  const catalog = await import(`../../test/fixtures/${language}.po`);
  return (catalog as { readonly messages: Record<string, string> }).messages;
};

async function shownIn(language: Language): Promise<I18n> {
  const i18n = createI18n();
  await activateLanguage(i18n, language, loadFixture);
  return i18n;
}

const entries = (count: number) => msg`${plural(count, { one: "# entry", other: "# entries" })}`;

describe("translating", () => {
  test("shows a message in German", async () => {
    const i18n = await shownIn("de");
    expect(i18n._(msg`Fixture greeting`)).toBe("Testgruß");
  });

  test("shows a message in English", async () => {
    const i18n = await shownIn("en");
    expect(i18n._(msg`Fixture greeting`)).toBe("Fixture greeting");
  });

  test("fills in a placeholder", async () => {
    const name = "Ada";
    const greeting = msg`Hello ${name}`;
    expect((await shownIn("de"))._(greeting)).toBe("Hallo Ada");
    expect((await shownIn("en"))._(greeting)).toBe("Hello Ada");
  });

  test.each([
    [1, "1 Eintrag", "1 entry"],
    [2, "2 Einträge", "2 entries"],
  ])("picks the plural form for %i", async (count, german, english) => {
    expect((await shownIn("de"))._(entries(count))).toBe(german);
    expect((await shownIn("en"))._(entries(count))).toBe(english);
  });

  test("shows the Base Language for a translation that is empty", async () => {
    const i18n = await shownIn("de");
    expect(i18n._(msg`Only in English`)).toBe("Only in English");
  });

  test("each instance keeps its own language", async () => {
    const german = await shownIn("de");
    const english = await shownIn("en");
    expect(german._(msg`Fixture greeting`)).toBe("Testgruß");
    expect(english._(msg`Fixture greeting`)).toBe("Fixture greeting");
  });
});
