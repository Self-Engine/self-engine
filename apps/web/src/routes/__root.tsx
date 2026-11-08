import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Anchor, Badge, Container, Group } from "@mantine/core";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { channelBadge } from "../env.ts";

const NAVIGATION = [
  { to: "/", label: msg({ message: "Home", context: "page name" }) },
  { to: "/about", label: msg({ message: "About", context: "page name" }) },
  { to: "/theme-preview", label: msg`Theme preview` },
  { to: "/language-sample", label: msg`Language sample` },
] as const;

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { _ } = useLingui();
  const badge = channelBadge(window);
  return (
    <Container py="md">
      <Group component="nav" mb="md">
        {NAVIGATION.map(({ to, label }) => (
          <Anchor key={to} component={Link} to={to}>
            {_(label)}
          </Anchor>
        ))}
        {badge && <Badge variant="light">{badge}</Badge>}
      </Group>
      <Outlet />
    </Container>
  );
}
