import { Trans } from "@lingui/react/macro";
import { Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <>
      <Title order={1}>Self-Engine</Title>
      <Text>
        <Trans>The empty desktop shell.</Trans>
      </Text>
    </>
  );
}
