import type { MessageDescriptor } from "@lingui/core";
import type { SettingsStore } from "@self-engine/settings";
import type { ComponentType } from "react";
import type { LocalText, RowText } from "./text.ts";

export interface SettingsRowControlProps {
  readonly store: SettingsStore;
  /** The id of the element that shows the row's title, which names the control. */
  readonly labelledBy: string;
}

/** A heading that rows of one View share. */
export interface SettingsRowGroup {
  /**
   * What tells the group apart within its View, such as the id of a module. Not the heading: two
   * groups may be named alike, and a heading reads differently in every language.
   */
  readonly key: string;
  readonly heading: MessageDescriptor;
}

/**
 * One visible line of the settings area (ADR 0016). The page of a View and the search are both
 * drawn from the list of these, so nothing about a row is declared a second time. A row is not a
 * Setting: it may serve one, several or none.
 */
export interface SettingsRow {
  /** Unique in the whole list, and never reused. */
  readonly id: string;
  /** The id of the View whose page shows the row. */
  readonly view: string;
  /**
   * The heading the row stands under within its View, shared by the rows that belong together,
   * such as the Shortcuts of one module. Rows without one stand first, under no heading.
   */
  readonly group?: SettingsRowGroup;
  readonly title: MessageDescriptor;
  readonly description?: MessageDescriptor;
  /** What else finds the row, besides its title, description and values. */
  readonly searchWords: readonly (MessageDescriptor | LocalText)[];
  /**
   * The names of the values the row offers or shows, so that a value finds its row. A plain text
   * is a name that is the same in every language, such as a language's own name.
   */
  readonly values: readonly RowText[];
  /** The keys of the Settings the row reads or writes; absent for a row that only shows something. */
  readonly settings?: readonly string[];
  /** The right-hand part: a control, or a value that is only shown. */
  readonly control: ComponentType<SettingsRowControlProps>;
}
