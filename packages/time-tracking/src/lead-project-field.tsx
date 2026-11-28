import { type FieldName, type OperationForm, typedMemo, useFieldBinding } from "@self-engine/forms";
import type { ProjectReference } from "@self-engine/projects/contracts";
import type { ProjectId } from "@self-engine/projects/ids";
import { ProjectPicker } from "@self-engine/projects/picker";

/** The draft's list of projects, as create and edit take it. */
type ProjectsDraft = { readonly projectId: string; readonly weight?: number | undefined }[] | null;

/**
 * The project of an entry as one picker, bound to the draft's list of projects: it shows the Lead
 * Project, and a choice makes the list that one project, a cleared choice the empty list. The
 * form sends the list only once the user changed it, so an entry with several projects, which
 * only the Port makes so far, keeps them while other fields are saved. The surface for several
 * projects is #423.
 */
export const LeadProjectField = typedMemo(function LeadProjectField<
  FormDraft extends { readonly projects?: ProjectsDraft | undefined },
>({
  form,
  current,
  label,
}: {
  readonly form: OperationForm<FormDraft>;
  /** The Lead Project of the stored entry, so an archived or deleted one shows as such. */
  readonly current: ProjectReference | null;
  readonly label: string;
}) {
  const field = useFieldBinding(form, "projects" as FieldName<FormDraft>);
  const projects = field.value as ProjectsDraft;
  return (
    <div ref={field.ref}>
      <ProjectPicker
        clearable
        current={current}
        error={field.error}
        label={label}
        onBlur={field.onBlur}
        onChange={(id) =>
          field.onChange(
            (id === null ? [] : [{ projectId: id }]) as FormDraft[FieldName<FormDraft>],
          )
        }
        // A draft holds a stored id as plain text (`Draft` of `forms`); the field takes it back as
        // the project id it came from, as the project field of `projects` does.
        value={(projects?.[0]?.projectId ?? null) as ProjectId | null}
      />
    </div>
  );
});
