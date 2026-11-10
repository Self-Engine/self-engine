import { useLingui } from "@lingui/react/macro";
import { ErrorState } from "@self-engine/ui";
import { useRouter } from "@tanstack/react-router";

export function NotFound() {
  const { t } = useLingui();
  return <ErrorState title={t`Nothing was found at this address.`} />;
}

export function ViewLoadError() {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <ErrorState
      onRetry={() => void router.invalidate()}
      title={t`This View could not be loaded. Please try again.`}
    />
  );
}
