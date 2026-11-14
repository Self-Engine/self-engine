// The names of the Color Sets as a user reads them, shared by every control that offers a Color
// Set: the Accent in the Settings and the color of an entry. Translated when shown, so they follow
// a language switch.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { ColorSetName } from "@self-engine/theme/names";

/** Each Color Set's name. A context, because "Orange" or "Green" may also be a fruit or a state. */
export const COLOR_SET_LABELS: Readonly<Record<ColorSetName, MessageDescriptor>> = {
  red: msg({ message: "Red", context: "Color" }),
  pink: msg({ message: "Pink", context: "Color" }),
  grape: msg({ message: "Grape", context: "Color" }),
  violet: msg({ message: "Violet", context: "Color" }),
  indigo: msg({ message: "Indigo", context: "Color" }),
  blue: msg({ message: "Blue", context: "Color" }),
  cyan: msg({ message: "Cyan", context: "Color" }),
  teal: msg({ message: "Teal", context: "Color" }),
  green: msg({ message: "Green", context: "Color" }),
  lime: msg({ message: "Lime", context: "Color" }),
  yellow: msg({ message: "Yellow", context: "Color" }),
  orange: msg({ message: "Orange", context: "Color" }),
};
