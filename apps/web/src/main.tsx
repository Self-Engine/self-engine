import "@mantine/core/styles.css";
import "@self-engine/theme/fonts.css";

import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PreviewAppearance } from "./preview-appearance.tsx";
import { router } from "./router.ts";

const container = document.getElementById("root");
if (container === null) throw new Error("index.html has no #root element");

createRoot(container).render(
  <StrictMode>
    <PreviewAppearance>
      <RouterProvider router={router} />
    </PreviewAppearance>
  </StrictMode>,
);
