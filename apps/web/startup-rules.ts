import type { LazyOnlyDependency, OnDemandRule, StartupRules } from "./startup-bundle.ts";

/**
 * What no View and no Group loads: a View reads a Contract as a type, and only a lazy form loads
 * its schemas (ADR 0021). A View that parses an id from its address takes the module's light id
 * entry, such as `@self-engine/projects/ids`, which brings neither (#275).
 */
const NO_CONTRACT: readonly LazyOnlyDependency[] = [
  {
    name: "A module's Contract",
    path: "/src/contracts/index.ts",
    instead:
      "import it as a type in a View; parse an id with the module's light id entry, such as @self-engine/projects/ids.",
  },
  {
    name: "oRPC's contract builder",
    path: "/node_modules/@orpc/contract/",
    instead: "import a Contract only as a type in a View; only a lazy form loads it.",
  },
];

const view = (name: string, path: string): OnDemandRule => ({ name, path, without: NO_CONTRACT });

/** What `import … from "zod"` loads: 85 KB at startup, 35 KB more than the parts that `zod/mini` needs (#136). */
const ZOD_FULL: LazyOnlyDependency = {
  name: "Zod's full build",
  path: "/node_modules/zod/v4/classic/",
  instead: 'declare a schema that startup code reads, such as a Setting\'s, with "zod/mini".',
};

/**
 * The Views, Groups and Module Indicators that load on demand, each held to `NO_CONTRACT`. An
 * indicator loads after every start, so it reads its Contract as a type as well.
 */
const VIEWS: readonly OnDemandRule[] = [
  {
    // It loads after every start, so it reads the duration through the light entry of `time`,
    // whose main entry builds its schemas with Zod's full build (#349).
    name: "The timer's Module Indicator of time-tracking",
    path: "/packages/time-tracking/src/indicator/index.tsx",
    without: [
      ...NO_CONTRACT,
      {
        ...ZOD_FULL,
        instead:
          "read time values in an indicator through a light entry of time, such as @self-engine/time/running-time.",
      },
    ],
  },
  view("The week View of time-tracking", "/packages/time-tracking/src/week.tsx"),
  view('The Group "Projects" of time-tracking', "/packages/time-tracking/src/projects-group.tsx"),
  view('The View "Active" of projects', "/packages/projects/src/active.tsx"),
  view('The View "Archive" of projects', "/packages/projects/src/archive.tsx"),
];

/** What the startup check of the web app holds the production build to (D258, D269, D293, D300, D330). */
export const STARTUP_RULES = {
  // Baseline 839,270 raw JS bytes (#136); measured plus 6 %, rounded up to whole KiB (D258).
  maxBytes: 869 * 1024,
  lazyOnly: [
    ZOD_FULL,
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
      // The date and time fields of `forms` (D325), with their styles.
      name: "Mantine's date fields",
      path: "/node_modules/@mantine/dates/",
      instead:
        "build forms with @self-engine/forms only in an Edit Drawer or a View that loads on demand.",
    },
    {
      // Mantine's date fields compute with it; nothing of the app imports it (ADR 0027).
      name: "The date library of Mantine's date fields",
      path: "/node_modules/dayjs/",
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
      // A table name is renderer metadata. Its tie to the Row Map is type-only (D335).
      name: "A module's storage code",
      path: "/src/data/",
      instead: "import its Row Map only as a type in its Shell Contribution.",
    },
    {
      // Every module keeps its Module Indicator's code in this folder: the Shell loads it in an
      // idle moment after the first paint and shows the module's icon until then (D359). The
      // Indicator Panel's content lives here too; it loads at the first opening, preloaded when
      // idle once the indicator came.
      name: "A module's Module Indicator",
      path: "/src/indicator/",
      instead:
        "import it only through the indicator's load in the module's Shell Contribution, which the Shell calls after the first paint.",
    },
    {
      // The timer's Operations with their Notices, which its Module Indicator, its Commands and
      // its Indicator Panel share (#349). Outside `src/indicator/`, so a Command imports it too.
      name: "The timer's actions of time-tracking",
      path: "/packages/time-tracking/src/timer-actions.tsx",
      instead:
        "import it only from the timer's Module Indicator, a Command or the Indicator Panel, which load on demand.",
    },
    {
      // Which part the timer's Indicator Panel shows, and how a Command opens it at "Stop at …"
      // (#350): outside `src/indicator/`, so a Command imports them too.
      name: "The state of the timer's Indicator Panel of time-tracking",
      path: "/packages/time-tracking/src/timer-panel-part.ts",
      instead:
        "import it only from the timer's Module Indicator, its Indicator Panel or a Command, which load on demand.",
    },
    {
      name: 'The opener of the timer\'s "Stop at …" for a Command of time-tracking',
      path: "/packages/time-tracking/src/stop-at.ts",
      instead: "import it only from a Command, which loads on demand.",
    },
    {
      // The frame of an Indicator Panel with Mantine's Popover and its positioning: 16 KB at
      // startup (#369). The Shell loads it beside the indicators after the first paint.
      name: "The frame of an Indicator Panel",
      path: "/packages/shell/src/indicator-panel.tsx",
      instead:
        "reach it only through LazyIndicatorPanelFrame of lazy-indicator-panel-frame.tsx, which loads it on demand.",
    },
    {
      name: "Storage",
      path: "/packages/storage/src/core/",
      instead: "import storage types only in the renderer.",
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
      // Every zone of the runtime with its offset now, some 400 entries (#364). It loads with the
      // Time Zone row of the settings area.
      name: "The Time Zone list",
      path: "/packages/time/src/zone-list.ts",
      instead: "import @self-engine/time/zone-list only from a View that loads on demand.",
    },
    {
      // The names and search words of 1,932 emojis: about 790 KB per language (#268).
      name: "The emoji data",
      path: "/node_modules/emojibase-data/",
      instead:
        "load it with a dynamic import, one chunk per language, when the Emoji tab first opens.",
    },
  ],
  onDemand: VIEWS,
} as const satisfies StartupRules;
