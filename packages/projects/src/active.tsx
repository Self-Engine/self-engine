import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack, Text } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EmptyState, QueryStateBlock } from "@self-engine/ui";
import { EntryMark } from "@self-engine/ui/entry-mark";
import { memo, useMemo } from "react";
import { NEW_PROJECT_ID } from "./project-address.ts";
import { ACTIVE_PROJECTS, type Project, useActiveProjects } from "./port.ts";
import { useSortedByTitle } from "./sorted-by-title.ts";

/**
 * The View "Active": the projects that are not archived, sorted by title. It reads through the
 * Query hook, so a Table Change of `projects` reloads it in every open View (D250, D257).
 */
export default function Active() {
  return (
    <QueryStateBlock state={useActiveProjects(ACTIVE_PROJECTS)}>
      {(projects) => <ProjectList projects={projects} />}
    </QueryStateBlock>
  );
}

function ProjectList({ projects }: { readonly projects: readonly Project[] }) {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  const sorted = useSortedByTitle(projects);
  const rows = useMemo(
    () => sorted.map((project) => <ProjectRow key={project.id} project={project} />),
    [sorted],
  );
  if (projects.length === 0) {
    return (
      <EmptyState
        action={
          <Button onClick={() => write((search) => ({ ...search, edit: NEW_PROJECT_ID }))}>
            {t`New project`}
          </Button>
        }
        description={t`Create your first project with "New project". It appears here.`}
        icon={ProjectsIcon}
        title={t`No projects yet`}
      />
    );
  }
  return (
    <Stack aria-label={t`Active projects`} component="ul" gap="xs" m={0} p={0}>
      {rows}
    </Stack>
  );
}

/**
 * A row is its own component behind `memo` and receives its project whole, so that one changed
 * project draws one row (docs/development/performance.md, "One changed row redraws one row").
 */
const ProjectRow = memo(function ProjectRow({ project }: { readonly project: Project }) {
  return (
    <Group component="li" gap="sm" style={{ listStyle: "none" }} wrap="nowrap">
      <EntryMark color={project.color} defaultIcon={ProjectsIcon} icon={project.icon} />
      <Text truncate>{project.title}</Text>
    </Group>
  );
});
