import { useLingui } from "@lingui/react/macro";
import { ShellGroup, ShellGroupEntry } from "@self-engine/shell";
import { clients, useClientFilter } from "./sample-data.ts";

export default function Groups() {
  const { i18n, t } = useLingui();
  const client = useClientFilter();
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
