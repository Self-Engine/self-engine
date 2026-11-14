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
import { useDeleteWithUndo } from "./delete-with-undo.tsx";
import { NEW_PROJECT_ID } from "./project-address.ts";
import {
  ACTIVE_PROJECTS,
  type Project,
  useActiveProjects,
  useCreateProject,
  useEditProject,
} from "./port.ts";

/**
 * The Edit Drawer of `projects`. It loads on demand with the Contract, whose input schema the form
 * checks with (D317). A stored project is found in the list Query: there is no Query for one id.
 */
export default function EditDrawer(props: EditDrawerProps) {
  if (props.id === NEW_PROJECT_ID) return <CreateForm {...props} />;
  return <StoredProjectDrawer {...props} />;
}

function StoredProjectDrawer(props: EditDrawerProps) {
  return (
    <QueryStateBlock state={useActiveProjects(ACTIVE_PROJECTS)}>
      {(projects) => (
        <FoundProject {...props} found={projects.find((project) => project.id === props.id)} />
      )}
    </QueryStateBlock>
  );
}

/**
 * Keeps the last project it found, so that one deleted elsewhere stays readable with the warning
 * (D324), and one deleted here stays through the closing transition without it (#132).
 */
function FoundProject({
  found,
  ...props
}: EditDrawerProps & { readonly found: Project | undefined }) {
  const remove = useDeleteWithUndo();
  const [last, setLast] = useState(found);
  if (found !== undefined && found !== last) setLast(found);
  const [deletedHere, setDeletedHere] = useState(false);
  const project = found ?? last;
  if (project === undefined) return <NotFound {...props} />;
  return (
    <EditForm
      {...props}
      project={project}
      deleted={found === undefined && !deletedHere}
      onDelete={() => {
        setDeletedHere(true);
        void remove(project.id);
        props.onDone();
      }}
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
  onDelete,
  onCancel,
  onDone,
}: EditDrawerProps & {
  readonly project: Project;
  readonly deleted: boolean;
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
        <Button onClick={onDelete} variant="subtle">
          {t`Delete`}
        </Button>
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
