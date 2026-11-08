// A `.po` catalog, compiled on import by the plugin of `@self-engine/i18n/vite`.
declare module "*.po" {
  import type { Messages } from "@lingui/core";

  export const messages: Messages;
}
