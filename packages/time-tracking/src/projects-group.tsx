import { useLingui } from "@lingui/react/macro";
import { ACTIVE_PROJECTS, useActiveProjects } from "@self-engine/projects/queries";
import { ShellGroup, ShellGroupEntry, type ViewSearch, useViewSearch } from "@self-engine/shell";
import { QueryStateBlock } from "@self-engine/ui";
import {
  NO_PROJECT,
  type ProjectFilter,
  shownProjectFilter,
  withProjectFilter,
} from "./project-filter-address.ts";
import { ProjectEntryMark } from "./project-mark.tsx";

export default function ProjectsGroup() {
  const { t } = useLingui();
  const selected = useViewSearch(shownProjectFilter);
  const projects = useActiveProjects(ACTIVE_PROJECTS);
  const toggle = (filter: ProjectFilter) => (search: ViewSearch) =>
    withProjectFilter(search, selected === filter ? undefined : filter);

  return (
    <ShellGroup title={t`Projects`}>
      <ShellGroupEntry active={selected === undefined} label={t`All`} search={toggle(undefined)} />
      <QueryStateBlock state={projects}>
        {(active) =>
          active.map((project) => (
            <ShellGroupEntry
              active={selected === project.id}
              key={project.id}
              label={project.title}
              leftSection={<ProjectEntryMark project={project} />}
              search={toggle(project.id)}
            />
          ))
        }
      </QueryStateBlock>
      <ShellGroupEntry
        active={selected === NO_PROJECT}
        label={t`No project`}
        search={toggle(NO_PROJECT)}
      />
    </ShellGroup>
  );
}
