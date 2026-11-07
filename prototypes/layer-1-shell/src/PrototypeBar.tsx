// PROTOTYPE: floating switcher, deliberately not part of the design being judged.
import {
  ActionIcon,
  ColorSwatch,
  Group,
  Popover,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { IconAdjustments, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect } from "react";
import { ACCENTS, THEMES, type Settings } from "./themes";
import type { Variant } from "./shell/Shell";

type Props = {
  variants: { key: Variant; name: string }[];
  current: Variant;
  onChange: (v: Variant) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
};

export function PrototypeBar({ variants, current, onChange, settings, onSettings }: Props) {
  const theme = useMantineTheme();
  const idx = variants.findIndex((v) => v.key === current);
  const step = (d: number) => onChange(variants[(idx + d + variants.length) % variants.length]!.key);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#111",
        color: "#fff",
        borderRadius: 999,
        padding: "6px 8px",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        border: "2px dashed #f5c518",
      }}
    >
      <Group gap={6} wrap="nowrap">
        <ActionIcon variant="subtle" color="gray.0" radius="xl" onClick={() => step(-1)}>
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Text size="sm" fw={600} style={{ minWidth: 230, textAlign: "center" }}>
          {current} · {variants[idx]?.name}
        </Text>
        <ActionIcon variant="subtle" color="gray.0" radius="xl" onClick={() => step(1)}>
          <IconChevronRight size={18} />
        </ActionIcon>
        <Popover position="top" width={300} withArrow shadow="lg">
          <Popover.Target>
            <ActionIcon variant="filled" color="yellow" c="dark" radius="xl" title="Theme & Einstellungen">
              <IconAdjustments size={18} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Modus
              </Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={settings.mode}
                onChange={(v) => set("mode", v as Settings["mode"])}
                data={[
                  { value: "light", label: "Hell" },
                  { value: "dark", label: "Dunkel" },
                  { value: "auto", label: "System" },
                ]}
              />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Theme
              </Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={settings.theme}
                onChange={(v) => set("theme", v)}
                data={THEMES.map((t) => ({ value: t.id, label: t.label }))}
              />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Akzentfarbe
              </Text>
              <Group gap={8}>
                {ACCENTS.map((a) => (
                  <ColorSwatch
                    key={a}
                    component="button"
                    color={theme.colors[a]![6]!}
                    onClick={() => set("accent", a)}
                    style={{
                      cursor: "pointer",
                      outline: settings.accent === a ? "2px solid var(--se-text)" : "none",
                      outlineOffset: 2,
                    }}
                    title={a}
                  />
                ))}
              </Group>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Dichte
              </Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={settings.density}
                onChange={(v) => set("density", v as Settings["density"])}
                data={[
                  { value: "compact", label: "Kompakt" },
                  { value: "comfortable", label: "Bequem" },
                ]}
              />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Schriftgröße {Math.round(settings.fontScale * 100)} %
              </Text>
              <Slider
                min={0.875}
                max={1.125}
                step={0.0625}
                value={settings.fontScale}
                onChange={(v) => set("fontScale", v)}
                label={null}
              />
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </div>
  );
}
