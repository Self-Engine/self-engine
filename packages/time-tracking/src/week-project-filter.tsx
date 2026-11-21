import { useLingui } from "@lingui/react/macro";
import { Group, Select } from "@mantine/core";
import {
  ACTIVE_PROJECTS,
  ARCHIVED_PROJECTS,
  useActiveProjects,
  useArchivedProjects,
} from "@self-engine/projects/queries";
import { useViewSearch, useWriteViewSearch } from "@self-engine/shell";
import { NO_PROJECT, shownProjectFilter, withProjectFilter } from "./project-filter-address.ts";
import { ProjectEntryMark } from "./project-mark.tsx";

const ALL = "all";

export function WeekProjectFilter() {
  const { t } = useLingui();
  const selected = useViewSearch(shownProjectFilter);
  const write = useWriteViewSearch();
  const active = useActiveProjects(ACTIVE_PROJECTS);
  const archived = useArchivedProjects(ARCHIVED_PROJECTS);
  const activeProjects = "data" in active ? active.data : [];
  const activeIds = new Set(activeProjects.map(({ id }) => id));
  // The two Queries can answer a Table Change at different times.
  const archivedProjects =
    "data" in archived ? archived.data.filter(({ id }) => !activeIds.has(id)) : [];
  const byId = new Map<string, (typeof activeProjects)[number]>(
    [...activeProjects, ...archivedProjects].map((project) => [project.id, project]),
  );
  const chosen = selected === undefined ? undefined : byId.get(selected);
  const optionOf = ({ id, title }: (typeof activeProjects)[number]) => ({
    value: id,
    label: title,
  });
  const data = [
    { value: ALL, label: t`All` },
    { value: NO_PROJECT, label: t`No project` },
    ...activeProjects.map(optionOf),
    ...(archivedProjects.length === 0
      ? []
      : [{ group: t`Archived projects`, items: archivedProjects.map(optionOf) }]),
  ];
  if (selected !== undefined && selected !== NO_PROJECT && chosen === undefined) {
    // Keep the filter visible even while its Project's list is still loading.
    data.push({ value: selected, label: selected });
  }
  const failed = [active, archived].filter(
    (state) => state.status === "loadFailed" || state.status === "reloadFailed",
  );
  return (
    <Select
      aria-label={t`Filter by project`}
      data={data}
      error={failed.length > 0 ? t`The projects could not be loaded.` : undefined}
      leftSection={chosen === undefined ? null : <ProjectEntryMark project={chosen} />}
      onChange={(value) =>
        write((search) =>
          withProjectFilter(search, value === NO_PROJECT ? NO_PROJECT : byId.get(value ?? ALL)?.id),
        )
      }
      onDropdownOpen={() => {
        for (const state of failed) state.retry();
      }}
      renderOption={({ option }) => {
        const project = byId.get(option.value);
        return project === undefined ? (
          option.label
        ) : (
          <Group gap="xs" wrap="nowrap">
            <ProjectEntryMark project={project} />
            {option.label}
          </Group>
        );
      }}
      searchable
      value={selected ?? ALL}
      w={200}
    />
  );
}
