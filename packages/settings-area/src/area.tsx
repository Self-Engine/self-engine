// Everything of the settings area that loads when the settings are first opened: one chunk for all
// Views, because the search needs the controls of every View (D202).

import type { I18n, MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { CloseButton, Divider, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { SearchIcon } from "@self-engine/icons";
import type { SettingsStore } from "@self-engine/settings";
import { useTypedViewSearch, type ViewPageProps } from "@self-engine/shell";
import { EmptyState } from "@self-engine/ui";
import { type ComponentType, Fragment, memo, useId, useMemo, useRef } from "react";
import type { SettingsRow } from "./row.ts";
import { type SettingsRowSources, settingsRows } from "./rows.tsx";
import { type HitGroup, searchedRows, searchHits } from "./search.ts";
import { SEARCH_PARAMETER } from "./views.ts";

interface RowProps {
  readonly row: SettingsRow;
  readonly store: SettingsStore;
}

/**
 * One Settings Row as every page shows it: its title and description, then its control.
 * Remembered, so that typing in the search draws only the rows that appear.
 */
export const Row = memo(function Row({ row, store }: RowProps) {
  const { i18n } = useLingui();
  const titleId = useId();
  const Control = row.control;
  return (
    <Group gap="md" justify="space-between" py="md">
      <Stack flex="1 1 16rem" gap={2}>
        <Text fw={500} id={titleId}>
          {i18n._(row.title)}
        </Text>
        {row.description && (
          <Text c="dimmed" size="sm">
            {i18n._(row.description)}
          </Text>
        )}
      </Stack>
      <Control labelledBy={titleId} store={store} />
    </Group>
  );
});

interface SearchFieldProps {
  readonly value: string;
  readonly onChange: (text: string) => void;
}

function SearchField({ value, onChange }: SearchFieldProps) {
  const { t } = useLingui();
  const field = useRef<HTMLInputElement>(null);
  const name = t`Search settings`;
  return (
    <TextInput
      aria-label={name}
      leftSection={<SearchIcon size="sm" />}
      onChange={(event) => {
        onChange(event.currentTarget.value);
      }}
      placeholder={name}
      ref={field}
      rightSection={
        value !== "" && (
          <CloseButton
            aria-label={t`Clear search`}
            onClick={() => {
              onChange("");
              field.current?.focus();
            }}
            size="sm"
          />
        )
      }
      role="searchbox"
      value={value}
    />
  );
}

interface RowGroupProps {
  readonly rows: readonly SettingsRow[];
  readonly store: SettingsStore;
  /** The View's title above its hits; the page of a View has it in the content header. */
  readonly title: string | undefined;
}

/** The rows that share a heading within their View, in the order of the list. */
function subgroupsOf(rows: readonly SettingsRow[]) {
  const subgroups = new Map<string, { heading?: MessageDescriptor; rows: SettingsRow[] }>();
  // Rows without a heading come first, whatever the order of the hits. No group has the empty key.
  subgroups.set("", { rows: [] });
  for (const row of rows) {
    const key = row.group?.key ?? "";
    const known = subgroups.get(key);
    if (known) known.rows.push(row);
    else subgroups.set(key, { ...(row.group && { heading: row.group.heading }), rows: [row] });
  }
  return [...subgroups].flatMap(([key, subgroup]) =>
    subgroup.rows.length > 0 ? [{ key, ...subgroup }] : [],
  );
}

interface RowListProps {
  readonly rows: readonly SettingsRow[];
  readonly store: SettingsStore;
}

function RowList({ rows, store }: RowListProps) {
  return rows.map((row, index) => (
    <Fragment key={row.id}>
      {index > 0 && <Divider />}
      <Row row={row} store={store} />
    </Fragment>
  ));
}

function Subgroup({
  heading,
  order,
  ...rows
}: RowListProps & { readonly heading: string; readonly order: 2 | 3 }) {
  const headingId = useId();
  return (
    <Stack aria-labelledby={headingId} component="section" gap={0}>
      <Title c="dimmed" id={headingId} order={order} pt="md" size="h6">
        {heading}
      </Title>
      <RowList {...rows} />
    </Stack>
  );
}

function RowGroup({ rows, store, title }: RowGroupProps) {
  const { i18n } = useLingui();
  const titleId = useId();
  return (
    <Stack aria-labelledby={title === undefined ? undefined : titleId} component="section" gap={0}>
      {title !== undefined && (
        <Title id={titleId} order={2} pt="md" size="h5">
          {title}
        </Title>
      )}
      {subgroupsOf(rows).map(({ key, heading, rows: together }) =>
        heading ? (
          <Subgroup
            heading={i18n._(heading)}
            key={key}
            // Below the View's title: the content header's on its page, the one above its hits.
            order={title === undefined ? 2 : 3}
            rows={together}
            store={store}
          />
        ) : (
          <RowList key={key} rows={together} store={store} />
        ),
      )}
    </Stack>
  );
}

interface TitledView {
  readonly id: string;
  readonly title: MessageDescriptor;
}

export interface SettingsPageProps {
  /** The id of the View of the address, shown while nothing is searched for. */
  readonly view: string;
  /** The area's Views, whose titles stand above their hits. */
  readonly views: readonly TitledView[];
  readonly rows: readonly SettingsRow[];
  readonly store: SettingsStore;
  readonly search: string;
  readonly onSearch: (text: string) => void;
}

/**
 * The page of every View (D199): the search field, and below it the View's rows or, with a search
 * text, the matching rows of all Views with their working controls.
 */
export function SettingsPage({ view, views, rows, store, search, onSearch }: SettingsPageProps) {
  const { t, i18n } = useLingui();
  // The texts are translated once per language and not per key press. `i18n` may stay the same
  // object when the language changes, so its language is named too.
  const searched = useMemo(
    () => searchedRows(rows, i18n),
    [rows, i18n, i18n.locale],
  );
  const ofView = useMemo<readonly HitGroup<SettingsRow>[]>(
    () => [{ view, rows: rows.filter((row) => row.view === view) }],
    [rows, view],
  );
  const hits = useMemo(() => searchHits(searched, search), [searched, search]);
  return (
    <Stack gap="xs" maw="48rem">
      <SearchField onChange={onSearch} value={search} />
      {hits?.length === 0 ? (
        <EmptyState
          description={t`Try another word, or clear the search.`}
          icon={SearchIcon}
          title={t`No settings found`}
        />
      ) : (
        // A View's rows and its hits are one group with the same key, so a row that stays when
        // the search starts is not drawn again.
        (hits ?? ofView).map((group) => (
          <RowGroup
            key={group.view}
            rows={group.rows}
            store={store}
            title={hits && titleOf(views, group.view, i18n)}
          />
        ))
      )}
    </Stack>
  );
}

function titleOf(views: readonly TitledView[], id: string, i18n: I18n) {
  const view = views.find((candidate) => candidate.id === id);
  // A row's View is one of the area's, which the test over the real list checks.
  return view ? i18n._(view.title) : id;
}

/**
 * The one page of the area, which every View shows at its address: the list of rows is built once,
 * and a change of View during a search leaves the hits as they are.
 */
export function settingsPage({
  store,
  views,
  ...sources
}: SettingsRowSources & {
  readonly store: SettingsStore;
  readonly views: readonly TitledView[];
}): ComponentType<ViewPageProps> {
  const rows = settingsRows(sources);
  return function SettingsViewPage({ viewId }) {
    // In the address, so that the text survives reload, a change of View and coming back.
    const [search, onSearch] = useTypedViewSearch(SEARCH_PARAMETER);
    return (
      <SettingsPage
        onSearch={onSearch}
        rows={rows}
        search={search}
        store={store}
        view={viewId}
        views={views}
      />
    );
  };
}
