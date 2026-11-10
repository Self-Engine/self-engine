import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import type { PersonCommand } from "./commands.ts";
import { useStartCommand } from "./start-command.tsx";

export function PrimaryAction({
  moduleId,
  command,
}: {
  readonly moduleId: string;
  readonly command: PersonCommand;
}) {
  const { i18n } = useLingui();
  const start = useStartCommand();
  return <Button onClick={() => void start(moduleId, command)}>{i18n._(command.label)}</Button>;
}
