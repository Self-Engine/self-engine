// PROTOTYPE: the app shell (D55, D56, D59, D60). One component, three looks via `variant`.
import { ActionIcon, Badge, Burger, Button, Drawer, Kbd, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useHotkeys, useViewportSize } from "@mantine/hooks";
import { Spotlight, spotlight, type SpotlightActionData } from "@mantine/spotlight";
import {
  IconLayoutSidebarRightExpand,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { MODULES, rowsFor, type ModuleDef, type Row } from "../data";
import { MODULE_COLORS, type Accent, type ModuleId } from "../themes";
import { Assistant } from "./Assistant";
import { EditDrawer } from "./EditDrawer";
import classes from "./shell.module.css";

export type Variant = "A" | "B" | "C";

const ICON_W = 60;
const MIN_WIDE = 168;
const MAX_W = 280;

type Step = "wide" | "medium" | "narrow" | "phone";
function stepFor(w: number): Step {
  if (w >= 1100) return "wide";
  if (w >= 820) return "medium";
  if (w >= 560) return "narrow";
  return "phone";
}

const mc = (id: ModuleId) => `var(--mantine-color-${MODULE_COLORS[id]}-6)`;

function TrafficLights() {
  return (
    <div className={classes.traffic}>
      <span style={{ background: "#ff5f57" }} />
      <span style={{ background: "#febc2e" }} />
      <span style={{ background: "#28c840" }} />
    </div>
  );
}

function Navbar(props: {
  width: number;
  collapsed: boolean;
  active: ModuleId;
  onSelect: (id: ModuleId) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onToggle: () => void;
  showTraffic: boolean;
  resizable: boolean;
}) {
  const { collapsed } = props;
  return (
    <nav className={classes.navbar} style={{ width: props.width }} data-collapsed={collapsed || undefined}>
      {props.showTraffic && <TrafficLights />}
      {!collapsed && (
        <Text className={classes.brand} fw={700} size="sm">
          Self-Engine
        </Text>
      )}
      <div className={classes.navList}>
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = m.id === props.active;
          const btn = (
            <UnstyledButton
              key={m.id}
              className={classes.navItem}
              data-active={isActive || undefined}
              onClick={() => props.onSelect(m.id)}
              style={{ "--module-color": mc(m.id) } as CSSProperties}
            >
              <Icon size={20} stroke={1.7} className={classes.navIcon} />
              {!collapsed && <span>{m.label}</span>}
            </UnstyledButton>
          );
          return collapsed ? (
            <Tooltip key={m.id} label={m.label} position="right" withArrow>
              {btn}
            </Tooltip>
          ) : (
            btn
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <UnstyledButton className={classes.navItem}>
        <IconSettings size={20} stroke={1.7} className={classes.navIcon} />
        {!collapsed && <span>Einstellungen</span>}
      </UnstyledButton>
      {props.resizable && (
        <div
          className={classes.resizer}
          onPointerDown={props.onResizeStart}
          onDoubleClick={props.onToggle}
          title="Ziehen zum Ändern der Breite, Doppelklick klappt ein/aus"
        />
      )}
    </nav>
  );
}

function ModuleSidebar({ mod, showTraffic }: { mod: ModuleDef; showTraffic: boolean }) {
  const [sel, setSel] = useState(mod.sections[0]!.items[0]);
  useEffect(() => setSel(mod.sections[0]!.items[0]), [mod]);
  return (
    <div className={classes.sidebar} style={{ "--module-color": mc(mod.id) } as CSSProperties}>
      {showTraffic && <TrafficLights />}
      <div className={classes.sidebarTitle}>
        <span className={classes.moduleDot} />
        <Text fw={600} size="sm">
          {mod.label}
        </Text>
      </div>
      <Button
        leftSection={<IconPlus size={16} />}
        variant="light"
        size="xs"
        fullWidth
        justify="flex-start"
        mb="sm"
      >
        {mod.primaryAction}
      </Button>
      {mod.sections.map((s) => (
        <div key={s.label} className={classes.section}>
          <Text className={classes.sectionLabel}>{s.label}</Text>
          {s.items.map((it) => (
            <UnstyledButton
              key={it}
              className={classes.sideItem}
              data-active={sel === it || undefined}
              onClick={() => setSel(it)}
            >
              {it}
            </UnstyledButton>
          ))}
        </div>
      ))}
    </div>
  );
}

function Content({ mod, rows, onOpen }: { mod: ModuleDef; rows: Row[]; onOpen: (r: Row) => void }) {
  return (
    <div className={classes.content}>
      <div className={classes.stats}>
        {["Diese Woche", "Dieser Monat", "Offen"].map((l, i) => (
          <div key={l} className={classes.stat}>
            <Text size="xs" c="var(--se-textMuted)">
              {l}
            </Text>
            <Text fw={700} size="xl">
              {["38,5 h", "142 h", "3.420 €"][i]}
            </Text>
          </div>
        ))}
      </div>
      <div className={classes.list}>
        {rows.map((r) => (
          <UnstyledButton key={r.id} className={classes.row} onClick={() => onOpen(r)}>
            <span className={classes.rowMark} style={{ background: mc(mod.id) }} />
            <span className={classes.rowTitle}>{r.title}</span>
            <span className={classes.rowMeta}>{r.meta}</span>
            <Badge variant="light" size="sm" className={classes.rowBadge}>
              {r.status}
            </Badge>
            <span className={classes.rowAmount}>{r.amount}</span>
          </UnstyledButton>
        ))}
      </div>
      <Text size="xs" c="var(--se-textMuted)" mt="md">
        Zeile anklicken öffnet den Bearbeiten-Drawer.
      </Text>
    </div>
  );
}

export function Shell({ variant, accent }: { variant: Variant; accent: Accent }) {
  const { width: vw } = useViewportSize();
  const step = stepFor(vw || 1400);
  const [active, setActive] = useState<ModuleId>("projects");
  const [navW, setNavW] = useState(220);
  const [assistant, setAssistant] = useState(false);
  const [sidebarDrawer, setSidebarDrawer] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const drag = useRef<{ x: number; w: number } | null>(null);

  const mod = MODULES.find((m) => m.id === active)!;
  const list = rows[active] ?? rowsFor(active);

  const forcedIcons = step !== "wide";
  const collapsed = forcedIcons || navW < MIN_WIDE;
  const effNavW = collapsed ? ICON_W : navW;
  const sidebarInline = step === "wide" || step === "medium";
  const showNavbar = step !== "phone";

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      drag.current = { x: e.clientX, w: effNavW };
      const move = (ev: PointerEvent) => {
        if (!drag.current) return;
        const w = drag.current.w + ev.clientX - drag.current.x;
        setNavW(w < (ICON_W + MIN_WIDE) / 2 ? ICON_W : Math.min(MAX_W, Math.max(MIN_WIDE, w)));
      };
      const up = () => {
        drag.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [effNavW],
  );

  useHotkeys([["mod+J", () => setAssistant((a) => !a)]]);

  const actions: SpotlightActionData[] = [
    ...MODULES.map((m) => ({
      id: `go-${m.id}`,
      label: `Gehe zu ${m.label}`,
      leftSection: <m.icon size={18} color={mc(m.id)} />,
      onClick: () => setActive(m.id),
    })),
    ...MODULES.map((m) => ({
      id: `new-${m.id}`,
      label: m.primaryAction,
      description: m.label,
      leftSection: <IconPlus size={18} />,
    })),
    {
      id: "assistant",
      label: "Assistent ein/aus",
      leftSection: <IconSparkles size={18} />,
      onClick: () => setAssistant((a) => !a),
    },
  ];

  const header = (
    <header className={classes.header}>
      {!sidebarInline && <Burger size="sm" opened={sidebarDrawer} onClick={() => setSidebarDrawer(true)} />}
      <div>
        <Text size="xs" c="var(--se-textMuted)">
          {mod.label}
        </Text>
        <Text fw={650} size="lg" lh={1.2}>
          {mod.sections[0]!.items[0]}
        </Text>
      </div>
      <div style={{ flex: 1 }} />
      {variant !== "C" && (
        <Button
          variant="default"
          size="xs"
          leftSection={<IconSearch size={14} />}
          rightSection={<Kbd size="xs">⌘K</Kbd>}
          onClick={() => spotlight.open()}
          className={classes.searchBtn}
        >
          Suchen
        </Button>
      )}
      <Tooltip label="Assistent (⌘J)">
        <ActionIcon variant={assistant ? "light" : "subtle"} color={assistant ? accent : "gray"} onClick={() => setAssistant((a) => !a)}>
          <IconLayoutSidebarRightExpand size={18} />
        </ActionIcon>
      </Tooltip>
    </header>
  );

  // Traffic lights sit in the first visible column, or in the top bar for C.
  const trafficInNav = variant !== "C" && showNavbar;

  return (
    <div className={classes.root} data-variant={variant} data-step={step}>
      {variant === "C" && (
        <div className={classes.topbar}>
          <TrafficLights />
          <Text size="xs" fw={600} c="var(--se-textMuted)">
            Self-Engine · {mod.label}
          </Text>
          <div style={{ flex: 1 }} />
          <UnstyledButton className={classes.topSearch} onClick={() => spotlight.open()}>
            <IconSearch size={14} />
            <span>Suchen oder Befehl…</span>
            <Kbd size="xs">⌘K</Kbd>
          </UnstyledButton>
          <div style={{ flex: 1 }} />
          <IconSparkles size={16} style={{ opacity: 0.6 }} />
        </div>
      )}
      <div className={classes.body}>
        {showNavbar && (
          <Navbar
            width={effNavW}
            collapsed={collapsed}
            active={active}
            onSelect={setActive}
            onResizeStart={onResizeStart}
            onToggle={() => setNavW((w) => (w < MIN_WIDE ? 220 : ICON_W))}
            showTraffic={trafficInNav}
            resizable={!forcedIcons}
          />
        )}
        {sidebarInline && <ModuleSidebar mod={mod} showTraffic={false} />}
        <main className={classes.main}>
          {header}
          <Content mod={mod} rows={list} onOpen={setEditing} />
        </main>
        {assistant && step !== "phone" && step !== "narrow" && <Assistant onClose={() => setAssistant(false)} />}
      </div>
      {step === "phone" && (
        <nav className={classes.bottomBar}>
          {MODULES.map((m) => (
            <UnstyledButton
              key={m.id}
              className={classes.bottomItem}
              data-active={m.id === active || undefined}
              onClick={() => setActive(m.id)}
              style={{ "--module-color": mc(m.id) } as CSSProperties}
            >
              <m.icon size={20} stroke={1.7} />
              <span>{m.label}</span>
            </UnstyledButton>
          ))}
        </nav>
      )}

      <Drawer
        opened={!sidebarInline && sidebarDrawer}
        onClose={() => setSidebarDrawer(false)}
        position="left"
        size={260}
        withCloseButton={false}
        styles={{ body: { padding: 0, height: "100%" }, content: { background: "var(--se-chrome)" } }}
      >
        <ModuleSidebar mod={mod} showTraffic={false} />
      </Drawer>
      <Drawer
        opened={assistant && (step === "phone" || step === "narrow")}
        onClose={() => setAssistant(false)}
        position="right"
        size={360}
        withCloseButton={false}
        styles={{ body: { padding: 0, height: "100%" } }}
      >
        <Assistant onClose={() => setAssistant(false)} />
      </Drawer>

      <EditDrawer
        row={editing}
        moduleLabel={mod.label}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          setRows((all) => ({ ...all, [active]: list.map((x) => (x.id === r.id ? r : x)) }));
          setEditing(null);
        }}
      />
      <Spotlight
        actions={actions}
        shortcut="mod + K"
        nothingFound="Nichts gefunden"
        searchProps={{ leftSection: <IconSearch size={18} />, placeholder: "Suchen oder Befehl…" }}
      />
    </div>
  );
}
