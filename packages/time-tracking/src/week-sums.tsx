import { useLingui } from "@lingui/react/macro";
import { Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { type Duration, formatDuration } from "@self-engine/time";
import { memo } from "react";
import type { ProjectTotal } from "./port.ts";
import { ProjectMark } from "./project-mark.tsx";

/**
 * The sums of the week per project, in the Query's order (largest first, "no project" last), and
 * the week's total. Each is rounded up to the full minute only here, after the Query added the
 * seconds (D345).
 */
export const WeekSums = memo(function WeekSums({
  projects,
  total,
  locale,
}: {
  readonly projects: readonly ProjectTotal[];
  readonly total: Duration;
  readonly locale: string;
}) {
  const { t } = useLingui();
  return (
    <Paper aria-label={t`Week totals`} component="section" p="sm" withBorder>
      <Title mb="xs" order={3} size="h5">
        {t`Projects`}
      </Title>
      <Stack component="ul" gap={6} m={0} p={0}>
        {projects.map((line) => (
          <Group
            component="li"
            justify="space-between"
            key={line.project?.id ?? "none"}
            style={ROW_STYLE}
            wrap="nowrap"
          >
            <ProjectMark project={line.project} />
            <Text size="sm" style={NUMBERS}>
              {formatDuration(line.total, "hoursMinutes", locale)}
            </Text>
          </Group>
        ))}
      </Stack>
      <Divider my="xs" />
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600}>{t`Total`}</Text>
        <Text aria-label={t`Week total`} fw={600} style={NUMBERS}>
          {formatDuration(total, "hoursMinutes", locale)}
        </Text>
      </Group>
    </Paper>
  );
});

const NUMBERS = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;
const ROW_STYLE = { listStyle: "none" } as const;
