// The test Data Process with `placeholder-alpha` mounted, for `measure-renders.ts`. The module's
// Storage finds its migrations through `import.meta.glob`, so this file is loaded through Vite's
// module runner rather than by Node alone.

import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { placeholderAlpha } from "@self-engine/placeholder-alpha/data";

export function startRenderDataProcess(): Promise<TestDataProcess> {
  return startTestDataProcess({ modules: { placeholderAlpha } });
}
