import type { StartupRules } from "./startup-bundle.ts";

/** What the startup check of the web app holds the production build to (D258, D269, D293, D300, D330). */
export const STARTUP_RULES = {
  // Baseline 839,270 raw JS bytes (#136); measured plus 6 %, rounded up to whole KiB (D258).
  maxBytes: 869 * 1024,
  lazyOnly: [
    {
      // What `import … from "zod"` loads: 85 KB at startup, 35 KB more than the parts that
      // `zod/mini` needs (#136).
      name: "Zod's full build",
      path: "/node_modules/zod/v4/classic/",
      instead: 'declare a schema that startup code reads, such as a Setting\'s, with "zod/mini".',
    },
    {
      // 107 icons, each carrying all six Phosphor weights: 343,907 bytes (88,198 gzipped) with
      // the mark, against 46,650 left below the limit (#260).
      name: "The directory of entry pictures",
      path: "/packages/icons/src/directory/",
      instead:
        "draw an entry's icon with the mark of @self-engine/ui/entry-mark only in a View that loads on demand.",
    },
    {
      // The grid of the icon field's Emoji tab (D300), with its virtual list (#268).
      name: "Mantine's emoji picker",
      path: "/node_modules/@mantine/emoji/",
      instead:
        "import it only from the Emoji tab of the icon field, which loads when the tab first opens.",
    },
    {
      // The draft of every form (D318). It loads with the first Edit Drawer, never at startup
      // (D325).
      name: "The form library",
      path: "/node_modules/@mantine/form/",
      instead:
        "build forms with @self-engine/forms only in an Edit Drawer or a View that loads on demand.",
    },
    {
      // The date and time fields of `forms` (D325), with their date library.
      name: "Mantine's date fields",
      path: "/node_modules/@mantine/dates/",
      instead:
        "build forms with @self-engine/forms only in an Edit Drawer or a View that loads on demand.",
    },
    {
      // A form checks its draft with the input schema of the Contract (D317), so the Edit Drawer
      // loads the Contract and with it Zod's full build; the rest of the renderer reads the
      // Contract as a type (D187).
      name: "A module's Contract",
      path: "/src/contracts/",
      instead:
        "import it as a type in startup code, and at runtime only in an Edit Drawer that loads on demand, where a form checks with its input schema.",
    },
    {
      // The id schema and the field-list building block that derives create and edit inputs
      // (D329). They build Zod schemas, so they load with a Contract, never at startup.
      name: "The shared schemas of db",
      path: "/packages/db/src/schema/",
      instead:
        "import them only from a module's Contract or row map; startup code reads the Contract as a type.",
    },
    {
      // The project picker of `projects` (D330): it loads with the form of a module above that
      // uses it, together with the Entry Mark and Mantine's Select, never at startup.
      name: "The project picker",
      path: "/packages/projects/src/picker/",
      instead:
        "import @self-engine/projects/picker only from a form that loads on demand, such as an Edit Drawer's.",
    },
    {
      // The names and search words of 1,932 emojis: about 790 KB per language (#268).
      name: "The emoji data",
      path: "/node_modules/emojibase-data/",
      instead:
        "load it with a dynamic import, one chunk per language, when the Emoji tab first opens.",
    },
  ],
} as const satisfies StartupRules;
