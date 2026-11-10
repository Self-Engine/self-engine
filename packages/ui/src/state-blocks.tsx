import { useLingui } from "@lingui/react/macro";
import { Button, Center, EmptyState as MantineEmptyState, Loader } from "@mantine/core";
import { useTimeout } from "@mantine/hooks";
import { ErrorIcon } from "@self-engine/icons";
import { roleColor } from "@self-engine/theme";
import { type ComponentType, type CSSProperties, type ReactNode, useState } from "react";

/** Local reads usually finish within milliseconds, and a spinner for those would only flicker. */
const LOADER_DELAY_MS = 200;

/** A catalog icon sizes itself for a line of text, and here it fills Mantine's indicator instead. */
const FILL_INDICATOR: CSSProperties = { width: "1em", height: "1em" };

const ERROR_VARS = () => ({
  root: { "--empty-state-indicator-color": roleColor("errorText") },
});

export interface EmptyStateProps {
  readonly icon: ComponentType<{ readonly style?: CSSProperties }>;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
}

/** "Nothing here yet", with the next step. Size and alignment come from the theme. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <MantineEmptyState
      description={description}
      icon={<Icon style={FILL_INDICATOR} />}
      title={title}
    >
      {action !== undefined && <MantineEmptyState.Actions>{action}</MantineEmptyState.Actions>}
    </MantineEmptyState>
  );
}

export interface ErrorStateProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly onRetry?: () => void;
  /** Takes the place of the retry, for a failure that another try cannot mend. */
  readonly action?: ReactNode;
}

/** "That failed". Offers another try only when the caller can make one. */
export function ErrorState({ title, description, onRetry, action }: ErrorStateProps) {
  const { t } = useLingui();
  const next =
    action ??
    (onRetry && (
      <Button onClick={onRetry} variant="default">
        {t`Try again`}
      </Button>
    ));
  return (
    <MantineEmptyState
      description={description}
      icon={<ErrorIcon style={FILL_INDICATOR} />}
      role="alert"
      title={title}
      vars={ERROR_VARS}
    >
      {next && <MantineEmptyState.Actions>{next}</MantineEmptyState.Actions>}
    </MantineEmptyState>
  );
}

/** "Still loading", for work that turned out to be slow. */
export function LoadingState() {
  const { t } = useLingui();
  const [slow, setSlow] = useState(false);
  useTimeout(() => setSlow(true), LOADER_DELAY_MS, { autoInvoke: true });
  if (!slow) return null;
  return (
    <Center>
      <Loader aria-label={t`Loading`} role="status" />
    </Center>
  );
}
