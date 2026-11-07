import "@mantine/core/styles.css";
import { Badge, Card, Container, List, MantineProvider, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";

export interface DbInfo {
  sqliteVersion: string;
  projects: { id: number; name: string }[];
  runtime: string;
}

declare global {
  interface Window {
    spike?: { variant: string; getDbInfo: () => Promise<DbInfo> };
  }
}

// Change this text to test renderer HMR.
const HMR_MARKER = "HMR marker v1";

export function App() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!window.spike) {
      setError("window.spike missing (preload not loaded)");
      return;
    }
    window.spike.getDbInfo().then(
      (i) => {
        setInfo(i);
        console.log("[renderer] db info", JSON.stringify(i));
      },
      (e: unknown) => setError(String(e)),
    );
  }, []);
  return (
    <MantineProvider defaultColorScheme="dark">
      <Container py="xl">
        <Title order={2}>Layer 0 spike {window.spike?.variant ?? "?"}</Title>
        <Text c="dimmed" mb="md">
          {HMR_MARKER}
        </Text>
        <Card withBorder>
          {error && <Text c="red">{error}</Text>}
          {info && (
            <>
              <Badge mb="sm">SQLite {info.sqliteVersion}</Badge>
              <Text size="sm" mb="sm">
                {info.runtime}
              </Text>
              <List>
                {info.projects.map((p) => (
                  <List.Item key={p.id}>{p.name}</List.Item>
                ))}
              </List>
            </>
          )}
        </Card>
      </Container>
    </MantineProvider>
  );
}
