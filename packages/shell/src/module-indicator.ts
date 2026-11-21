// The contract of a Module Indicator and its Indicator Panel, and the ways out the Shell hands the
// content of a frame it owns. Apart from the Shell Contribution, so a Command can name it too.

import type { IndicatorForm } from "./module-indicator-form.ts";
import type { ComponentType } from "react";

/**
 * The ways out the Shell hands the content of a frame it owns, the Edit Drawer's and the
 * Indicator Panel's alike, so a form built for one works in the other.
 */
export interface FrameExitProps {
  /** Asks first when `useUnsavedChanges` reports changes. */
  readonly onCancel: () => void;
  /**
   * Closes without asking, after a successful save or named Operation. A failed one calls
   * neither. Called after the person left this opening, it closes nothing.
   */
  readonly onDone: () => void;
  /**
   * The question of `onCancel` without the closing, for a named Operation that leaves the content
   * and keeps it, such as "Archive": it asks when `useUnsavedChanges` reports changes. True when
   * nothing is unsaved or the person discards; then run the Operation and call `onDone`.
   */
  readonly confirmDiscard: () => Promise<boolean>;
  /**
   * Whether the frame still has this opening open, read when asked: false from the moment the
   * person leaves it, also while the frame slides out, and once another opening took its place.
   * For an action that can outlive the frame, such as one in a Notice.
   */
  readonly isOpen: () => boolean;
}

/**
 * What the content of an Indicator Panel is told: what an Edit Drawer's content is told, without
 * an entry. Which part it shows is its module's own state.
 */
export type IndicatorPanelProps = FrameExitProps;

/** What a Module Indicator is told. Its data it reads itself, through its module's hooks. */
export interface ModuleIndicatorProps {
  /** Which form to show, which the Shell derives from the Layout Step. */
  readonly form: IndicatorForm;
}

/** What a Module Indicator that declared an Indicator Panel is told. */
export interface ModuleIndicatorWithPanelProps extends ModuleIndicatorProps {
  /**
   * Opens the module's Indicator Panel; while it is open, closes it, as a second click on the
   * indicator does. Stable, so an indicator may hand it on without redrawing.
   */
  readonly togglePanel: () => void;
  /**
   * Whether the module's panel is open, for the control that opens it to say so, such as with
   * `aria-expanded`. Changes only when this panel opens or closes.
   */
  readonly panelOpen: boolean;
}

/**
 * The small element of a module at the end of the content header, on every page. Its code lives
 * in the module's `src/indicator/` folder, which the startup check keeps out of the start: the
 * Shell loads it in an idle moment after the first paint and shows the module's icon until then.
 */
export interface IndicatorWithoutPanel {
  readonly load: () => Promise<{ readonly default: ComponentType<ModuleIndicatorProps> }>;
  readonly panel?: never;
}

/**
 * An indicator with an Indicator Panel, whose content its module fills and whose frame, focus and
 * ways out belong to the Shell. Only this arm hands the indicator `togglePanel`, and the panel
 * exists only inside the indicator's entry. The panel's code lives in `src/indicator/` as well: it
 * loads at the first opening, and the Shell preloads it in an idle moment once the indicator came.
 */
export interface IndicatorWithPanel {
  readonly load: () => Promise<{ readonly default: ComponentType<ModuleIndicatorWithPanelProps> }>;
  readonly panel: () => Promise<{ readonly default: ComponentType<IndicatorPanelProps> }>;
}

export type ModuleIndicator = IndicatorWithoutPanel | IndicatorWithPanel;

/**
 * The Shell's function that opens a module's Indicator Panel from elsewhere, such as from a
 * Command or the action of a Notice. It takes the module's indicator entry, so an indicator
 * without a panel does not compile. An open panel is left first, through the question when it
 * holds unsaved changes. Which part the panel shows is the module's own state.
 */
export type OpenIndicatorPanel = (indicator: IndicatorWithPanel) => void;
