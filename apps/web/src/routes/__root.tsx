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
          Home
        </Anchor>
        <Anchor component={Link} to="/about">
          About
        </Anchor>
        {badge && <Badge variant="light">{badge}</Badge>}
      </Group>
      <Outlet />
    </Container>
  );
}
