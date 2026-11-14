import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack } from "@mantine/core";
import {
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useSyncExternalStore,
} from "react";
import { useUnsavedChanges } from "@self-engine/shell";
import { WarningAlert } from "@self-engine/ui";
import { bindingOf, type FormBinding, type OperationForm } from "./operation-form.ts";

export interface OperationFormBodyProps {
  readonly form: OperationForm<unknown>;
  readonly children: ReactNode;
}

/**
 * Says that the entry the form edits was deleted elsewhere (D324), while it is: the fields stay,
 * so the user can still read and copy what they typed, but nothing saves.
 */
function DeletedEntryMessage({ binding }: { readonly binding: FormBinding }) {
  const { t } = useLingui();
  const deleted = useSyncExternalStore(binding.subscribeChanged, binding.isDeleted);
  if (!deleted) return null;
  return (
    <WarningAlert mb="md" title={t`This entry was deleted`}>
      {t`You can still read and copy what you typed here, but it can no longer be saved.`}
    </WarningAlert>
  );
}

/**
 * The shared lock, submit and keys, also for a form outside the Edit Drawer, and the message for
 * an entry deleted while the form is open.
 */
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
        <DeletedEntryMessage binding={binding} />
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
  const binding = bindingOf(form);
  const canSubmit = useSyncExternalStore(binding.subscribeChanged, binding.canSubmit);
  useUnsavedChanges(binding.isChanged);
  return (
    <OperationFormBody form={form}>
      <Stack flex={1}>
        {children}
        <Group justify="flex-end" mt="auto">
          {actions && <Group me="auto">{actions}</Group>}
          <Button type="button" variant="default" onClick={onCancel}>{t`Cancel`}</Button>
          <Button type="submit" disabled={!canSubmit}>{t`Save`}</Button>
        </Group>
      </Stack>
    </OperationFormBody>
  );
}
