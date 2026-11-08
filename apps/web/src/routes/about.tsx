import { Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <>
      <Title order={1}>About</Title>
      <Text>A second route, to prove navigation works.</Text>
    </>
  );
}
