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

/** The Icons tab: the search over the labels and the grid of the 107 pictures. */
function IconsTab({
  chosen,
  onChoose,
}: {
  readonly chosen: IconName | undefined;
  readonly onChoose: (name: IconName) => void;
}) {
  const { t, i18n } = useLingui();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<IconName>();
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Labels in the active language, folded once per language rather than on every keystroke.
  const pictures = useMemo<readonly Picture[]>(
    () =>
      ICON_NAMES.map((name) => {
        const shown = i18n._(ICON_LABELS[name]);
        return { name, label: shown, searched: folded(shown, i18n.locale) };
      }),
    [i18n, i18n.locale],
  );
  const wanted = folded(query.trim(), i18n.locale);
  const shown =
    wanted === "" ? pictures : pictures.filter((picture) => picture.searched.includes(wanted));
  const shownNames = shown.map((picture) => picture.name);
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
          setQuery(event.currentTarget.value);
        }}
        onKeyDown={onSearchKeyDown}
        placeholder={t`Search icons`}
        ref={searchRef}
        type="search"
        value={query}
      />
      <ScrollArea.Autosize mah={rem(264)} type="auto">
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
          {shown.map((picture) => (
            <PictureOption
              key={picture.name}
              label={picture.label}
              name={picture.name}
              selected={picture.name === chosen}
              tabStop={picture.name === tabStop}
            />
          ))}
        </div>
        {shown.length === 0 && (
          <Text c="dimmed" py="sm" size="sm" ta="center">
            {t`No icon matches the search.`}
          </Text>
        )}
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
}: {
  readonly onChoose: (emoji: string) => void;
  readonly autoFocus: boolean;
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
          // The tab says that the emojis could not load, and the next opening tries again.
          if (current) setLoaded("failed");
        },
      );
    return () => {
      current = false;
    };
  }, [locale]);

  if (loaded === "failed")
    return (
      <Text c="dimmed" py="sm" size="sm" ta="center">
        {t`The emojis could not be loaded.`}
      </Text>
    );
  if (loaded?.locale !== locale)
    return (
      <Center h={rem(264)}>
        <Loader aria-label={t`Loading the emojis`} size="sm" />
      </Center>
    );
  const { EmojiTab, data } = loaded;
  return <EmojiTab autoFocus={autoFocus} data={data} onChoose={onChoose} />;
}

/** The mark of an entry: a button with the current icon or emoji that opens the two tabs. */
export function EntryIconPicker({ value, onChange, label }: EntryIconPickerProps) {
  const { t, i18n } = useLingui();
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>("icons");
  // Each opening starts afresh, with an empty search and no skin tone, even while the dropdown of
  // the last opening is still fading out.
  const [opening, setOpening] = useState(0);
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
    setOpening((count) => count + 1);
    setOpened(true);
  };
  const close = () => {
    setOpened(false);
  };
  const choose = (next: string | null) => {
    onChange(next);
    close();
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
        <Popover.Dropdown aria-labelledby={titleId} p="xs">
          <VisuallyHidden id={titleId}>{t`Choose an icon`}</VisuallyHidden>
          <Stack gap="xs">
            <Tabs
              keepMounted={false}
              key={opening}
              onChange={(next) => {
                if (next === "icons" || next === "emoji") setTab(next);
              }}
              value={tab}
            >
              <Tabs.List grow mb="xs">
                <Tabs.Tab value="icons">{t`Icons`}</Tabs.Tab>
                <Tabs.Tab value="emoji">{t`Emoji`}</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="icons">
                <IconsTab chosen={chosen} onChoose={choose} />
              </Tabs.Panel>
              <Tabs.Panel value="emoji">
                {/* The search takes the focus when the popover opens on this tab, as the
                    search of the Icons tab does; a switch of the tab leaves it on the tab. */}
                <EmojiPanel autoFocus={storedTab === "emoji"} onChoose={choose} />
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
