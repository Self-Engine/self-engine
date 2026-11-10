import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import type { PersonCommand } from "./commands.ts";
import { useStartCommand } from "./start-command.tsx";

export function PrimaryAction({
  moduleId,
  action,
}: {
  readonly moduleId: string;
  readonly action: PersonCommand;
}) {
  const { i18n } = useLingui();
  const start = useStartCommand();
  return <Button onClick={() => void start(moduleId, action)}>{i18n._(action.label)}</Button>;
}
