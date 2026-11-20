import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { DataProvider } from "@self-engine/data-client/react";
import { activateLanguage, createI18n, regionForAppLanguage } from "@self-engine/i18n";
import { appLanguageOf } from "@self-engine/settings-area/settings";
import { deviceTimeZone } from "@self-engine/time/device-time-zone";
import { FeedbackHost } from "@self-engine/ui";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppLanguage, browserLanguages } from "./app-language.tsx";
import { AppearanceProvider } from "./appearance.tsx";
import { dataConnection, startPageData } from "./desktop-data.ts";
import { PageTimeSettings, watchDeviceZone } from "./device-zone.tsx";
import { DeviceZoneOffer } from "./device-zone-offer.tsx";
import { appModules } from "./modules.ts";
import { appReasonTexts } from "./reason-texts.ts";
import { router } from "./router.ts";
import { reportPageError, settingsStore } from "./settings-store.ts";

const container = document.getElementById("root");
if (container === null) throw new Error("index.html has no #root element");

// First, so the data process's port is on its way while the rest starts. The marks are what the
// desktop smoke test reads (desktop-data.ts). Without the desktop app there is no Data Process:
// the page shows that the data cannot be reached, and every call fails at once (D263).
const dataAccess = startPageData(window, dataConnection, (name, options) =>
  performance.mark(name, options),
);

// The first render needs the stored appearance and language; the Start Cache covers this wait.
await settingsStore.load();

// The text of every Reason a Protection Rule can refuse a change with (D334).
const reasonTexts = appReasonTexts(appModules);

const language = appLanguageOf(settingsStore, browserLanguages());
const i18n = createI18n();
// Nothing renders before the catalog is there, so no text shows in the wrong language. The Start
// Cache has already painted the background.
await activateLanguage(i18n, language);

// One source of the device's zone for the page's Time Zone and the offer to switch to it: read now
// and again whenever the window becomes visible.
const deviceZone = watchDeviceZone(document, deviceTimeZone);

createRoot(container).render(
  <StrictMode>
    <AppLanguage i18n={i18n} initialLanguage={language} store={settingsStore}>
      {(activeLanguage) => (
        <PageTimeSettings
          store={settingsStore}
          deviceZone={deviceZone}
          region={regionForAppLanguage(activeLanguage)}
          onError={reportPageError}
        >
          <AppearanceProvider>
            <FeedbackHost>
              <DeviceZoneOffer device={deviceZone} store={settingsStore} />
              <DataProvider access={dataAccess} reasonTexts={reasonTexts}>
                <RouterProvider router={router} />
              </DataProvider>
            </FeedbackHost>
          </AppearanceProvider>
        </PageTimeSettings>
      )}
    </AppLanguage>
  </StrictMode>,
);
