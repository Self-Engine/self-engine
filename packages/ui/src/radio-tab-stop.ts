// The Tab stop of a group of Mantine `Radio.Card`s. `Radio.Card` moves the arrow keys over the
// cards of one group, but every card stays a Tab stop of its own; a native radio group has one.

export interface RadioChoice<V = string> {
  readonly value: V;
  readonly disabled?: boolean;
}

/**
 * The one radio of a group the Tab key stops on, as in a native radio group: the chosen one, or
 * the first that can be chosen. Give it `tabIndex={0}` and every other card `-1`.
 */
export function radioTabStop<V>(choices: readonly RadioChoice<V>[], chosen: V): V | undefined {
  const usable = choices.filter((choice) => !choice.disabled);
  return (usable.find((choice) => choice.value === chosen) ?? usable[0])?.value;
}
