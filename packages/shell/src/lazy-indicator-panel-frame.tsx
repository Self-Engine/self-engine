import { type ComponentType, useEffect, useState } from "react";
import type { IndicatorPanelFrameProps } from "./indicator-panel.tsx";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";

type LoadFrame = () => Promise<{ readonly default: ComponentType<IndicatorPanelFrameProps> }>;

const loadFrame: LoadFrame = () => import("./indicator-panel.tsx");

const loadedFrames = lazyComponents<IndicatorPanelFrameProps>();

/**
 * Without its frame the panel cannot open, so a failed load shows nothing: the indicator beside
 * it works on and shows its own failures. The next opening of the panel loads the frame again.
 */
function RetryOnOpening({
  moduleId,
  retry,
}: {
  readonly moduleId: string;
  readonly retry: () => void;
}) {
  const panels = useIndicatorPanels();
  const opening = useOpeningOf(moduleId);
  const [failedDuring] = useState(opening);
  // An opening the frame failed to show closes, so the next click opens again.
  useEffect(() => {
    if (failedDuring !== undefined) panels.finish(failedDuring);
  }, [panels, failedDuring]);
  // Only a new opening: one that failed again waits for the next.
  useEffect(() => {
    if (opening !== undefined && opening !== failedDuring) retry();
  }, [opening, failedDuring, retry]);
  return null;
}

/** The frame's loader, with the load a story can hold back or fail. */
export function IndicatorPanelFrameLoader({
  load,
  ...props
}: IndicatorPanelFrameProps & { readonly load: LoadFrame }) {
  return (
    <LazyContribution
      components={loadedFrames}
      load={load}
      props={props}
      renderFailure={(retry) => <RetryOnOpening moduleId={props.module.id} retry={retry} />}
    />
  );
}

/**
 * The frame of a module's Indicator Panel, whose code loads when it is first rendered: the Shell
 * renders it in the idle moment after the first paint, beside the indicator, never at the start.
 * A failed load is forgotten, as a module's code is, so a later opening tries again.
 */
export function LazyIndicatorPanelFrame(props: IndicatorPanelFrameProps) {
  return <IndicatorPanelFrameLoader load={loadFrame} {...props} />;
}
