// The standard shapes of a Settings Row's control. A row that fits none of them writes its own
// `control` (ADR 0016).

import type { I18n, MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { SegmentedControl, Slider, Switch } from "@mantine/core";
import type { SettingDeclaration } from "@self-engine/settings";
import { useSetting } from "@self-engine/settings/react";
import type { SettingsRow, SettingsRowControlProps } from "./row.ts";

type RowText = Pick<SettingsRow, "id" | "view" | "title" | "description" | "searchWords">;

interface Choice<Value extends string> {
  readonly value: Value;
  readonly label: MessageDescriptor;
}

/** A Setting with a few named values, all visible at once. */
export function choiceRow<Value extends string>({
  setting,
  choices,
  ...text
}: RowText & {
  readonly setting: SettingDeclaration<Value>;
  readonly choices: readonly Choice<Value>[];
}): SettingsRow {
  function ChoiceControl({ store, labelledBy }: SettingsRowControlProps) {
    const { i18n } = useLingui();
    const value = useSetting(store, setting);
    return (
      <SegmentedControl
        aria-labelledby={labelledBy}
        data={choices.map((choice) => ({ value: choice.value, label: i18n._(choice.label) }))}
        onChange={(next) => {
          const choice = choices.find((candidate) => candidate.value === next);
          if (choice) store.write(setting, choice.value);
        }}
        value={value}
      />
    );
  }
  return {
    ...text,
    values: choices.map((choice) => choice.label),
    settings: [setting],
    control: ChoiceControl,
  };
}

/** A Setting that is on or off. */
export function switchRow({
  setting,
  ...text
}: RowText & { readonly setting: SettingDeclaration<boolean> }): SettingsRow {
  function SwitchControl({ store, labelledBy }: SettingsRowControlProps) {
    const checked = useSetting(store, setting);
    return (
      <Switch
        aria-labelledby={labelledBy}
        checked={checked}
        onChange={(event) => {
          store.write(setting, event.currentTarget.checked);
        }}
      />
    );
  }
  return { ...text, values: [], settings: [setting], control: SwitchControl };
}

/** A Setting with a few numbers in order, as a slider that rests only on those. */
export function stopsRow<Stop extends number>({
  setting,
  stops,
  format,
  ...text
}: RowText & {
  readonly setting: SettingDeclaration<Stop>;
  readonly stops: readonly [Stop, Stop, ...Stop[]];
  /** The name of a stop, in the language shown. */
  readonly format: (stop: number, i18n: I18n) => string;
}): SettingsRow {
  function StopsControl({ store, labelledBy }: SettingsRowControlProps) {
    const { i18n } = useLingui();
    const value = useSetting(store, setting);
    return (
      <Slider
        flex="0 1 20rem"
        label={(stop) => format(stop, i18n)}
        marks={stops.map((stop) => ({ value: stop, label: format(stop, i18n) }))}
        max={Math.max(...stops)}
        // Room for the names of the stops, which Mantine hangs below the track and centers on
        // the first and last stop.
        mb="lg"
        min={Math.min(...stops)}
        mx="lg"
        onChange={(next) => {
          const stop = stops.find((candidate) => candidate === next);
          if (stop !== undefined) store.write(setting, stop);
        }}
        restrictToMarks
        thumbProps={{ "aria-labelledby": labelledBy }}
        thumbValueText={(stop) => format(stop, i18n)}
        value={value}
      />
    );
  }
  return { ...text, values: [], settings: [setting], control: StopsControl };
}
