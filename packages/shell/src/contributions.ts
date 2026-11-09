import type { ViewSearch } from "./view-search.ts";
import type { MessageDescriptor } from "@lingui/core";
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
  readonly onClose: () => void;
}

/** The address capability available to loaded command code, without a router dependency. */
export interface CommandContext {
  readonly writeSearch: (update: (search: ViewSearch) => ViewSearch) => void;
}

export interface ShellCommand {
  readonly id: string;
  readonly label: MessageDescriptor;
  readonly defaultShortcut?: string;
  readonly load: () => Promise<{
    readonly default: (context: CommandContext) => void | Promise<void>;
  }>;
}

export interface ShellContribution {
  readonly id: string;
  readonly name: MessageDescriptor;
  readonly icon: ComponentType;
  readonly color: ColorSetId;
  /** The first View is the module's default. */
  readonly views: readonly [ShellView, ...ShellView[]];
  readonly commands?: readonly ShellCommand[];
  readonly primaryAction?: ShellCommand;
  readonly groups?: () => Promise<{ readonly default: ComponentType }>;
  readonly editDrawer?: () => Promise<{ readonly default: ComponentType<EditDrawerProps> }>;
  readonly sharedSearch?: readonly string[];
}

/** Infer command ids from commands alone, then check the direct main-action reference. */
export function defineContribution<const Commands extends readonly ShellCommand[] = readonly []>(
  contribution: Omit<ShellContribution, "commands" | "primaryAction"> & {
    readonly commands?: Commands;
    readonly primaryAction?: NoInfer<Commands[number]>;
  },
): ShellContribution {
  return contribution;
}

interface AddressContribution {
  readonly id: string;
  readonly views: readonly { readonly id: string }[];
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
  }
}
