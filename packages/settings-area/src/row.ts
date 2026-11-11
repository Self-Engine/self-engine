import type { MessageDescriptor } from "@lingui/core";
import type { JsonValue, SettingDeclaration, SettingsStore } from "@self-engine/settings";
import type { ComponentType } from "react";

export interface SettingsRowControlProps {
  readonly store: SettingsStore;
  /** The id of the element that shows the row's title, which names the control. */
  readonly labelledBy: string;
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
  readonly title: MessageDescriptor;
  readonly description?: MessageDescriptor;
  /** What else finds the row, besides its title, description and values. */
  readonly searchWords: readonly MessageDescriptor[];
  /** The names of the values the row offers or shows, so that a value finds its row. */
  readonly values: readonly MessageDescriptor[];
  /**
   * The Settings the row writes, so that a test can tell when a Setting has no row. Left out by a
   * row that only shows something.
   */
  readonly settings?: readonly SettingDeclaration<JsonValue>[];
  /** The right-hand part: a control, or a value that is only shown. */
  readonly control: ComponentType<SettingsRowControlProps>;
}
