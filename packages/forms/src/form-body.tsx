import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack } from "@mantine/core";
import {
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useSyncExternalStore,
} from "react";
import { bindingOf, type OperationForm } from "./operation-form.ts";

export interface OperationFormBodyProps {
  readonly form: OperationForm<unknown>;
  readonly children: ReactNode;
}

/** The shared lock, submit and keys, also for a form outside the Edit Drawer. */
export function OperationFormBody({ form, children }: OperationFormBodyProps) {
  const binding = bindingOf(form);
  const running = useSyncExternalStore(binding.subscribeRunning, binding.isRunning);
  // A picker can render into a portal, outside the disabled fieldset. Its React events still
  // pass here, so it shares the lock without requiring a special API from every picker.
  const blockWhileRunning = (event: SyntheticEvent) => {
    if (!binding.isRunning()) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const keyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target;
    const shortcut = event.ctrlKey || event.metaKey;
    const singleLine =
      target instanceof HTMLInputElement &&
      event.currentTarget.contains(target) &&
      !["button", "submit", "checkbox", "radio", "file"].includes(target.type) &&
      target.getAttribute("aria-expanded") !== "true";
    if (!shortcut && !singleLine) return;
    event.preventDefault();
    void form.submit();
  };
  return (
    <form
      onClickCapture={blockWhileRunning}
      onPointerDownCapture={blockWhileRunning}
      onBeforeInputCapture={blockWhileRunning}
      onPasteCapture={blockWhileRunning}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") blockWhileRunning(event);
      }}
      onKeyDown={keyDown}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
      style={{ display: "flex", flex: 1, flexDirection: "column" }}
    >
      <fieldset
        disabled={running}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: "flex",
          flex: 1,
          flexDirection: "column",
        }}
      >
        {children}
      </fieldset>
    </form>
  );
}

export interface EditDrawerFormProps extends OperationFormBodyProps {
  readonly onCancel: () => void;
  readonly actions?: ReactNode;
}

/** Fields written by the module, with the shared Edit Drawer actions. */
export function EditDrawerForm({ form, onCancel, actions, children }: EditDrawerFormProps) {
  const { t } = useLingui();
  return (
    <OperationFormBody form={form}>
      <Stack flex={1}>
        {children}
        <Group justify="flex-end" mt="auto">
          {actions && <Group me="auto">{actions}</Group>}
          <Button type="button" variant="default" onClick={onCancel}>{t`Cancel`}</Button>
          <Button type="submit">{t`Save`}</Button>
        </Group>
      </Stack>
    </OperationFormBody>
  );
}
