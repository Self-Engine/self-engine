import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { activateLanguage, createI18n, resolveAppLanguage } from "@self-engine/i18n";
import { FeedbackHost } from "@self-engine/ui";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PreviewAppearance } from "./preview-appearance.tsx";
import { PreviewLanguage } from "./preview-language.tsx";
import { router } from "./router.ts";
import { settingsStore } from "./settings-store.ts";

const container = document.getElementById("root");
if (container === null) throw new Error("index.html has no #root element");

// The first render needs the stored appearance; the Start Cache covers this wait.
await settingsStore.load();

const language = resolveAppLanguage(undefined, navigator.languages);
const i18n = createI18n();
// Nothing renders before the catalog is there, so no text shows in the wrong language. The Start
// Cache has already painted the background.
await activateLanguage(i18n, language);

createRoot(container).render(
  <StrictMode>
    <PreviewLanguage i18n={i18n} initialLanguage={language}>
      <PreviewAppearance>
        <FeedbackHost>
          <RouterProvider router={router} />
        </FeedbackHost>
      </PreviewAppearance>
    </PreviewLanguage>
  </StrictMode>,
);
