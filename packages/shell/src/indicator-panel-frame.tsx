import { Component, lazy, type ReactNode, Suspense } from "react";
import type { IndicatorWithPanel, ShellContribution } from "./contributions.ts";

export interface IndicatorPanelFrameProps {
  readonly module: ShellContribution;
  readonly indicator: IndicatorWithPanel;
  /** On the phone the panel is a sheet from below, on every other Layout Step a popover. */
  readonly sheet: boolean;
  /** The indicator's place, which the popover hangs below and whose clicks are not outside. */
  readonly place: HTMLElement | null;
}

const LoadedFrame = lazy(() => import("./indicator-panel.tsx"));

/**
 * Without its frame the panel cannot open; the indicator beside it works on and shows its own
 * failures, so this one shows nothing.
 */
class WithoutFrameOnFailure extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The frame of a module's Indicator Panel, whose code loads when it is first rendered: the Shell
 * renders it in the idle moment after the first paint, beside the indicator, never at the start.
 */
export function IndicatorPanelFrame(props: IndicatorPanelFrameProps) {
  return (
    <WithoutFrameOnFailure>
      <Suspense fallback={null}>
        <LoadedFrame {...props} />
      </Suspense>
    </WithoutFrameOnFailure>
  );
}
