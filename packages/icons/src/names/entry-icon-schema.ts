// The `icon` of an entry as an Operation's input accepts it (D294).

import { z } from "zod/mini";
import { isSingleEmoji } from "./emoji.ts";
import { isIconName } from "./icon-names.ts";

/**
 * A known name or exactly one emoji. Empty is no value: a Contract makes the field optional or
 * nullable around this schema and never stores an empty text. `zod/mini`, because the startup
 * check refuses Zod's full build (D269); it nests in a schema of the full build. Marked pure, so a
 * bundle that only resolves icons leaves Zod out.
 */
export const entryIconSchema = /* @__PURE__ */ z.string().check(
  z.refine((value) => isIconName(value) || isSingleEmoji(value), {
    message: "Expected an icon name or exactly one emoji",
  }),
);
