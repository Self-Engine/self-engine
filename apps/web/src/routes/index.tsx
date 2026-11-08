import { Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <>
      <Title order={1}>Self-Engine</Title>
      <Text>The empty desktop shell.</Text>
    </>
  );
}
