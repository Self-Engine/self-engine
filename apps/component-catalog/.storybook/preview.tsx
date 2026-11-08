import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { activateLanguage, createI18n } from "@self-engine/i18n";
import { LanguageProvider } from "@self-engine/i18n/react";
import { BUILT_IN_THEMES } from "@self-engine/theme";
import { ThemeProvider } from "@self-engine/theme/mantine";
import type { Preview } from "@storybook/react-vite";
import { appearanceOf, globalTypes, initialGlobals, languageOf } from "./toolbar.ts";

const i18n = createI18n();

let consoleErrors: unknown[][] = [];
const originalConsoleError = console.error;

/**
 * Chromium's notice that it delivered a resize in the next frame, not a fault in a component.
 * Floating layers measure themselves, so whether it appears depends on timing, and a gate that
 * failed on it would be flaky.
 */
const RESIZE_OBSERVER_NOTICE = "ResizeObserver loop completed with undelivered notifications";

function isResizeObserverNotice(args: readonly unknown[]): boolean {
  return args.some((arg) => String(arg).includes(RESIZE_OBSERVER_NOTICE));
}

const preview: Preview = {
  globalTypes,
  initialGlobals,
  // Before the render, so that no story shows the previous language for a moment.
  loaders: [
    async ({ globals }) => {
      await activateLanguage(i18n, languageOf(globals));
    },
  ],
  decorators: [
    (Story, { globals }) => (
      <LanguageProvider i18n={i18n} language={languageOf(globals)}>
        <ThemeProvider appearance={appearanceOf(globals)} catalog={BUILT_IN_THEMES}>
          <Story />
        </ThemeProvider>
      </LanguageProvider>
    ),
  ],
  // Collected here and raised afterwards: throwing from `console.error` itself stays green
  // when React recovers (ADR 0012).
  beforeEach() {
    consoleErrors = [];
    console.error = (...args: unknown[]) => {
      if (!isResizeObserverNotice(args)) consoleErrors.push(args);
      originalConsoleError(...args);
    };
  },
  afterEach() {
    console.error = originalConsoleError;
    if (consoleErrors.length > 0) {
      const logged = consoleErrors.map((args) => args.map(String).join(" ")).join("\n");
      throw new Error(`The story logged a console.error:\n${logged}`);
    }
  },
};

export default preview;
