import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import { clearanceQueryFor, type ClearanceQuery } from "@self-engine/data-client/react";
import type { TablesOf } from "@self-engine/db";
import {
  ClearanceAction,
  ColorField,
  type Draft,
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
import { useLayoutEffect, useRef, useState } from "react";
import type { z } from "zod";
import {
  type ProjectId,
  projectFields,
  projectIdSchema,
  projectsContract,
} from "./contracts/index.ts";
import type { projectsRowMap } from "./data/rows.ts";
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
import {
  useArchiveWithoutUndo,
  useArchiveWithUndo,
  useDeleteWithUndo,
  useUnarchiveWithUndo,
} from "./with-undo.tsx";

const projectClearance = clearanceQueryFor<TablesOf<typeof projectsRowMap>>();
const ARCHIVE_PROJECT = msg({ message: "Archive", context: "Archive a project" });

/**
 * The Edit Drawer of `projects`. It loads on demand with the Contract, whose input schema the form
 * checks with (D317). A stored project is found in the two list Queries, "Active" and "Archive":
 * there is no Query for one id.
 */
export default function EditDrawer(props: EditDrawerProps) {
  if (props.id === NEW_PROJECT_ID) return <CreateForm {...props} />;
  return <StoredProjectDrawer {...props} />;
}

const withId = (projects: readonly Project[], id: ProjectId) =>
  projects.find((project) => project.id === id);

function StoredProjectDrawer(props: EditDrawerProps) {
  // The address is text: one that is no project id finds no project.
  const id = projectIdSchema.safeParse(props.id).data;
  const active = useActiveProjects(ACTIVE_PROJECTS);
  const archived = useArchivedProjects(ARCHIVED_PROJECTS);
  return (
    <QueryStateBlock state={active}>
      {(activeProjects) => (
        <QueryStateBlock state={archived}>
          {(archivedProjects) => (
            <FoundProject
              {...props}
              found={
                id === undefined
                  ? undefined
                  : (withId(activeProjects, id) ?? withId(archivedProjects, id))
              }
            />
          )}
        </QueryStateBlock>
      )}
    </QueryStateBlock>
  );
}

/**
 * Keeps the last project it found, so that one deleted elsewhere stays readable with the warning
 * (D324). Once "Archive", "Unarchive" or "Delete" was chosen here, it keeps that project as it was
 * until the drawer has closed (#132): the project moves between the two lists, or leaves both,
 * and the closing drawer shows neither "not found", the warning nor the other button.
 *
 * The drawer closes when the Operation has succeeded and offers undo in a Notice. A failed one
 * leaves it open with what was typed. "Archive" and "Unarchive" keep the project, so they ask
 * before they discard a change like any other way out; a delete asks nothing.
 */
function FoundProject({
  found,
  ...props
}: EditDrawerProps & { readonly found: Project | undefined }) {
  const remove = useDeleteWithUndo();
  const archive = useArchiveWithUndo();
  const archiveWithoutUndo = useArchiveWithoutUndo();
  const unarchive = useUnarchiveWithUndo();
  const [last, setLast] = useState(found);
  const [leaving, setLeaving] = useState(false);
  // The lock of a named Operation. A ref beside the state: two activations in one tick both
  // read the state before it changes.
  const busy = useRef(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!leaving && found !== undefined && found !== last) setLast(found);
  const project = leaving ? last : (found ?? last);
  // What the open drawer knows of the stored project now, for an action that runs later.
  const shownActive = useRef(false);
  useLayoutEffect(() => {
    shownActive.current = found?.archivedAt === null;
  });
  if (project === undefined) return <NotFound {...props} />;
  const leave = (operation: () => Promise<boolean>, asks: boolean) => async () => {
    if (busy.current) return;
    busy.current = true;
    const goes = !asks || (await props.confirmDiscard());
    if (goes) setLeaving(true);
    // Once the project is left, the lock stays: the drawer is closing.
    if (goes && (await operation())) return props.onDone();
    busy.current = false;
    setLeaving(false);
  };
  const active = project.archivedAt === null;
  const archiveOrUnarchive = leave(
    () => (active ? archive : unarchive)(project.id, { entry: project.title }),
    true,
  );
  const archiveHere = () => void archiveOrUnarchive();
  // The Notice of a refused delete can outlive what the drawer knows. Only while the drawer is
  // open and still shows the project active does its Archive change what the person saw, and
  // offer the undo; otherwise the project may be archived already, by someone else, and an undo
  // would unarchive that. Closed, also while it still slides out, the drawer vouches for nothing,
  // and it never asks to discard a draft in another drawer. Asked again right before the write:
  // the project may be archived elsewhere while the question is open.
  const vouchesForArchive = () => mounted.current && props.isOpen() && shownActive.current;
  const archiveWithoutUndoHere = () => archiveWithoutUndo(project.id, { entry: project.title });
  const archiveFromNotice = () => {
    if (!vouchesForArchive()) {
      void archiveWithoutUndoHere();
      return;
    }
    void leave(
      () =>
        vouchesForArchive()
          ? archive(project.id, { entry: project.title })
          : archiveWithoutUndoHere(),
      true,
    )();
  };
  const deleteHere = leave(
    () =>
      remove(project.id, {
        entry: project.title,
        ...(active && { action: { label: ARCHIVE_PROJECT, run: archiveFromNotice } }),
      }),
    false,
  );
  return (
    <EditForm
      {...props}
      project={project}
      deleted={found === undefined && !leaving}
      onArchive={archiveHere}
      onDelete={() => void deleteHere()}
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
  const { t, i18n } = useLingui();
  useEditDrawerTitle(project.title);
  const archiveWrite = project.archivedAt === null ? "archive" : "unarchive";
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
    entryName: project.title,
    onDone,
  });
  return (
    <ProjectFields
      form={form}
      onCancel={onCancel}
      clearance={projectClearance({
        table: "projects",
        rows: [project.id],
        writes: ["delete", archiveWrite],
      })}
      actions={
        // Named Operations, never fields (D322, D323): archiving locks nothing, so an archived
        // project is edited and deleted here like an active one.
        <>
          <ClearanceAction write={archiveWrite} onClick={onArchive} variant="subtle">
            {archiveWrite === "archive" ? i18n._(ARCHIVE_PROJECT) : t`Unarchive`}
          </ClearanceAction>
          <ClearanceAction write="delete" onClick={onDelete} variant="subtle">
            {t`Delete`}
          </ClearanceAction>
        </>
      }
    />
  );
}

/** The fields create and edit share, from the one field list (ADR 0032); an edit's may be missing. */
type ProjectDraft = Omit<Draft<z.input<typeof projectFields.edit>>, "id">;

function ProjectFields({
  form,
  onCancel,
  actions,
  clearance,
}: {
  readonly form: OperationForm<ProjectDraft>;
  readonly onCancel: () => void;
  readonly actions?: ReactNode;
  readonly clearance?: ClearanceQuery & { readonly rows: readonly [string] };
}) {
  const { t } = useLingui();
  return (
    <EditDrawerForm
      form={form}
      onCancel={onCancel}
      actions={actions}
      {...(clearance && { clearance })}
    >
      <TextField form={form} name="title" label={t`Title`} />
      <LongTextField form={form} name="description" label={t`Description`} />
      <IconField form={form} name="icon" label={t`Icon`} />
      <ColorField form={form} name="color" label={t`Color`} />
    </EditDrawerForm>
  );
}
