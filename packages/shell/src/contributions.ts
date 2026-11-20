import type { PersonCommand, ShellCommand } from "./commands.ts";
import type { IndicatorForm } from "./module-indicator-form.ts";
import type { MessageDescriptor } from "@lingui/core";
import type { DataTexts } from "@self-engine/data-client/react";
import type { IconProps } from "@self-engine/icons";
import type { ColorSetName } from "@self-engine/theme";
import type { ComponentType } from "react";

/** What the page of a View is told. A page that belongs to one View needs none of it. */
export interface ViewPageProps {
  /** The id of the View on screen, for a page that several Views of a module share. */
  readonly viewId: string;
}

/** Router-independent, eagerly available metadata; View code only enters through load. */
export interface ShellView {
  readonly id: string;
  readonly title: MessageDescriptor;
  /**
   * The page of the View. Views that load the same component share one page: a change between
   * them keeps its state and only changes `viewId`.
   */
  readonly load: () => Promise<{ readonly default: ComponentType<ViewPageProps> }>;
}

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

/** What the content of an Edit Drawer is told: the ways out, and the entry it edits. */
export interface EditDrawerProps extends FrameExitProps {
  readonly id: string;
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
interface IndicatorWithoutPanel {
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

interface ContributionMetadata {
  readonly id: string;
  readonly name: MessageDescriptor;
  readonly icon: ComponentType<Pick<IconProps, "size">>;
  readonly color: ColorSetName;
  /** The first View is the module's default. */
  readonly views: readonly [ShellView, ...ShellView[]];
  readonly groups?: () => Promise<{ readonly default: ComponentType }>;
  readonly editDrawer?: () => Promise<{ readonly default: ComponentType<EditDrawerProps> }>;
  /** Shown while any module is active, in the order of the module list. */
  readonly indicator?: ModuleIndicator;
  readonly sharedSearch?: readonly string[];
  /**
   * The names of the module's synced tables and the texts of its rules' Reasons, made by
   * `dataTexts` of `@self-engine/data-client/react` against its storage module; `NO_DATA_TEXTS`
   * for a module without data. The app's module list mounts no module without them.
   */
  readonly dataTexts?: DataTexts;
}

/** Private state prevents object literals and spreads from forging checked membership. */
class ContributionAction {
  readonly #commands: readonly ShellCommand[];
  readonly #primaryAction: PersonCommand;
  constructor(commands: readonly ShellCommand[], primaryAction: PersonCommand) {
    if (!commands.includes(primaryAction)) {
      throw new Error("The primary action must reference one of the contribution's commands");
    }
    this.#commands = commands;
    this.#primaryAction = primaryAction;
  }
  get commands() {
    return this.#commands;
  }
  get primaryAction() {
    return this.#primaryAction;
  }
}

/** Actions can only enter the public contract through defineContribution. */
export type ShellContribution = ContributionMetadata &
  (
    | { readonly commands?: readonly ShellCommand[]; readonly primaryAction?: never }
    | ContributionAction
  );

type ContributionInput<Commands extends readonly ShellCommand[]> = ContributionMetadata & {
  readonly commands?: Commands;
  readonly primaryAction?: string extends Commands[number]["id"]
    ? never
    : NoInfer<Extract<Commands[number], PersonCommand>>;
};

/**
 * Infer command ids from commands alone, then check the direct main-action reference. A
 * contribution given its `dataTexts` keeps them in its type, which the app's module list asks for.
 */
export function defineContribution<
  const Commands extends readonly ShellCommand[],
  const Texts extends DataTexts,
>(
  contribution: ContributionInput<Commands> & { readonly dataTexts: Texts },
): ShellContribution & { readonly dataTexts: Texts };
export function defineContribution<const Commands extends readonly ShellCommand[] = readonly []>(
  contribution: ContributionInput<Commands>,
): ShellContribution;
export function defineContribution<const Commands extends readonly ShellCommand[]>(
  contribution: ContributionInput<Commands>,
): ShellContribution {
  // Read by name, as the first overload promises them: a rest copies own properties alone.
  const { commands, primaryAction, dataTexts, ...rest } = contribution;
  const metadata = dataTexts === undefined ? rest : { ...rest, dataTexts };
  if (primaryAction) {
    return Object.assign(new ContributionAction(commands ?? [], primaryAction), metadata);
  }
  return commands ? { ...metadata, commands } : metadata;
}

/** The address a View is shown at. */
export const viewPath = (moduleId: string, viewId: string) => `/${moduleId}/${viewId}`;

interface AddressContribution {
  readonly id: string;
  readonly views: readonly { readonly id: string }[];
  readonly commands?: readonly { readonly id: string }[] | undefined;
}

/** The prefix of the Shell's own Commands, so that their full ids stay free for it. */
export const RESERVED_MODULE_ID = "shell";

/** Checks the complete app registry, including Settings, before addresses are used. */
export function validateContributions(contributions: readonly AddressContribution[]): void {
  const checkIds = (entries: readonly { readonly id: string }[]) => {
    const ids = new Set<string>();
    for (const { id } of entries) {
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
        throw new Error(`Invalid or duplicate contribution id: ${id}`);
      }
      ids.add(id);
    }
  };
  checkIds(contributions);
  for (const contribution of contributions) {
    if (contribution.id === RESERVED_MODULE_ID) {
      throw new Error(`The module id ${RESERVED_MODULE_ID} is reserved for the Shell`);
    }
    if (contribution.views.length === 0) throw new Error(`Module ${contribution.id} needs a View`);
    checkIds(contribution.views);
    checkIds(contribution.commands ?? []);
  }
}
