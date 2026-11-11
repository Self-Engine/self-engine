/// <reference types="vite-plus/client" />

// A module's migrations the way the data process bundles them (D139): numbered SQL files,
// collected by the build as text.
export const migrations = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});
