import { Stack, Text, UnstyledButton } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EntryMark } from "@self-engine/ui/entry-mark";
import { memo, type ReactNode, useMemo } from "react";
import type { Project } from "./port.ts";
import { useSortedByTitle } from "./sorted-by-title.ts";

/** A list of projects sorted by title, as "Active" and "Archive" show it; `empty` when there is none. */
export function ProjectList({
  label,
  projects,
  empty,
}: {
  readonly label: string;
  readonly projects: readonly Project[];
  readonly empty: ReactNode;
}) {
  const sorted = useSortedByTitle(projects);
  const rows = useMemo(
    () => sorted.map((project) => <ProjectRow key={project.id} project={project} />),
    [sorted],
  );
  if (projects.length === 0) return empty;
  return (
    <Stack aria-label={label} component="ul" gap="xs" m={0} p={0}>
      {rows}
    </Stack>
  );
}

/**
 * A row is its own component behind `memo` and receives its project whole, so that one changed
 * project draws one row (docs/development/performance.md, "One changed row redraws one row").
 * It opens the project in the Edit Drawer.
 */
const ProjectRow = memo(function ProjectRow({ project }: { readonly project: Project }) {
  const write = useWriteViewSearch();
  return (
    <li style={{ listStyle: "none" }}>
      <UnstyledButton
        onClick={() => write((search) => ({ ...search, edit: project.id }))}
        style={ROW_STYLE}
      >
        <EntryMark color={project.color} defaultIcon={ProjectsIcon} icon={project.icon} />
        <Text truncate>{project.title}</Text>
      </UnstyledButton>
    </li>
  );
});

const ROW_STYLE = {
  alignItems: "center",
  display: "flex",
  gap: "var(--mantine-spacing-sm)",
  width: "100%",
} as const;
