import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ShellGroup, ShellGroupEntry, useViewSearch } from "@self-engine/shell";

/**
 * The module's groups, the template for a search shared by its Views (`sharedSearch`). A group
 * only changes the address; the entries belong to no client, so the list shows them all (D262).
 */
const clients = [
  { id: "studio", name: msg`Studio` },
  { id: "garden", name: msg`Garden` },
];

/** Unknown or malformed values mean all clients. */
function useClient() {
  return useViewSearch((search) =>
    clients.some(({ id }) => id === search.client) ? String(search.client) : undefined,
  );
}

export default function Groups() {
  const { i18n, t } = useLingui();
  const client = useClient();
  return (
    <ShellGroup title={t`Clients`}>
      <ShellGroupEntry
        label={t`All clients`}
        search={(search) => ({ ...search, client: undefined })}
        active={!client}
      />
      {clients.map(({ id, name }) => (
        <ShellGroupEntry
          key={id}
          label={i18n._(name)}
          search={(search) => ({ ...search, client: id })}
          active={client === id}
        />
      ))}
    </ShellGroup>
  );
}
