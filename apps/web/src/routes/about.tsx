import { Trans } from "@lingui/react/macro";
import { Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <>
      <Title order={1}>
        <Trans context="page name">About</Trans>
      </Title>
      <Text>
        <Trans>A second route, to prove navigation works.</Trans>
      </Text>
    </>
  );
}
