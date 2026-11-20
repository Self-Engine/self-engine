import { Component, lazy, type ReactNode, Suspense } from "react";
import type { IndicatorPanelFrameProps } from "./indicator-panel.tsx";

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
