// PROTOTYPE: three looks of the same shell (D55–D64), switchable via ?variant=.
import {
  type CSSVariablesResolver,
  MantineProvider,
  createTheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, ROLES, THEMES, type Settings, type ThemeDef } from "./themes";
import { Shell, type Variant } from "./shell/Shell";
import { PrototypeBar } from "./PrototypeBar";

const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "Flach (t3code-artig)" },
  { key: "B", name: "Schwebend (Inhalt als Karte)" },
  { key: "C", name: "Kompakt (Titelleiste oben)" },
];

function readVariant(): Variant {
  const v = new URLSearchParams(location.search).get("variant");
  return v === "B" || v === "C" ? v : "A";
}

const resolver: CSSVariablesResolver = (theme) => {
  const def = theme.other.def as ThemeDef;
  const toVars = (mode: "light" | "dark") =>
    Object.fromEntries(ROLES.map((r) => [`--se-${r}`, def[mode][r]]));
  return {
    variables: {},
    light: { ...toVars("light"), "--mantine-color-body": def.light.canvas },
    dark: { ...toVars("dark"), "--mantine-color-body": def.dark.canvas },
  };
};

function ColorModeSync({ mode }: { mode: Settings["mode"] }) {
  const { setColorScheme } = useMantineColorScheme();
  useEffect(() => setColorScheme(mode), [mode, setColorScheme]);
  return null;
}

export function App() {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const theme = useMemo(() => {
    const def = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0]!;
    return createTheme({
      primaryColor: settings.accent,
      defaultRadius: "md",
      fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
      other: { def },
    });
  }, [settings.theme, settings.accent]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * settings.fontScale}px`;
  }, [settings.fontScale]);

  const go = (v: Variant) => {
    const url = new URL(location.href);
    url.searchParams.set("variant", v);
    history.replaceState(null, "", url);
    setVariant(v);
  };

  return (
    <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme="auto">
      <ColorModeSync mode={settings.mode} />
      <div data-density={settings.density} style={{ height: "100%" }}>
        <Shell key={variant} variant={variant} accent={settings.accent} />
      </div>
      <PrototypeBar
        variants={VARIANTS}
        current={variant}
        onChange={go}
        settings={settings}
        onSettings={setSettings}
      />
    </MantineProvider>
  );
}
