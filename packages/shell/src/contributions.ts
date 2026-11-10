import type { WriteViewSearch } from "./routing.tsx";
import type { MessageDescriptor } from "@lingui/core";
import type { IconProps } from "@self-engine/icons";
import type { ColorSetId } from "@self-engine/theme";
import type { ComponentType } from "react";

/** Router-independent, eagerly available metadata; View code only enters through load. */
export interface ShellView {
  readonly id: string;
  readonly title: MessageDescriptor;
  readonly load: () => Promise<{ readonly default: ComponentType }>;
}

export interface EditDrawerProps {
  readonly id: string;
  /** Asks first when `useUnsavedChanges` reports changes. */
  readonly onCancel: () => void;
  /** Closes without asking, after a successful save or delete. A failed save calls neither. */
  readonly onDone: () => void;
}

/** The address capability available to loaded command code, without a router dependency. */
export interface CommandContext {
  /** Writes to the page the command was started on, and does nothing once the user has left it. */
  readonly writeSearch: WriteViewSearch;
}

export interface ShellCommand {
  readonly id: string;
  readonly label: MessageDescriptor;
  readonly defaultShortcut?: string;
  readonly load: () => Promise<{
    readonly default: (context: CommandContext) => void | Promise<void>;
  }>;
}

interface ContributionMetadata {
  readonly id: string;
  readonly name: MessageDescriptor;
  readonly icon: ComponentType<Pick<IconProps, "size">>;
  readonly color: ColorSetId;
  /** The first View is the module's default. */
  readonly views: readonly [ShellView, ...ShellView[]];
  readonly groups?: () => Promise<{ readonly default: ComponentType }>;
  readonly editDrawer?: () => Promise<{ readonly default: ComponentType<EditDrawerProps> }>;
  readonly sharedSearch?: readonly string[];
}

/** Private state prevents object literals and spreads from forging checked membership. */
class ContributionAction {
  readonly #commands: readonly ShellCommand[];
  readonly #primaryAction: ShellCommand;
  constructor(commands: readonly ShellCommand[], primaryAction: ShellCommand) {
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
      : NoInfer<Commands[number]>;
  },
): ShellContribution {
  const { commands, primaryAction, ...metadata } = contribution;
  if (primaryAction) {
    return Object.assign(new ContributionAction(commands ?? [], primaryAction), metadata);
  }
  return commands ? { ...metadata, commands } : metadata;
}

interface AddressContribution {
  readonly id: string;
  readonly views: readonly { readonly id: string }[];
  readonly commands?: readonly { readonly id: string }[] | undefined;
}

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
    if (contribution.views.length === 0) throw new Error(`Module ${contribution.id} needs a View`);
    checkIds(contribution.views);
    checkIds(contribution.commands ?? []);
  }
}
