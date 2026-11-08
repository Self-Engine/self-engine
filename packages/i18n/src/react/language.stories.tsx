import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";

/** Shows an app message, and the language that was active on its very first render. */
function TranslatedText() {
  const { i18n } = useLingui();
  const [firstLanguage] = useState(i18n.locale);
  return (
    <>
      <p>
        <Trans context="page name">Home</Trans>
      </p>
      <p data-testid="first-language">{firstLanguage}</p>
    </>
  );
}

const meta = {
  title: "Language/App Language",
  component: TranslatedText,
} satisfies Meta<typeof TranslatedText>;

export default meta;

export const English: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Home")).toBeVisible();
    await expect(document.documentElement.lang).toBe("en");
  },
};

export const German: StoryObj<typeof meta> = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Start")).toBeVisible();
    await expect(canvas.getByTestId("first-language")).toHaveTextContent("de");
    await expect(document.documentElement.lang).toBe("de");
  },
};
