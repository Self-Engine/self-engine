import { activateLanguage, createI18n, LANGUAGE_TAGS } from "@self-engine/i18n";
import { describe, expect, it } from "vite-plus/test";
import { ICON_NAMES } from "../names/index.ts";
import { ICON_LABELS } from "./index.ts";

describe("the labels of the pictures", () => {
  it("label every name of the list", () => {
    expect(Object.keys(ICON_LABELS).toSorted()).toEqual([...ICON_NAMES].toSorted());
  });

  it.each(LANGUAGE_TAGS)("give every picture its own translated label in %s", async (language) => {
    const i18n = createI18n();
    await activateLanguage(i18n, language);
    const labels = ICON_NAMES.map((name) => i18n._(ICON_LABELS[name]));
    // One label per picture: a search for a label never finds two pictures under one word.
    expect(new Set(labels.map((label) => label.toLocaleLowerCase(language))).size).toBe(107);
    for (const label of labels) expect(label.trim()).not.toBe("");
  });

  it.each([
    ["en", "barbell", "Barbell"],
    ["de", "barbell", "Hantel"],
    ["en", "piggy-bank", "Piggy bank"],
    ["de", "piggy-bank", "Sparschwein"],
    ["de", "lightbulb", "Glühbirne"],
  ] as const)("in %s, %s reads %s", async (language, name, label) => {
    const i18n = createI18n();
    await activateLanguage(i18n, language);
    expect(i18n._(ICON_LABELS[name])).toBe(label);
  });
});
