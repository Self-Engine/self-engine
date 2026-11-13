import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { appLanguageOf } from "@self-engine/settings-area/settings";
import { FeedbackHost } from "@self-engine/ui";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppLanguage, browserLanguages } from "./app-language.tsx";
import { AppearanceProvider } from "./appearance.tsx";
import { connectDesktopData, dataConnection, markConnectionStates } from "./desktop-data.ts";
import { router } from "./router.ts";
import { settingsStore } from "./settings-store.ts";

const container = document.getElementById("root");
if (container === null) throw new Error("index.html has no #root element");

// First, so the data process's port is on its way while the rest starts. The marks are what the
// desktop smoke test reads (desktop-data.ts).
if (window.desktopBridge) {
  markConnectionStates(dataConnection, (name, options) => performance.mark(name, options));
  connectDesktopData(window, window.desktopBridge, dataConnection);
}

// The first render needs the stored appearance and language; the Start Cache covers this wait.
await settingsStore.load();

const language = appLanguageOf(settingsStore, browserLanguages());
const i18n = createI18n();
// Nothing renders before the catalog is there, so no text shows in the wrong language. The Start
// Cache has already painted the background.
await activateLanguage(i18n, language);

createRoot(container).render(
  <StrictMode>
    <AppLanguage i18n={i18n} initialLanguage={language} store={settingsStore}>
      <AppearanceProvider>
        <FeedbackHost>
          {/* On the web nothing connects, so Queries wait, as every call does (D196, D257). */}
          <DataProvider access={portAccessOf(dataConnection)}>
            <RouterProvider router={router} />
          </DataProvider>
        </FeedbackHost>
      </AppearanceProvider>
    </AppLanguage>
  </StrictMode>,
);
