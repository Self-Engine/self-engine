// Its own entry, not part of the package's index: the index loads at startup, and the warnings
// sit in parts that load later, such as the Settings and the forms.
import { Alert, type AlertProps } from "@mantine/core";
import { ErrorIcon } from "@self-engine/icons";
import { roleColor } from "@self-engine/theme";

const WARNING_VARS = () => ({
  root: {
    "--alert-bg": roleColor("warningSoft"),
    "--alert-color": roleColor("warningText"),
    "--alert-bd": "none",
  },
});

export type WarningAlertProps = Omit<AlertProps, "color" | "icon" | "variant" | "vars">;

/**
 * A lasting warning in the content, in the warning colors of the theme: something stays wrong
 * until the user or the app mends it, such as a failed backup. Mantine gives it the role `alert`.
 */
export function WarningAlert(props: WarningAlertProps) {
  // The icon the app already loads at startup: one of its own would add 3.3 KB there.
  return <Alert icon={<ErrorIcon />} vars={WARNING_VARS} {...props} />;
}
