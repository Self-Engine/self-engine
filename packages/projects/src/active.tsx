import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EmptyState, QueryStateBlock } from "@self-engine/ui";
import { NEW_PROJECT_ID } from "./project-address.ts";
import { ProjectList } from "./project-list.tsx";
import { ACTIVE_PROJECTS, useActiveProjects } from "./port.ts";

/**
 * The View "Active": the projects that are not archived, sorted by title. It reads through the
 * Query hook, so a Table Change of `projects` reloads it in every open View (D250, D257).
 */
export default function Active() {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  return (
    <QueryStateBlock state={useActiveProjects(ACTIVE_PROJECTS)}>
      {(projects) => (
        <ProjectList
          label={t`Active projects`}
          projects={projects}
          empty={
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
          }
        />
      )}
    </QueryStateBlock>
  );
}
