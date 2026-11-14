// The one field for an entry's mark (D299): a button that shows the current icon or emoji and
// opens a Mantine `Popover` with the tabs "Icons" and "Emoji" and one "No icon".
//
// Icons: the 107 pictures of the directory (D291, D293), with a search over the labels. The grid
// draws only while the popover is open, and each picture is a component of its own that takes
// only plain values and redraws only when one of them changes, so a search or a move of the focus
// redraws what changed and not all 107.
//
// Emoji: Mantine's emoji picker (D300). It and the emoji list of the app's language load with a
// dynamic import when the tab first opens, so a user who only chooses icons never loads them.
//
// Search: each tab keeps its own field, ours and Mantine's, and both show one term that lives in
// the field (D301). A term that is exactly one emoji is the choice (D302), in either tab.

import { useLingui } from "@lingui/react/macro";
import {
  Button,
  Center,
  Group,
  Input,
  Loader,
  Popover,
  rem,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { ICON_DIRECTORY, ICON_LABELS } from "@self-engine/icons/directory";
import { ICON_NAMES, type IconName, isIconName, resolveEntryIcon } from "@self-engine/icons/names";
import { roleColor } from "@self-engine/theme";
import {
  type ComponentType,
  type KeyboardEvent,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EmojiTabProps } from "./emoji-tab.tsx";
import { emojiOfSearchTerm } from "./search-term.ts";

export interface EntryIconPickerProps {
  /**
   * The stored `icon`. An icon name or one emoji shows on the button, an emoji the list does not
   * know included; a name the directory does not know or any other text shows as "no icon". The
   * stored text stays until the user chooses, and "No icon" clears any of it.
   */
  readonly value: string | null | undefined;
  /**
   * An icon name or exactly one emoji, which `entryIconSchema` accepts, or `null` when the user
   * clears the mark.
   */
  readonly onChange: (icon: string | null) => void;
  /** The field's visible name; "Icon" when left out. */
  readonly label?: string;
}

type Tab = "icons" | "emoji";

/** A text as the search compares it: one case, and without accents, so "gluh" finds "Glühbirne". */
function folded(text: string, locale: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase(locale);
}

interface Picture {
  readonly name: IconName;
  readonly label: string;
  readonly searched: string;
}

/**
 * One picture of the grid. Its own component in `memo` with plain values only, so a move of the
 * focus redraws two, not 107: the grid handles the clicks and the focus for every picture, and no
 * handler that changes with each render reaches a picture.
 */
const PictureOption = memo(function PictureOption({
  name,
  label,
  selected,
  tabStop,
}: {
  readonly name: IconName;
  readonly label: string;
  readonly selected: boolean;
  readonly tabStop: boolean;
}) {
  const Icon = ICON_DIRECTORY[name];
  return (
    <UnstyledButton
      aria-label={label}
      aria-selected={selected}
      data-name={name}
      role="option"
      style={{
        alignItems: "center",
        aspectRatio: "1",
        backgroundColor: selected ? roleColor("accentSoft") : undefined,
        border: `${rem(1)} solid ${selected ? roleColor("accentText") : "transparent"}`,
        borderRadius: "var(--mantine-radius-md)",
        color: selected ? roleColor("accentText") : roleColor("text"),
        display: "flex",
        justifyContent: "center",
      }}
      tabIndex={tabStop ? 0 : -1}
      title={label}
    >
      <Icon size="lg" />
    </UnstyledButton>
  );
});

/** The grid's cells follow the Density and the font scale: a cell is as high as a row. */
const GRID_STYLE = {
  display: "grid",
  gap: rem(2),
  gridTemplateColumns: "repeat(auto-fill, minmax(var(--se-row-height), 1fr))",
} as const;

/** The picture an event of the grid happened on, by its `data-name`, if any. */
function pictureOf(target: EventTarget): IconName | undefined {
  if (!(target instanceof Element)) return undefined;
  const name = target.closest<HTMLElement>('[role="option"]')?.dataset["name"];
  return name !== undefined && isIconName(name) ? name : undefined;
}

/** How the grid moves the focus: Left and Right by one picture, Up and Down by a row. */
function nextIndex(key: string, at: number, count: number, columns: number): number | undefined {
  switch (key) {
    case "ArrowLeft":
      return Math.max(at - 1, 0);
    case "ArrowRight":
      return Math.min(at + 1, count - 1);
    case "ArrowUp":
      return at - columns;
    case "ArrowDown":
      return Math.min(at + columns, count - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}

/** The width of the popover: Mantine's emoji grid at its defaults, 9 columns of 32 px. */
const POPOVER_WIDTH = rem(320);

/** The height of a tab's content below its search: the icon grid at most, the loader exactly. */
const PANEL_HEIGHT = rem(264);

/** The line a tab shows in place of its content: no match, or emojis that could not load. */
function EmptyNote({ children }: { readonly children: string }) {
  return (
    <Text c="dimmed" py="sm" size="sm" ta="center">
      {children}
    </Text>
  );
}

/** The Icons tab: the search over the labels and the grid of the 107 pictures. */
function IconsTab({
  chosen,
  onChoose,
  query,
  onQueryChange,
}: {
  readonly chosen: IconName | undefined;
  readonly onChoose: (name: IconName) => void;
  /** The search term, shared with the Emoji tab (D301). */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
}) {
  const { t, i18n } = useLingui();
  const [focused, setFocused] = useState<IconName>();
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Labels in the active language, folded once per language rather than on every keystroke.
  const pictures = useMemo<readonly Picture[]>(
    () =>
      ICON_NAMES.map((name) => {
        const label = i18n._(ICON_LABELS[name]);
        return { name, label, searched: folded(label, i18n.locale) };
      }),
    [i18n, i18n.locale],
  );
  const wanted = folded(query.trim(), i18n.locale);
  const found =
    wanted === "" ? pictures : pictures.filter((picture) => picture.searched.includes(wanted));
  const shownNames = found.map((picture) => picture.name);
  // The one Tab stop of the grid: the focused picture, else the chosen one, else the first.
  const tabStop =
    [focused, chosen].find((name) => name !== undefined && shownNames.includes(name)) ??
    shownNames[0];

  const options = () =>
    Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const focusOption = (index: number) => options()[index]?.focus();

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = options();
    const at = all.indexOf(event.target as HTMLElement);
    if (at === -1) return;
    const top = all[0]?.offsetTop;
    const columns = all.filter((option) => option.offsetTop === top).length || 1;
    const next = nextIndex(event.key, at, all.length, columns);
    if (next === undefined) return;
    event.preventDefault();
    if (next < 0) searchRef.current?.focus();
    else focusOption(next);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = tabStop === undefined ? -1 : shownNames.indexOf(tabStop);
    if (index !== -1) focusOption(index);
  };

  return (
    <Stack gap="xs">
      <TextInput
        aria-label={t`Search icons`}
        data-autofocus
        onChange={(event) => {
          onQueryChange(event.currentTarget.value);
        }}
        onKeyDown={onSearchKeyDown}
        placeholder={t`Search icons`}
        ref={searchRef}
        type="search"
        value={query}
      />
      <ScrollArea.Autosize mah={PANEL_HEIGHT} type="auto">
        <div
          aria-label={t`Icons`}
          onClick={(event) => {
            const name = pictureOf(event.target);
            if (name !== undefined) onChoose(name);
          }}
          onFocus={(event) => {
            const name = pictureOf(event.target);
            if (name !== undefined) setFocused(name);
          }}
          onKeyDown={onGridKeyDown}
          ref={gridRef}
          role="listbox"
          style={GRID_STYLE}
        >
          {found.map((picture) => (
            <PictureOption
              key={picture.name}
              label={picture.label}
              name={picture.name}
              selected={picture.name === chosen}
              tabStop={picture.name === tabStop}
            />
          ))}
        </div>
        {found.length === 0 && <EmptyNote>{t`No icon matches the search.`}</EmptyNote>}
      </ScrollArea.Autosize>
    </Stack>
  );
}

/** The Emoji tab's code with the emoji list of one language, once both have loaded. */
interface LoadedEmojiTab {
  readonly EmojiTab: ComponentType<EmojiTabProps>;
  readonly data: EmojiTabProps["data"];
  readonly locale: string;
}

/**
 * The Emoji tab: loads Mantine's picker and the emoji list of the app's language with a dynamic
 * import on its first opening, and the list of another language after a switch. The browser keeps
 * the code and the module keeps the list, so a later opening shows the grid at once.
 */
function EmojiPanel({
  onChoose,
  autoFocus,
  query,
  onQueryChange,
}: {
  readonly onChoose: (emoji: string) => void;
  readonly autoFocus: boolean;
  /** The search term, shared with the Icons tab (D301). */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
}) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale;
  const [loaded, setLoaded] = useState<LoadedEmojiTab | "failed">();
  useEffect(() => {
    let current = true;
    import("./emoji-tab.tsx")
      .then(async (tab) => ({
        EmojiTab: tab.EmojiTab,
        data: await tab.loadEmojiData(tab.emojiLanguageOf(locale)),
        locale,
      }))
      .then(
        (next) => {
          if (current) setLoaded(next);
        },
        () => {
          // The tab says that the emojis could not load. A later opening imports again and gets
          // the same error, as `loadEmojiData` explains, until the app starts anew.
          if (current) setLoaded("failed");
        },
      );
    return () => {
      current = false;
    };
  }, [locale]);

  if (loaded === "failed") return <EmptyNote>{t`The emojis could not be loaded.`}</EmptyNote>;
  if (loaded?.locale !== locale)
    return (
      <Center h={PANEL_HEIGHT}>
        <Loader aria-label={t`Loading the emojis`} size="sm" />
      </Center>
    );
  const { EmojiTab, data } = loaded;
  return (
    <EmojiTab
      autoFocus={autoFocus}
      data={data}
      onChoose={onChoose}
      onQueryChange={onQueryChange}
      query={query}
    />
  );
}

/** The mark of an entry: a button with the current icon or emoji that opens the two tabs. */
export function EntryIconPicker({ value, onChange, label }: EntryIconPickerProps) {
  const { t, i18n } = useLingui();
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>("icons");
  // Whether the user has switched the tab in this opening: from then the focus stays where the
  // user put it, on the tab.
  const [switched, setSwitched] = useState(false);
  // The key of the tabs, counted up at each opening: a new key mounts them anew, so each opening
  // starts afresh, with an empty search and no skin tone, even while the dropdown of the last
  // opening is still fading out.
  const [openingKey, setOpeningKey] = useState(0);
  // One search term for both tabs (D301): it lives here, so it survives a switch of the tab, and
  // each opening empties it.
  const [query, setQuery] = useState("");
  // Whether an input method is composing in a search field: its text is not yet a choice.
  const composing = useRef(false);
  // Whether this opening has taken an emoji from the search, so the input event some browsers
  // send after the end of a composition does not answer it twice.
  const taken = useRef(false);
  const labelId = useId();
  const valueId = useId();
  const titleId = useId();
  const resolved = resolveEntryIcon(value);
  const chosen = resolved.kind === "icon" ? resolved.name : undefined;
  // The tab of what is stored: an emoji opens on "Emoji", anything else on "Icons".
  const storedTab: Tab = resolved.kind === "emoji" ? "emoji" : "icons";
  // Any stored text can be cleared, an emoji or a name from a newer version included.
  const clearable = typeof value === "string" && value !== "";

  const open = () => {
    setTab(storedTab);
    setSwitched(false);
    setQuery("");
    composing.current = false;
    taken.current = false;
    setOpeningKey((count) => count + 1);
    setOpened(true);
  };
  const close = () => {
    setOpened(false);
  };
  const choose = (next: string | null) => {
    onChange(next);
    close();
  };
  // A term that is exactly one emoji is the choice in both tabs (D302); any other text is the
  // search. It is taken as the term changes, before Mantine's search sees an Enter.
  const search = (term: string) => {
    if (taken.current) return;
    const emoji = composing.current ? undefined : emojiOfSearchTerm(term);
    if (emoji === undefined) {
      setQuery(term);
      return;
    }
    taken.current = true;
    setQuery("");
    choose(emoji);
  };

  const fieldLabel = label ?? t`Icon`;
  const ChosenIcon = chosen === undefined ? undefined : ICON_DIRECTORY[chosen];
  const shownValue =
    resolved.kind === "emoji"
      ? resolved.emoji
      : chosen === undefined
        ? t`No icon`
        : i18n._(ICON_LABELS[chosen]);
  return (
    <Input.Wrapper label={fieldLabel} labelProps={{ id: labelId }}>
      <Popover
        onChange={(next) => {
          if (next) open();
          else close();
        }}
        opened={opened}
        position="bottom-start"
        returnFocus
        shadow="md"
        trapFocus
        width={POPOVER_WIDTH}
      >
        <Popover.Target>
          <Button
            aria-labelledby={`${labelId} ${valueId}`}
            color="gray"
            display="block"
            leftSection={ChosenIcon && <ChosenIcon size="md" />}
            onClick={() => {
              if (opened) close();
              else open();
            }}
            variant="default"
          >
            <span id={valueId}>{shownValue}</span>
          </Button>
        </Popover.Target>
        {/* Mantine names the dropdown after its target; the dialog says what it is for instead. */}
        {/* Composition events bubble: the two search fields are the dropdown's only text. */}
        <Popover.Dropdown
          aria-labelledby={titleId}
          onCompositionEnd={(event) => {
            composing.current = false;
            if (event.target instanceof HTMLInputElement) search(event.target.value);
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          p="xs"
        >
          <VisuallyHidden id={titleId}>{t`Choose an icon`}</VisuallyHidden>
          <Stack gap="xs">
            <Tabs
              keepMounted={false}
              key={openingKey}
              onChange={(next) => {
                if (next !== "icons" && next !== "emoji") return;
                setTab(next);
                if (next !== tab) setSwitched(true);
              }}
              value={tab}
            >
              <Tabs.List grow mb="xs">
                <Tabs.Tab value="icons">{t`Icons`}</Tabs.Tab>
                <Tabs.Tab value="emoji">{t`Emoji`}</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="icons">
                <IconsTab chosen={chosen} onChoose={choose} onQueryChange={search} query={query} />
              </Tabs.Panel>
              <Tabs.Panel value="emoji">
                {/* The search takes the focus when the popover opens on this tab, as the
                    search of the Icons tab does. A switch of the tab mounts the panel anew, and
                    then the focus stays on the tab, so the arrows go on switching it. */}
                <EmojiPanel
                  autoFocus={storedTab === "emoji" && !switched}
                  onChoose={choose}
                  onQueryChange={search}
                  query={query}
                />
              </Tabs.Panel>
            </Tabs>
            <Group justify="flex-end">
              <Button
                disabled={!clearable}
                onClick={() => {
                  choose(null);
                }}
                size="xs"
                variant="subtle"
              >
                {t`No icon`}
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Input.Wrapper>
  );
}
