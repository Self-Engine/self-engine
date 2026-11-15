// The project picker (D330): the entry `@self-engine/projects/picker` for the forms of the modules
// above `projects`. It loads with the form that uses it, never at startup: it draws the Entry Mark,
// whose directory of pictures is lazy-only, and the startup check of the web app fails when
// startup code imports this folder.

import { useLingui } from "@lingui/react/macro";
import { type ComboboxItem, Group, Select, type SelectProps, Text } from "@mantine/core";
import {
  type FieldTaking,
  type OperationForm,
  typedMemo,
  useFieldBinding,
} from "@self-engine/forms";
import { ProjectsIcon } from "@self-engine/icons";
import { EntryMark } from "@self-engine/ui/entry-mark";
import { useCallback, useMemo } from "react";
import type { ProjectId, ProjectReference } from "../contracts/index.ts";
import { ACTIVE_PROJECTS, useActiveProjects } from "../port.ts";
import { useSortedByTitle } from "../sorted-by-title.ts";

/** What a project shows in the picker: its mark and its title. */
type Shown = Pick<ProjectReference, "id" | "title" | "icon" | "color">;

/** What the form sets on the picker, or the form's field: a consumer leaves these out. */
type Bound = "value" | "onChange" | "error" | "data" | "defaultValue" | "renderOption";

export type ProjectPickerProps = {
  /** The id of the chosen project, or `null` for no choice. */
  readonly value: ProjectId | null;
  /** Hands on the id of the project the user chose, or `null` once they cleared the choice. */
  readonly onChange: (id: ProjectId | null) => void;
  /**
   * The project the stored entry refers to, as its Query answered it, or `null` for none. The
   * picker shows it while it is chosen, with "archived" or "deleted" where it is no longer active;
   * once another project is chosen it is no longer offered. The picker never asks for a single id.
   */
  readonly current: ProjectReference | null;
  /** A choice can be cleared: give it when the consumer's field is optional. */
  readonly clearable?: boolean;
  readonly error?: string | undefined;
} & Omit<SelectProps, Bound | "clearable">;

/**
 * Chooses one of the active projects, each shown with its Entry Mark and title. It loads them
 * itself with the Query of the View "Active", whose answer is usually in the cache already, and
 * sorts them by title with the App Language's rules. Two projects of the same title both appear;
 * their marks tell them apart.
 */
export function ProjectPicker({
  value,
  onChange,
  current,
  clearable = false,
  error,
  ...props
}: ProjectPickerProps) {
  const { t } = useLingui();
  const state = useActiveProjects(ACTIVE_PROJECTS);
  const active = useSortedByTitle("data" in state ? state.data : NONE);
  // The stored choice joins the list only while it is chosen and not active (D330).
  const kept = current !== null && current.id === value && !active.some(({ id }) => id === value);
  // Deleted outranks archived: the project is gone, whatever else it was.
  const title = current?.title ?? "";
  const keptLabel =
    current === null || (current.deletedAt === null && current.archivedAt === null)
      ? title
      : current.deletedAt === null
        ? t`${title} (archived)`
        : t`${title} (deleted)`;
  const { data, byId } = useMemo(() => {
    const shown: readonly Shown[] = kept && current !== null ? [current, ...active] : active;
    return {
      data: shown.map((project): ComboboxItem => ({
        value: project.id,
        label: kept && project.id === current?.id ? keptLabel : project.title,
      })),
      byId: new Map<string, Shown>(shown.map((project) => [project.id, project])),
    };
  }, [active, current, kept, keptLabel]);
  const renderOption = useCallback(
    ({ option }: { option: ComboboxItem }) => {
      const project = byId.get(option.value);
      return (
        <Group gap="sm" wrap="nowrap">
          <EntryMark
            color={project?.color}
            defaultIcon={ProjectsIcon}
            icon={project?.icon}
            size="sm"
          />
          <Text size="sm" truncate>
            {option.label}
          </Text>
        </Group>
      );
    },
    [byId],
  );
  const chosen = value === null ? undefined : byId.get(value);
  const retry =
    state.status === "loadFailed" || state.status === "reloadFailed" ? state.retry : undefined;
  return (
    <Select
      allowDeselect={clearable}
      // Mantine hides its clear button from the keyboard and screen readers; here it is a button
      // like any other, so clearing needs no mouse.
      clearButtonProps={{ "aria-label": t`Clear the choice`, "aria-hidden": false, tabIndex: 0 }}
      clearable={clearable}
      data={data}
      error={error ?? (retry === undefined ? null : t`The projects could not be loaded.`)}
      leftSection={
        chosen === undefined ? null : (
          <EntryMark color={chosen.color} defaultIcon={ProjectsIcon} icon={chosen.icon} size="sm" />
        )
      }
      nothingFoundMessage={t`No active projects`}
      // Mantine hands on the option's text; the project shown under it holds the branded id.
      onChange={(option) => onChange(option === null ? null : (byId.get(option)?.id ?? null))}
      // Opening the picker again after a failed load tries again.
      {...(retry === undefined ? {} : { onDropdownOpen: retry })}
      renderOption={renderOption}
      searchable
      value={value}
      {...props}
    />
  );
}

const NONE: readonly [] = [];

export type ProjectFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft, and of the Operation's input, that holds the project's id. */
  readonly name: FieldTaking<FormDraft, ProjectId | null>;
} & Omit<ProjectPickerProps, "value" | "onChange" | "error" | "form" | "name">;

/**
 * The project picker as a field of a form of `@self-engine/forms`, bound through its Field
 * Binding: a choice changes the draft, and an edit sends the field only once it changed. The form
 * hands it `current`, the project reference of the stored entry.
 */
export const ProjectField = typedMemo(function ProjectField<FormDraft>({
  form,
  name,
  ...props
}: ProjectFieldProps<FormDraft>) {
  const field = useFieldBinding(form, name);
  return (
    <div ref={field.ref}>
      <ProjectPicker
        {...props}
        error={field.error}
        onBlur={field.onBlur}
        // A draft holds a stored id as plain text (`Draft` of `forms`); the field takes it back as
        // the project id it came from, the one place the brand is restored without a parse.
        onChange={field.onChange as (id: ProjectId | null) => void}
        value={field.value as ProjectId | null}
      />
    </div>
  );
});
