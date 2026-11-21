import { useLingui } from "@lingui/react/macro";
import { Group, Text } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import type { ProjectReference } from "@self-engine/projects/contracts";
import { EntryMark } from "@self-engine/ui/entry-mark";

export function ProjectEntryMark({
  project,
}: {
  readonly project: Pick<ProjectReference, "color" | "icon">;
}) {
  return (
    <EntryMark color={project.color} defaultIcon={ProjectsIcon} icon={project.icon} size="sm" />
  );
}

/**
 * A project with its mark and title, so that two projects with the same title stay apart; "No
 * project" without a mark. An archived project keeps its mark (ADR 0029).
 */
export function ProjectMark({ project }: { readonly project: ProjectReference | null }) {
  const { t } = useLingui();
  if (project === null) {
    return (
      <Text c="dimmed" size="sm" truncate>
        {t`No project`}
      </Text>
    );
  }
  return (
    <Group gap={6} miw={0} wrap="nowrap">
      <ProjectEntryMark project={project} />
      <Text size="sm" truncate>
        {project.title}
      </Text>
    </Group>
  );
}
