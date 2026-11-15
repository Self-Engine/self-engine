import { useLingui } from "@lingui/react/macro";
import { ProjectsIcon } from "@self-engine/icons";
import { EmptyState, QueryStateBlock } from "@self-engine/ui";
import { ProjectList } from "./project-list.tsx";
import { ARCHIVED_PROJECTS, useArchivedProjects } from "./port.ts";

/**
 * The View "Archive": the archived projects, sorted by title as "Active" is (D327). A project
 * opens in the same Edit Drawer, where it is edited, unarchived or deleted.
 */
export default function Archive() {
  const { t } = useLingui();
  return (
    <QueryStateBlock state={useArchivedProjects(ARCHIVED_PROJECTS)}>
      {(projects) => (
        <ProjectList
          label={t`Archived projects`}
          projects={projects}
          empty={
            <EmptyState
              description={t`A project you archive leaves "Active" and appears here.`}
              icon={ProjectsIcon}
              title={t`No archived projects`}
            />
          }
        />
      )}
    </QueryStateBlock>
  );
}
