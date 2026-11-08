import { Anchor, Container, Group } from "@mantine/core";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <Container py="md">
      <Group component="nav" mb="md">
        <Anchor component={Link} to="/">
          Home
        </Anchor>
        <Anchor component={Link} to="/about">
          About
        </Anchor>
      </Group>
      <Outlet />
    </Container>
  );
}
