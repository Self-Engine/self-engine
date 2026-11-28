import { type OperationForm, typedMemo, useFieldBinding } from "@self-engine/forms";
import type { ProjectReference } from "@self-engine/projects/contracts";
import type { ProjectId } from "@self-engine/projects/ids";
import { ProjectPicker } from "@self-engine/projects/picker";
import { type EntryDraft, withLeadProject } from "./entry-draft.ts";

/**
 * The Lead Project of an entry as one picker, bound to the draft's list of projects: the picker
 * changes the Lead Project and leaves the other projects alone (`withLeadProject`). The form sends
 * the list only once the user changed it, so saving other fields keeps an entry's projects and
 * Weights. The surface for several projects is #423.
 */
export const LeadProjectField = typedMemo(function LeadProjectField({
  form,
  current,
  label,
}: {
  readonly form: OperationForm<EntryDraft>;
  /** The Lead Project of the stored entry, so an archived or deleted one shows as such. */
  readonly current: ProjectReference | null;
  readonly label: string;
}) {
  const field = useFieldBinding(form, "projects");
  const projects = field.value ?? [];
  return (
    <div ref={field.ref}>
      <ProjectPicker
        clearable
        current={current}
        error={field.error}
        label={label}
        onBlur={field.onBlur}
        onChange={(id) => field.onChange(withLeadProject(projects, id))}
        // A draft holds a stored id as plain text (`Draft` of `forms` brands only a field's own
        // value, not the items of a list); the picker takes it back as the project id it came
        // from, as the project field of `projects` does.
        value={(projects[0]?.projectId ?? null) as ProjectId | null}
      />
    </div>
  );
});
