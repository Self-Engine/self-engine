import { Trans, useLingui } from "@lingui/react/macro";
import { Text } from "@mantine/core";
import { ContributionFailure } from "@self-engine/shell";
import { useRouter } from "@tanstack/react-router";

export function NotFound() {
  return (
    <Text>
      <Trans>Nothing was found at this address.</Trans>
    </Text>
  );
}

export function ViewLoadError() {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <ContributionFailure
      message={t`This View could not be loaded. Please try again.`}
      onRetry={() => void router.invalidate()}
    />
  );
}
