import { useLingui } from "@lingui/react/macro";
import { ActionIcon, Box, Group, rem, Tooltip } from "@mantine/core";
import { colorSetColor, roleColor } from "@self-engine/theme";
import { NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import { type CSSProperties, type ReactNode, useCallback, useState } from "react";
import type { ModuleWithIndicator, ShellContribution } from "./contributions.ts";
import type {
  IndicatorWithPanel,
  ModuleIndicatorProps,
  ModuleIndicatorWithPanelProps,
} from "./module-indicator.ts";
import { useAfterFirstIdle } from "./idle.ts";
import { LazyIndicatorPanelFrame } from "./lazy-indicator-panel-frame.tsx";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
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

function FailedIndicator({
  module,
  onRetry,
}: {
  readonly module: ShellContribution;
  readonly onRetry: () => void;
}) {
  const { i18n, t } = useLingui();
  const name = i18n._(module.name);
  const label = t`${name} indicator failed. Try again.`;
  const Icon = module.icon;
  return (
    <Tooltip events={{ hover: true, focus: true, touch: false }} label={label}>
      <ActionIcon
        aria-label={label}
        bg={roleColor("warningSoft")}
        c={roleColor("warningText")}
        onClick={onRetry}
        size={24}
      >
        <Icon size="md" />
      </ActionIcon>
    </Tooltip>
  );
}

const declaresAPanel = (
  module: ModuleWithIndicator,
): module is ModuleWithIndicator<IndicatorWithPanel> => module.indicator.panel !== undefined;

interface CodeProps {
  readonly form: IndicatorForm;
  readonly panelAsSheet: boolean;
  /** The module's icon, which holds the place until the indicator's code has arrived. */
  readonly icon: ReactNode;
  readonly place: HTMLElement | null;
}

/**
 * An indicator with a panel, and the panel's frame. Only such a place draws again when its panel
 * opens or closes, and only on its own panel's.
 */
function IndicatorWithItsPanel({
  module,
  form,
  panelAsSheet,
  icon,
  place,
}: CodeProps & { readonly module: ModuleWithIndicator<IndicatorWithPanel> }) {
  const panels = useIndicatorPanels();
  const togglePanel = useCallback(() => panels.toggle(module.id), [panels, module.id]);
  const panelOpen = useOpeningOf(module.id) !== undefined;
  const [indicatorShown, setIndicatorShown] = useState(false);
  const markShown = useCallback(() => setIndicatorShown(true), []);
  return (
    <>
      <LazyContribution
        components={loadedIndicatorsWithPanel}
        fallback={icon}
        load={module.indicator.load}
        onShown={markShown}
        props={{ form, togglePanel, panelOpen }}
        renderFailure={(retry) => <FailedIndicator module={module} onRetry={retry} />}
      />
      <LazyIndicatorPanelFrame
        indicatorShown={indicatorShown}
        module={module}
        place={place}
        sheet={panelAsSheet}
      />
    </>
  );
}

interface PlaceProps {
  readonly module: ModuleWithIndicator;
  readonly form: IndicatorForm;
  readonly codeWanted: boolean;
  readonly panelAsSheet: boolean;
}

/** One module's place: its icon until the indicator's code has arrived, then the indicator. */
function IndicatorPlace({ module, form, codeWanted, panelAsSheet }: PlaceProps) {
  const { i18n } = useLingui();
  const [place, setPlace] = useState<HTMLDivElement | null>(null);
  const Icon = module.icon;
  const icon = (
    <Box aria-label={i18n._(module.name)} role="img" style={ICON_STYLE}>
      <Icon size="md" />
    </Box>
  );
  const code = declaresAPanel(module) ? (
    <IndicatorWithItsPanel
      form={form}
      icon={icon}
      module={module}
      panelAsSheet={panelAsSheet}
      place={place}
    />
  ) : (
    <LazyContribution
      components={loadedIndicators}
      fallback={icon}
      load={module.indicator.load}
      props={{ form }}
      renderFailure={(retry) => <FailedIndicator module={module} onRetry={retry} />}
    />
  );
  return (
    <Box
      data-color-set={module.color}
      ref={setPlace}
      style={{ ...PLACE_STYLE, maxWidth: rem(INDICATOR_MAX_WIDTH[form]) }}
    >
      {codeWanted ? code : icon}
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

const declaresAnIndicator = (module: ShellContribution): module is ModuleWithIndicator =>
  module.indicator !== undefined;

/**
 * The Module Indicators at the end of the content header. Their code loads in the first idle
 * moment after the first paint, so it costs the start nothing; the Shell passes them no data.
 */
export function ModuleIndicators({ modules, form, panelAsSheet }: ModuleIndicatorsProps) {
  const codeWanted = useAfterFirstIdle();
  const places = modules.filter(declaresAnIndicator);
  if (places.length === 0) return null;
  return (
    <Group flex="none" gap="xs" wrap="nowrap">
      {places.map((module) => (
        <IndicatorPlace
          codeWanted={codeWanted}
          form={form}
          key={module.id}
          module={module}
          panelAsSheet={panelAsSheet}
        />
      ))}
    </Group>
  );
}
