import type { MessageDescriptor } from "@lingui/core";
import type { ColorSetId } from "@self-engine/theme";
import type { ComponentType } from "react";

/** Router-independent, eagerly available metadata; View code only enters through load. */
export interface ShellView {
  readonly id: string;
  readonly title: MessageDescriptor;
  readonly load: () => Promise<{ readonly default: ComponentType }>;
}

export interface ShellContribution {
  readonly id: string;
  readonly name: MessageDescriptor;
  readonly icon: ComponentType;
  readonly color: ColorSetId;
  /** The first View is the module's default. */
  readonly views: readonly [ShellView, ...ShellView[]];
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
