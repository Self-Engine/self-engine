// Choosing the icon of an entry from the 107 pictures of the directory (D291, D293): a button that
// shows the current icon and opens a Mantine `Popover` with a search over the labels and a grid of
// the pictures. The grid draws only while the popover is open, and each picture is a row of its
// own that redraws only when its own state changes, so a search or a move of the focus redraws
// what changed and not all 107.

import { useLingui } from "@lingui/react/macro";
import {
  Button,
  Group,
  Input,
  Popover,
  rem,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { ICON_DIRECTORY, ICON_LABELS } from "@self-engine/icons/directory";
import { ICON_NAMES, type IconName, resolveEntryIcon } from "@self-engine/icons/names";
import { roleColor } from "@self-engine/theme";
import { type KeyboardEvent, memo, useId, useMemo, useRef, useState } from "react";

export interface EntryIconPickerProps {
  /**
   * The stored `icon`. An icon name shows as chosen; an emoji, a name the directory does not know
   * or any other text shows as "no icon" and stays stored until the user chooses.
   */
  readonly value: string | null | undefined;
  /** An icon name, which `entryIconSchema` accepts, or `null` when the user clears the icon. */
  readonly onChange: (icon: IconName | null) => void;
  /** The field's visible name; "Icon" when left out. */
  readonly label?: string;
}

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

/** One picture of the grid. Its own component in `memo`, so a move redraws two, not 107. */
const PictureOption = memo(function PictureOption({
  name,
  label,
  selected,
  tabStop,
  onChoose,
  onFocusName,
}: {
  readonly name: IconName;
  readonly label: string;
  readonly selected: boolean;
  readonly tabStop: boolean;
  readonly onChoose: (name: IconName) => void;
  readonly onFocusName: (name: IconName) => void;
}) {
  const Icon = ICON_DIRECTORY[name];
  return (
    <UnstyledButton
      aria-label={label}
      aria-selected={selected}
      data-name={name}
      onClick={() => {
        onChoose(name);
      }}
      onFocus={() => {
        onFocusName(name);
      }}
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

/** The icon of an entry: a button with the current icon that opens the searchable grid. */
export function EntryIconPicker({ value, onChange, label }: EntryIconPickerProps) {
  const { t, i18n } = useLingui();
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<IconName>();
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const valueId = useId();
  const titleId = useId();
  const resolved = resolveEntryIcon(value);
  const chosen = resolved.kind === "icon" ? resolved.name : undefined;

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

  const close = () => {
    setOpened(false);
    setQuery("");
    setFocused(undefined);
  };
  const choose = (name: IconName | null) => {
    onChange(name);
    close();
  };

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

  const fieldLabel = label ?? t`Icon`;
  const ChosenIcon = chosen === undefined ? undefined : ICON_DIRECTORY[chosen];
  return (
    <Input.Wrapper label={fieldLabel} labelProps={{ id: labelId }}>
      <Popover
        onChange={(next) => {
          if (next) setOpened(true);
          else close();
        }}
        opened={opened}
        position="bottom-start"
        returnFocus
        shadow="md"
        trapFocus
        width={rem(320)}
      >
        <Popover.Target>
          <Button
            aria-labelledby={`${labelId} ${valueId}`}
            color="gray"
            display="block"
            leftSection={ChosenIcon && <ChosenIcon size="md" />}
            onClick={() => {
              if (opened) close();
              else setOpened(true);
            }}
            variant="default"
          >
            <span id={valueId}>
              {chosen === undefined ? t`No icon` : i18n._(ICON_LABELS[chosen])}
            </span>
          </Button>
        </Popover.Target>
        {/* Mantine names the dropdown after its target; the dialog says what it is for instead. */}
        <Popover.Dropdown aria-labelledby={titleId} p="xs">
          <VisuallyHidden id={titleId}>{t`Choose an icon`}</VisuallyHidden>
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
                    onChoose={choose}
                    onFocusName={setFocused}
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
            <Group justify="flex-end">
              <Button
                disabled={chosen === undefined}
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
