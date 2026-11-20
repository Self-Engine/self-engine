import { useLingui } from "@lingui/react/macro";
import { Box, Group, rem } from "@mantine/core";
import { colorSetColor } from "@self-engine/theme";
import { NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import { type CSSProperties, useCallback, useState } from "react";
import type {
  ModuleIndicator,
  ModuleIndicatorProps,
  ModuleIndicatorWithPanelProps,
  ShellContribution,
} from "./contributions.ts";
import { useAfterFirstIdle } from "./idle.ts";
import { IndicatorPanelFrame } from "./indicator-panel-frame.tsx";
import { useIndicatorPanels } from "./indicator-panels.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";
import type { IndicatorForm } from "./module-indicator-form.ts";

/** The height of a place, below the content header's own, so no indicator can make it taller. */
const PLACE_HEIGHT = 32;

/**
 * The widest a form may be, in unscaled pixels. Chosen for the timer: a project title, a running
 * time with hours and a button in the full form; the time and the button in the short one.
 */
export const INDICATOR_MAX_WIDTH: Readonly<Record<IndicatorForm, number>> = {
  full: 260,
  short: 120,
};

// Its own width and no more: the page title beside it shrinks first.
const PLACE_STYLE: CSSProperties = {
  ...NOT_WINDOW_DRAG_STYLE,
  alignItems: "center",
  backgroundColor: colorSetColor("accentSoft"),
  borderRadius: "var(--mantine-radius-md)",
  color: colorSetColor("accentText"),
  display: "flex",
  flex: "none",
  height: rem(PLACE_HEIGHT),
  overflow: "hidden",
  // For the Indicator Panel, which hangs below the whole place.
  position: "relative",
  paddingInline: "var(--mantine-spacing-xs)",
};

const ICON_STYLE: CSSProperties = { display: "flex" };

const loadedIndicators = lazyComponents<ModuleIndicatorProps>();
const loadedIndicatorsWithPanel = lazyComponents<ModuleIndicatorWithPanelProps>();

interface PlaceProps {
  readonly module: ShellContribution;
  readonly indicator: ModuleIndicator;
  readonly form: IndicatorForm;
  readonly codeWanted: boolean;
  readonly panelAsSheet: boolean;
}

/** One module's place: its icon until the indicator's code has arrived, then the indicator. */
function IndicatorPlace({ module, indicator, form, codeWanted, panelAsSheet }: PlaceProps) {
  const { i18n } = useLingui();
  const panels = useIndicatorPanels();
  const togglePanel = useCallback(() => panels.toggle(module.id), [panels, module.id]);
  const [placeNode, setPlaceNode] = useState<HTMLDivElement | null>(null);
  const Icon = module.icon;
  const icon = (
    <Box aria-label={i18n._(module.name)} role="img" style={ICON_STYLE}>
      <Icon size="md" />
    </Box>
  );
  const code =
    indicator.panel === undefined ? (
      <LazyContribution
        components={loadedIndicators}
        fallback={icon}
        load={indicator.load}
        props={{ form }}
      />
    ) : (
      <LazyContribution
        components={loadedIndicatorsWithPanel}
        fallback={icon}
        load={indicator.load}
        props={{ form, togglePanel }}
      />
    );
  return (
    <Box
      data-color-set={module.color}
      ref={setPlaceNode}
      style={{ ...PLACE_STYLE, maxWidth: rem(INDICATOR_MAX_WIDTH[form]) }}
    >
      {codeWanted ? code : icon}
      {codeWanted && indicator.panel !== undefined && (
        <IndicatorPanelFrame
          indicator={indicator}
          module={module}
          place={placeNode}
          sheet={panelAsSheet}
        />
      )}
    </Box>
  );
}

interface ModuleIndicatorsProps {
  /** In the order of the module list. */
  readonly modules: readonly ShellContribution[];
  readonly form: IndicatorForm;
  /** On the phone an Indicator Panel is a sheet from below, on every other step a popover. */
  readonly panelAsSheet: boolean;
}

/**
 * The Module Indicators at the end of the content header. Their code loads in the first idle
 * moment after the first paint, so it costs the start nothing; the Shell passes them no data.
 */
export function ModuleIndicators({ modules, form, panelAsSheet }: ModuleIndicatorsProps) {
  const codeWanted = useAfterFirstIdle();
  const places = modules.flatMap((module) =>
    module.indicator ? [{ module, indicator: module.indicator }] : [],
  );
  if (places.length === 0) return null;
  return (
    <Group flex="none" gap="xs" wrap="nowrap">
      {places.map(({ module, indicator }) => (
        <IndicatorPlace
          codeWanted={codeWanted}
          form={form}
          indicator={indicator}
          key={module.id}
          module={module}
          panelAsSheet={panelAsSheet}
        />
      ))}
    </Group>
  );
}
