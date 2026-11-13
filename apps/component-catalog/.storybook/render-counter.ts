// Before React loads: the render-count gate reads which components drew (D256). The first setup
// file of the story tests, and the first import of the preview for `pnpm storybook`.

import { installRenderCounter } from "@self-engine/ui/story-render-counts";

installRenderCounter();
