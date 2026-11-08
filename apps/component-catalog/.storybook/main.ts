import { linguiPlugin } from "@self-engine/i18n/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  // Names no package, so a story in a new package appears by itself.
  stories: ["../../../packages/*/src/**/*.stories.tsx"],
  // Without the docs addon there is no docs mode, which has to stay off: a document may hold only
  // one `MantineProvider`, and the provider writes to the document element.
  addons: ["@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({ ...vite, plugins: [linguiPlugin(), ...(vite.plugins ?? [])] }),
};

export default config;
