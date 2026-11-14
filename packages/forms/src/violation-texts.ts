import type { MessageDescriptor } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { core } from "zod";

// The texts of the checks (D320): one per kind of violation, with the number taken from the
// violation, and a catch-all for everything else. A text of Zod never reaches the screen: Zod
// writes for developers, and in English only. Each text is a descriptor, translated where a field
// shows it, so it follows a language switch.

/** Shown for every violation the helper has no text for. */
export const CATCH_ALL = msg`Invalid value.`;

const REQUIRED = msg`This field is required.`;
const WHOLE_NUMBER = msg`Enter a whole number.`;

/** The text for one violation of the input schema, at a field that holds `value`. */
export function violationText(issue: StandardSchemaV1.Issue, value: unknown): MessageDescriptor {
  // The Contracts' schemas are Zod (D187), whose violations carry their kind and their bounds.
  const violation = issue as core.$ZodIssue;
  switch (violation.code) {
    case "invalid_type":
      if (isEmpty(value)) return REQUIRED;
      return violation.expected === "int" ? WHOLE_NUMBER : CATCH_ALL;
    case "too_small":
      return tooSmall(violation, value);
    case "too_big":
      return tooBig(violation);
    default:
      return CATCH_ALL;
  }
}

/** Nothing chosen or typed yet: a field's empty value (D319). */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function tooSmall(violation: core.$ZodIssueTooSmall, value: unknown): MessageDescriptor {
  const { minimum, inclusive = true, origin } = violation;
  if (typeof minimum !== "number") return CATCH_ALL;
  if (origin === "string") {
    // A text that has to have one character only fails when it is empty, also after trimming.
    if (minimum <= 1) return REQUIRED;
    return msg`${plural(minimum, { one: "At least # character.", other: "At least # characters." })}`;
  }
  if (origin === "number") {
    if (isEmpty(value)) return REQUIRED;
    return inclusive
      ? msg`${plural(minimum, { other: "At least #." })}`
      : msg`${plural(minimum, { other: "More than #." })}`;
  }
  return CATCH_ALL;
}

function tooBig(violation: core.$ZodIssueTooBig): MessageDescriptor {
  const { maximum, inclusive = true, origin } = violation;
  if (typeof maximum !== "number") return CATCH_ALL;
  if (origin === "string") {
    return msg`${plural(maximum, { one: "At most # character.", other: "At most # characters." })}`;
  }
  if (origin === "number") {
    return inclusive
      ? msg`${plural(maximum, { other: "At most #." })}`
      : msg`${plural(maximum, { other: "Less than #." })}`;
  }
  return CATCH_ALL;
}
