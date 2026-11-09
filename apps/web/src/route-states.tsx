import { Trans } from "@lingui/react/macro";
import { Text } from "@mantine/core";

export function NotFound() {
  return (
    <Text>
      <Trans>Nothing was found at this address.</Trans>
    </Text>
  );
}
export function ViewLoadError() {
  return (
    <Text role="alert">
      <Trans>This View could not be loaded. Please try again.</Trans>
    </Text>
  );
}
