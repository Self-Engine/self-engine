// Entering an emoji as the icon of an entry: a text field that accepts exactly one emoji by the
// rule of `@self-engine/icons/names`, and points to the emoji keyboard of the operating system
// for typing it. No emoji library and no emoji grid: the system keyboard has every emoji, with
// search and skin tones, in the user's language.

import { useLingui } from "@lingui/react/macro";
import { TextInput } from "@mantine/core";
import { resolveEntryIcon } from "@self-engine/icons/names";
import { useState } from "react";

export interface EntryEmojiInputProps {
  /**
   * The stored `icon`. It shows when it is one emoji; an icon name or an unknown text shows as an
   * empty field and stays stored until the user types.
   */
  readonly value: string | null | undefined;
  /**
   * Exactly one emoji, which `entryIconSchema` accepts, or `null` for an empty field. Input that
   * is not one emoji shows an error and answers nothing.
   */
  readonly onChange: (emoji: string | null) => void;
  /** The field's visible name; "Emoji" when left out. */
  readonly label?: string;
}

/** The emoji a stored `icon` holds, or an empty text. */
function shownEmoji(value: string | null | undefined): string {
  const resolved = resolveEntryIcon(value);
  return resolved.kind === "emoji" ? resolved.emoji : "";
}

/** A field for one emoji. Typing anything else shows an error and leaves the value as it was. */
export function EntryEmojiInput({ value, onChange, label }: EntryEmojiInputProps) {
  const { t } = useLingui();
  // What the user typed, and the stored value it belongs to: a new stored value, such as an icon
  // the icon picker chose, replaces the text.
  const [draft, setDraft] = useState({ text: shownEmoji(value), of: value });
  if (draft.of !== value) setDraft({ text: shownEmoji(value), of: value });
  const text = draft.of === value ? draft.text : shownEmoji(value);
  const trimmed = text.trim();
  const valid = trimmed === "" || resolveEntryIcon(trimmed).kind === "emoji";
  return (
    <TextInput
      autoComplete="off"
      description={t`One emoji. The emoji keyboard opens with Control + Command + Space on a Mac and with Windows + . on Windows.`}
      error={valid ? undefined : t`Enter exactly one emoji.`}
      label={label ?? t`Emoji`}
      onChange={(event) => {
        const next = event.currentTarget.value;
        const nextTrimmed = next.trim();
        const answer =
          nextTrimmed === ""
            ? null
            : resolveEntryIcon(nextTrimmed).kind === "emoji"
              ? nextTrimmed
              : undefined;
        // The text belongs to the value it answers, so the answer does not reset it.
        setDraft({ text: next, of: answer === undefined ? value : answer });
        if (answer !== undefined) onChange(answer);
      }}
      spellCheck={false}
      value={text}
    />
  );
}
