// PROTOTYPE: themes as data with semantic roles (D61). Components only use the roles.
import type { MantineColorsTuple } from "@mantine/core";

export const ROLES = [
  "canvas",
  "chrome",
  "surface",
  "surfaceRaised",
  "text",
  "textMuted",
  "border",
  "hover",
] as const;
export type Role = (typeof ROLES)[number];
export type RoleColors = Record<Role, string>;

export type ThemeDef = {
  id: string;
  label: string;
  light: RoleColors;
  dark: RoleColors;
};

export const THEMES: ThemeDef[] = [
  {
    id: "neutral",
    label: "Neutral",
    light: {
      canvas: "#ffffff",
      chrome: "#f7f7f8",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      text: "#18181b",
      textMuted: "#71717a",
      border: "#e7e7ea",
      hover: "#eeeef0",
    },
    dark: {
      canvas: "#141416",
      chrome: "#0e0e10",
      surface: "#1a1a1d",
      surfaceRaised: "#202024",
      text: "#ededf0",
      textMuted: "#8b8b94",
      border: "#2a2a2f",
      hover: "#232327",
    },
  },
  {
    id: "warm",
    label: "Warm",
    light: {
      canvas: "#fdfcfa",
      chrome: "#f5f2ec",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      text: "#1f1b16",
      textMuted: "#7a7064",
      border: "#e8e2d8",
      hover: "#ece6dc",
    },
    dark: {
      canvas: "#171513",
      chrome: "#110f0d",
      surface: "#1d1a17",
      surfaceRaised: "#24201c",
      text: "#efe9e1",
      textMuted: "#958a7d",
      border: "#2f2a25",
      hover: "#28231f",
    },
  },
  {
    id: "cool",
    label: "Kühl",
    light: {
      canvas: "#fbfcfe",
      chrome: "#f1f4f9",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      text: "#111827",
      textMuted: "#64748b",
      border: "#e2e8f0",
      hover: "#e8edf5",
    },
    dark: {
      canvas: "#0f141c",
      chrome: "#0a0e14",
      surface: "#141b25",
      surfaceRaised: "#19212d",
      text: "#e6edf7",
      textMuted: "#8391a7",
      border: "#232d3b",
      hover: "#1b2431",
    },
  },
];

export const ACCENTS = ["indigo", "violet", "teal", "blue", "orange", "grape"] as const;
export type Accent = (typeof ACCENTS)[number];

export type ModuleId = "projects" | "time" | "finance" | "calendar" | "habits";

// One color per module, used sparingly (icon, active item, charts) (D58).
export const MODULE_COLORS: Record<ModuleId, string> = {
  projects: "blue",
  time: "teal",
  finance: "green",
  calendar: "orange",
  habits: "pink",
};

export type Density = "compact" | "comfortable";
export type ColorMode = "light" | "dark" | "auto";

export type Settings = {
  theme: string;
  accent: Accent;
  mode: ColorMode;
  fontScale: number;
  density: Density;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "neutral",
  accent: "indigo",
  mode: "auto",
  fontScale: 1,
  density: "comfortable",
};

export type { MantineColorsTuple };
