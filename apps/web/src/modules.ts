import { msg } from "@lingui/core/macro";
import { SettingsIcon } from "@self-engine/icons";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { type ShellContribution, validateContributions } from "@self-engine/shell";

export const modules: readonly ShellContribution[] = [beta];

// #23 replaces these two temporary sections.
export const settings = {
  id: "settings",
  name: msg`Settings`,
  icon: SettingsIcon,
  color: "grape",
  views: [
    { id: "theme-preview", title: msg`Theme preview`, load: () => import("./theme-preview.tsx") },
    {
      id: "language-sample",
      title: msg`Language sample`,
      load: () => import("./language-sample.tsx"),
    },
  ],
} satisfies ShellContribution;

export const contributions = [...modules, settings];
validateContributions(contributions);

export function findModule(id: string) {
  return contributions.find((module) => module.id === id);
}
export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}
