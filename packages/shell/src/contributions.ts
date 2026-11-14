import type { PersonCommand, ShellCommand } from "./commands.ts";
import type { MessageDescriptor } from "@lingui/core";
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

export interface EditDrawerProps {
  readonly id: string;
  /** Asks first when `useUnsavedChanges` reports changes. */
  readonly onCancel: () => void;
  /**
   * Closes without asking, after a successful save or delete. A failed save calls neither. Called
   * after the person left this entry, it closes nothing.
   */
  readonly onDone: () => void;
}

interface ContributionMetadata {
  readonly id: string;
  readonly name: MessageDescriptor;
  readonly icon: ComponentType<Pick<IconProps, "size">>;
  readonly color: ColorSetName;
  /** The first View is the module's default. */
  readonly views: readonly [ShellView, ...ShellView[]];
  readonly groups?: () => Promise<{ readonly default: ComponentType }>;
  readonly editDrawer?: () => Promise<{ readonly default: ComponentType<EditDrawerProps> }>;
  readonly sharedSearch?: readonly string[];
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

/** Infer command ids from commands alone, then check the direct main-action reference. */
export function defineContribution<const Commands extends readonly ShellCommand[] = readonly []>(
  contribution: ContributionMetadata & {
    readonly commands?: Commands;
    readonly primaryAction?: string extends Commands[number]["id"]
      ? never
      : NoInfer<Extract<Commands[number], PersonCommand>>;
  },
): ShellContribution {
  const { commands, primaryAction, ...metadata } = contribution;
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
