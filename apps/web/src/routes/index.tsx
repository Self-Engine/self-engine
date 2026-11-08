import { Trans } from "@lingui/react/macro";
import { Anchor, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <>
      <Title order={1}>Self-Engine</Title>
      <Text>The empty desktop shell.</Text>
      {/* Here and not in the root navigation, which #68 turns into data. #23 removes it. */}
      <Anchor component={Link} to="/language-sample">
        <Trans>Language sample</Trans>
      </Anchor>
    </>
  );
}
