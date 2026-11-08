import { Trans } from "@lingui/react/macro";
import { Anchor, Badge, Container, Group } from "@mantine/core";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { channelBadge } from "../env.ts";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const badge = channelBadge(window);
  return (
    <Container py="md">
      <Group component="nav" mb="md">
        <Anchor component={Link} to="/">
          <Trans>Home</Trans>
        </Anchor>
        <Anchor component={Link} to="/about">
          <Trans>About</Trans>
        </Anchor>
        <Anchor component={Link} to="/theme-preview">
          <Trans>Theme preview</Trans>
        </Anchor>
        {badge && <Badge variant="light">{badge}</Badge>}
      </Group>
      <Outlet />
    </Container>
  );
}
