import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { type Appearance, BUILT_IN_THEMES, DEFAULT_APPEARANCE } from "@self-engine/theme";
import { ThemeProvider } from "@self-engine/theme/mantine";
import type { Preview } from "@storybook/react-vite";

/** Independent of the browser's system preference, so every machine renders the same (ADR 0012). */
const FIXED_APPEARANCE: Appearance = { ...DEFAULT_APPEARANCE, colorMode: "light" };

let consoleErrors: unknown[][] = [];
const originalConsoleError = console.error;

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider appearance={FIXED_APPEARANCE} catalog={BUILT_IN_THEMES}>
        <Story />
      </ThemeProvider>
    ),
  ],
  // Collected here and raised afterwards: throwing from `console.error` itself stays green
  // when React recovers (ADR 0012).
  beforeEach() {
    consoleErrors = [];
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
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
