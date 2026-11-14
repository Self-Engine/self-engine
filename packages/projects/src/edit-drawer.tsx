import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  type OperationForm,
  TextField,
  useOperationForm,
} from "@self-engine/forms";
import { type EditDrawerProps, useEditDrawerTitle } from "@self-engine/shell";
import { ErrorState, QueryStateBlock } from "@self-engine/ui";
import type { ReactNode } from "react";
import { useState } from "react";
import { projectsContract } from "./contracts/index.ts";
import { NEW_PROJECT_ID } from "./project-address.ts";
import {
  ACTIVE_PROJECTS,
  ARCHIVED_PROJECTS,
  type Project,
  useActiveProjects,
  useArchivedProjects,
  useCreateProject,
  useEditProject,
} from "./port.ts";
import { useArchiveWithUndo, useDeleteWithUndo, useUnarchiveWithUndo } from "./with-undo.tsx";

/**
 * The Edit Drawer of `projects`. It loads on demand with the Contract, whose input schema the form
 * checks with (D317). A stored project is found in the two list Queries, "Active" and "Archive":
 * there is no Query for one id.
 */
export default function EditDrawer(props: EditDrawerProps) {
  if (props.id === NEW_PROJECT_ID) return <CreateForm {...props} />;
  return <StoredProjectDrawer {...props} />;
}

const withId = (projects: readonly Project[], id: string) =>
  projects.find((project) => project.id === id);

function StoredProjectDrawer(props: EditDrawerProps) {
  const active = useActiveProjects(ACTIVE_PROJECTS);
  const archived = useArchivedProjects(ARCHIVED_PROJECTS);
  return (
    <QueryStateBlock state={active}>
      {(activeProjects) => (
        <QueryStateBlock state={archived}>
          {(archivedProjects) => (
            <FoundProject
              {...props}
              found={withId(activeProjects, props.id) ?? withId(archivedProjects, props.id)}
            />
          )}
        </QueryStateBlock>
      )}
    </QueryStateBlock>
  );
}

/** A named Operation of the action slot, which closes the drawer and offers undo in a Notice. */
type Leave = (id: Project["id"]) => Promise<void>;

/**
 * Keeps the last project it found, so that one deleted elsewhere stays readable with the warning
 * (D324). Once "Archive", "Unarchive" or "Delete" was chosen here, it keeps that project as it was
 * through the closing transition (#132): the project moves between the two lists, or leaves both,
 * and the closing drawer shows neither "not found", the warning nor the other button.
 */
function FoundProject({
  found,
  ...props
}: EditDrawerProps & { readonly found: Project | undefined }) {
  const remove = useDeleteWithUndo();
  const archive = useArchiveWithUndo();
  const unarchive = useUnarchiveWithUndo();
  const [last, setLast] = useState(found);
  const [leaving, setLeaving] = useState(false);
  if (!leaving && found !== undefined && found !== last) setLast(found);
  const project = leaving ? last : (found ?? last);
  if (project === undefined) return <NotFound {...props} />;
  const leave = (operation: Leave) => () => {
    setLeaving(true);
    void operation(project.id);
    props.onDone();
  };
  return (
    <EditForm
      {...props}
      project={project}
      deleted={found === undefined && !leaving}
      onArchive={leave(project.archivedAt === null ? archive : unarchive)}
      onDelete={leave(remove)}
    />
  );
}

function NotFound({ onDone }: EditDrawerProps) {
  const { t } = useLingui();
  return (
    <ErrorState
      title={t`Project not found`}
      action={
        <Button onClick={onDone} variant="default">
          {t({ message: "Close", context: "Close the drawer" })}
        </Button>
      }
    />
  );
}

function CreateForm({ onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New project`);
  const form = useOperationForm({
    entry: projectsContract.create,
    operation: useCreateProject(),
    draft: { title: "", description: "", icon: null, color: null },
    emptyTextFields: ["description"],
    onDone,
  });
  return <ProjectFields form={form} onCancel={onCancel} />;
}

/**
 * The form of a stored project. It sends the id and the changed fields (D323); the helper follows
 * a change from elsewhere in the untouched fields and compares with the stored state (D321, D324).
 */
function EditForm({
  project,
  deleted,
  onArchive,
  onDelete,
  onCancel,
  onDone,
}: EditDrawerProps & {
  readonly project: Project;
  readonly deleted: boolean;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}) {
  const { t } = useLingui();
  useEditDrawerTitle(project.title);
  const form = useOperationForm({
    entry: projectsContract.edit,
    operation: useEditProject(),
    draft: {
      id: project.id,
      title: project.title,
      description: project.description,
      icon: project.icon,
      color: project.color,
    },
    edit: { identity: { id: project.id }, deleted },
    emptyTextFields: ["description"],
    onDone,
  });
  return (
    <ProjectFields
      form={form}
      onCancel={onCancel}
      actions={
        // Named Operations, never fields (D322, D323): archiving locks nothing, so an archived
        // project is edited and deleted here like an active one.
        <>
          <Button onClick={onArchive} variant="subtle">
            {project.archivedAt === null
              ? t({ message: "Archive", context: "Archive a project" })
              : t`Unarchive`}
          </Button>
          <Button onClick={onDelete} variant="subtle">
            {t`Delete`}
          </Button>
        </>
      }
    />
  );
}

/** The fields create and edit share; an edit's fields may be missing (D329). */
interface ProjectDraft {
  title: string | null | undefined;
  description: string | null | undefined;
  icon: string | null | undefined;
  color: string | null | undefined;
}

function ProjectFields({
  form,
  onCancel,
  actions,
}: {
  readonly form: OperationForm<ProjectDraft>;
  readonly onCancel: () => void;
  readonly actions?: ReactNode;
}) {
  const { t } = useLingui();
  return (
    <EditDrawerForm form={form} onCancel={onCancel} actions={actions}>
      <TextField form={form} name="title" label={t`Title`} />
      <LongTextField form={form} name="description" label={t`Description`} />
      <IconField form={form} name="icon" label={t`Icon`} />
      <ColorField form={form} name="color" label={t`Color`} />
    </EditDrawerForm>
  );
}
