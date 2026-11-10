import { useLingui } from "@lingui/react/macro";
import { Button, Stack, Text } from "@mantine/core";
import { useRef, useState } from "react";
import type { ShellCommand } from "./contributions.ts";
import { useShellRouting } from "./routing.tsx";

/** Give it a key per page: its capability and its message belong to the page it was pressed on. */
export function PrimaryAction({ action }: { readonly action: ShellCommand }) {
  const { i18n, t } = useLingui();
  const address = useShellRouting().useAddress();
  const running = useRef(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setFailed(false);
    const writeSearch = address.scopedWriteSearch();
    try {
      const command = await action.load();
      await command.default({ writeSearch });
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      running.current = false;
    }
  };

  return (
    <Stack gap={4}>
      <Button onClick={() => void run()}>{i18n._(action.label)}</Button>
      {failed && (
        <Text role="alert" size="sm">
          {t`The action could not be completed. Please try again.`}
        </Text>
      )}
    </Stack>
  );
}
