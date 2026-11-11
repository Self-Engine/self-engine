// The two appearance rows whose controls fit no standard shape: the Theme as cards in their real
// colors, and the Accent as colored circles (D201). Both are built on Mantine's `Radio.Card`, and
// not on `Radio.Group`, which can only be named by a label of its own and not by the row's title.

import type { I18n, MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
  Box,
  ColorSwatch,
  Group,
  Radio,
  rem,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { ThemeColorsIcon } from "@self-engine/icons";
import { useSetting } from "@self-engine/settings/react";
import {
  ACCENT_IDS,
  COLOR_MODES,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  type FinalColors,
  FROM_THEME,
  type ResolvedAppearance,
  type ResolvedColorMode,
  resolveAppearance,
  roleColor,
  type Theme,
  type ThemeCatalog,
} from "@self-engine/theme";
import { useId, useMemo } from "react";
import type { SettingsRow, SettingsRowControlProps } from "./row.ts";
import { APPEARANCE_SETTINGS } from "./settings.ts";
import { VIEW_IDS } from "./views.ts";

const THEME_SETTINGS = {
  light: APPEARANCE_SETTINGS.lightTheme,
  dark: APPEARANCE_SETTINGS.darkTheme,
} as const;

/** The names of the Themes the app ships, which a Theme itself holds in one language only. */
const BUILT_IN_THEME_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  neutral: msg({ message: "Neutral", context: "Theme" }),
  warm: msg({ message: "Warm", context: "Theme" }),
  cool: msg({ message: "Cool", context: "Theme" }),
};

const builtInName = (theme: Theme): MessageDescriptor | undefined =>
  Object.hasOwn(BUILT_IN_THEME_NAMES, theme.id) ? BUILT_IN_THEME_NAMES[theme.id] : undefined;

function themeName(theme: Theme, i18n: I18n): string {
  const name = builtInName(theme);
  return name ? i18n._(name) : theme.name;
}

const PICKER_LABELS: Readonly<Record<ResolvedColorMode, MessageDescriptor>> = {
  light: msg`Theme for light`,
  dark: msg`Theme for dark`,
};

/** By Accent id. A test holds every Accent a user may pick against this list. */
const ACCENT_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  [FROM_THEME]: msg`From Theme`,
  blue: msg({ message: "Blue", context: "Accent" }),
  indigo: msg({ message: "Indigo", context: "Accent" }),
  violet: msg({ message: "Violet", context: "Accent" }),
  teal: msg({ message: "Teal", context: "Accent" }),
  orange: msg({ message: "Orange", context: "Accent" }),
  grape: msg({ message: "Grape", context: "Accent" }),
};

const ACCENT_CHOICES: readonly string[] = [FROM_THEME, ...ACCENT_IDS];

interface RadioChoice {
  readonly value: string;
  readonly disabled?: boolean;
}

/**
 * The one radio of a group the Tab key stops on, as in a native radio group: the chosen one, or
 * the first that can be chosen. `Radio.Card` alone would stop on every card.
 */
function tabStopOf(choices: readonly RadioChoice[], chosen: string): string | undefined {
  const usable = choices.filter((choice) => !choice.disabled);
  return (usable.find((choice) => choice.value === chosen) ?? usable[0])?.value;
}

const CHOSEN_BORDER = roleColor("accentText");

/** A Theme in small: the app's background, a container on it, text and the Accent. */
function ThemePreview({ colors }: { readonly colors: FinalColors }) {
  const bar = (role: "text" | "textMuted" | "accent", width: string) => (
    <Box
      data-color-role={role}
      h={rem(4)}
      style={{ backgroundColor: colors[role], borderRadius: rem(2) }}
      w={width}
    />
  );
  return (
    <Box
      aria-hidden
      data-color-role="chrome"
      p={rem(8)}
      pb={0}
      style={{ backgroundColor: colors.chrome, borderRadius: rem(4), overflow: "hidden" }}
    >
      <Stack
        data-color-role="canvas"
        gap={rem(5)}
        h={rem(44)}
        p={rem(8)}
        style={{
          backgroundColor: colors.canvas,
          border: `${rem(1)} solid ${colors.border}`,
          borderBottom: "none",
          borderRadius: `${rem(4)} ${rem(4)} 0 0`,
        }}
      >
        {bar("text", "70%")}
        {bar("textMuted", "45%")}
        {bar("accent", "30%")}
      </Stack>
    </Box>
  );
}

interface ThemePickerProps {
  readonly store: SettingsRowControlProps["store"];
  readonly mode: ResolvedColorMode;
  /** Only the Themes that have `mode`. */
  readonly themes: readonly Theme[];
  readonly previews: ReadonlyMap<string, ResolvedAppearance>;
  /** Shown above the cards, when the row holds a picker per Color Mode. */
  readonly label: string | undefined;
  /** The element that names the picker instead, when it is the row's only one. */
  readonly labelledBy: string | undefined;
}

function ThemePicker({ store, mode, themes, previews, label, labelledBy }: ThemePickerProps) {
  const { i18n } = useLingui();
  const setting = THEME_SETTINGS[mode];
  const stored = useSetting(store, setting);
  // What the engine shows for a stored Theme that is unknown or lacks this Color Mode.
  const chosen = themes.some((theme) => theme.id === stored) ? stored : DEFAULT_THEME.id;
  const tabStop = tabStopOf(
    themes.map((theme) => ({ value: theme.id })),
    chosen,
  );
  // What `Radio.Card` moves the arrow keys by.
  const groupName = useId();
  const labelId = useId();
  return (
    <Stack gap={rem(4)}>
      {label !== undefined && (
        <Text id={labelId} size="sm">
          {label}
        </Text>
      )}
      <Group
        aria-labelledby={label === undefined ? labelledBy : labelId}
        gap="sm"
        role="radiogroup"
      >
        {themes.map((theme) => {
          const colors = previews.get(theme.id)?.[mode].roles;
          return (
            <Radio.Card
              checked={theme.id === chosen}
              key={theme.id}
              name={groupName}
              onClick={() => {
                store.write(setting, theme.id);
              }}
              p={rem(6)}
              radius="md"
              style={{
                backgroundColor: roleColor("surface"),
                ...(theme.id === chosen && { borderColor: CHOSEN_BORDER }),
              }}
              tabIndex={theme.id === tabStop ? 0 : -1}
              w={rem(132)}
            >
              <Stack gap={rem(6)}>
                {colors && <ThemePreview colors={colors} />}
                <Group gap={rem(6)} px={rem(2)} wrap="nowrap">
                  <Radio.Indicator size="xs" />
                  <Text size="sm" truncate>
                    {themeName(theme, i18n)}
                  </Text>
                </Group>
              </Stack>
            </Radio.Card>
          );
        })}
      </Group>
    </Stack>
  );
}

/**
 * The row "Theme": one picker on a fixed Color Mode, which writes that mode's Theme, and one per
 * Color Mode when the app follows the system.
 */
export function themeRow(catalog: ThemeCatalog): SettingsRow {
  const all = Object.values(catalog);
  const themesOf: Readonly<Record<ResolvedColorMode, readonly Theme[]>> = {
    light: all.filter((theme) => theme.colors.light !== undefined),
    dark: all.filter((theme) => theme.colors.dark !== undefined),
  };

  function ThemeControl({ store, labelledBy }: SettingsRowControlProps) {
    const { i18n } = useLingui();
    const colorMode = useSetting(store, APPEARANCE_SETTINGS.colorMode);
    const accent = useSetting(store, APPEARANCE_SETTINGS.accent);
    const backgroundTint = useSetting(store, APPEARANCE_SETTINGS.backgroundTint);
    // Each Theme as the engine would resolve it with the Accent and Background Tint in use.
    const previews = useMemo(
      () =>
        new Map(
          all.map((theme) => [
            theme.id,
            resolveAppearance(
              {
                ...DEFAULT_APPEARANCE,
                lightTheme: theme.id,
                darkTheme: theme.id,
                accent,
                backgroundTint,
              },
              catalog,
            ),
          ]),
        ),
      [accent, backgroundTint],
    );
    const followsSystem = colorMode === "system";
    const modes = followsSystem ? COLOR_MODES : [colorMode];
    return (
      <Stack flex="0 1 auto" gap="sm">
        {modes.map((mode) => (
          <ThemePicker
            key={mode}
            label={followsSystem ? i18n._(PICKER_LABELS[mode]) : undefined}
            labelledBy={followsSystem ? undefined : labelledBy}
            mode={mode}
            previews={previews}
            store={store}
            themes={themesOf[mode]}
          />
        ))}
      </Stack>
    );
  }

  return {
    id: "theme",
    view: VIEW_IDS.appearance,
    title: msg`Theme`,
    description: msg`The colors of the app. When the app follows the system, light and dark each have their own Theme.`,
    searchWords: [msg`Colors`, msg`Color scheme`, msg`Light Theme`, msg`Dark Theme`],
    values: all.flatMap((theme) => builtInName(theme) ?? []),
    settings: [APPEARANCE_SETTINGS.lightTheme, APPEARANCE_SETTINGS.darkTheme],
    control: ThemeControl,
  };
}

const SWATCH_SIZE = 24;

/** The row "Accent": a circle per fixed Accent, with "From Theme" first. */
export function accentRow(catalog: ThemeCatalog): SettingsRow {
  function AccentControl({ store, labelledBy }: SettingsRowControlProps) {
    const { i18n } = useLingui();
    // The Color Mode on screen, which the theme provider above has resolved for Mantine.
    const mode = useComputedColorScheme("light");
    const stored = useSetting(store, APPEARANCE_SETTINGS.accent);
    const lightTheme = useSetting(store, APPEARANCE_SETTINGS.lightTheme);
    const darkTheme = useSetting(store, APPEARANCE_SETTINGS.darkTheme);
    const groupName = useId();

    const themeId = mode === "light" ? lightTheme : darkTheme;
    const theme = Object.hasOwn(catalog, themeId) ? catalog[themeId] : undefined;
    // Only read for a Color Mode the Theme has, as the engine does.
    const themeHasAccent = theme?.colors[mode] !== undefined && theme.accent?.[mode] !== undefined;
    // An unknown stored Accent means "From Theme" to the engine.
    const chosen = ACCENT_CHOICES.includes(stored) ? stored : FROM_THEME;
    // Each choice as the engine would resolve it, so that "From Theme" shows what it would give.
    const colors = useMemo(
      () =>
        new Map(
          ACCENT_CHOICES.map((accent) => [
            accent,
            resolveAppearance({ ...DEFAULT_APPEARANCE, lightTheme, darkTheme, accent }, catalog)[
              mode
            ].roles.accent,
          ]),
        ),
      [lightTheme, darkTheme, mode],
    );
    const choices = ACCENT_CHOICES.map((value) => ({
      value,
      disabled: value === FROM_THEME && !themeHasAccent,
    }));
    const tabStop = tabStopOf(choices, chosen);
    return (
      <Group aria-labelledby={labelledBy} gap={rem(4)} role="radiogroup">
        {choices.map(({ value, disabled }) => {
          const descriptor = ACCENT_NAMES[value];
          const name = descriptor ? i18n._(descriptor) : value;
          return (
            <Tooltip key={value} label={name}>
              <Radio.Card
                aria-label={name}
                checked={value === chosen}
                disabled={disabled}
                // `Radio.Card` moves the arrow keys over every card with the group's name, so a
                // card that cannot be chosen leaves the group for them.
                name={disabled ? `${groupName}-unavailable` : groupName}
                onClick={() => {
                  store.write(APPEARANCE_SETTINGS.accent, value);
                }}
                p={rem(2)}
                radius="xl"
                style={{
                  borderColor: value === chosen ? CHOSEN_BORDER : "transparent",
                  ...(disabled && { cursor: "not-allowed", opacity: 0.45 }),
                }}
                tabIndex={value === tabStop ? 0 : -1}
                w="auto"
              >
                <ColorSwatch
                  attributes={{ colorOverlay: { "data-color-role": "accent" } }}
                  c={roleColor("onAccent")}
                  color={colors.get(value) ?? "transparent"}
                  size={rem(SWATCH_SIZE)}
                  withShadow={false}
                >
                  {value === FROM_THEME && <ThemeColorsIcon aria-hidden size="xs" />}
                </ColorSwatch>
              </Radio.Card>
            </Tooltip>
          );
        })}
      </Group>
    );
  }

  return {
    id: "accent",
    view: VIEW_IDS.appearance,
    title: msg`Accent`,
    description: msg`The highlight color for buttons, active items and links. "From Theme" uses the color a Theme brings, if it brings one.`,
    searchWords: [msg`Highlight color`, msg`Color`],
    values: ACCENT_CHOICES.flatMap((accent) => ACCENT_NAMES[accent] ?? []),
    settings: [APPEARANCE_SETTINGS.accent],
    control: AccentControl,
  };
}
