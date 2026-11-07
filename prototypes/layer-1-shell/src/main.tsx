import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist";
import "./global.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
