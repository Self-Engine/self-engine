import { useLingui } from "@lingui/react";
import { Box, Button, type ButtonProps, type ElementProps, Stack } from "@mantine/core";
import {
  type Clearance,
  type ClearanceQuery,
  type ClearanceWrite,
  useClearance,
  useReasonTexts,
} from "@self-engine/data-client/react";
import { createContext, type ReactNode, use, useId } from "react";

interface ActionClearance {
  readonly requested: readonly ClearanceWrite[];
  readonly loading: boolean;
  readonly writes: Partial<Record<ClearanceWrite, Clearance>>;
  readonly descriptionId: (write: ClearanceWrite) => string;
}

const Context = createContext<ActionClearance | null>(null);

/** One row's Clearance, shared by the named actions in an Edit Drawer. */
export function EditActionClearance({
  query,
  children,
}: {
  readonly query: ClearanceQuery;
  readonly children: ReactNode;
}) {
  const { i18n } = useLingui();
  const texts = useReasonTexts();
  const state = useClearance(query);
  const id = useId();
  const writes =
    state.status === "content"
      ? (state.data.find(({ row }) => row === query.rows[0])?.writes ?? {})
      : {};
  const descriptionId = (write: ClearanceWrite) => `${id}-${write}`;
  const explanations = query.writes.map((write) => {
    const answer = writes[write];
    if (answer?.state !== "blocked") return null;
    return (
      <div key={write} id={descriptionId(write)}>
        {answer.reasons.map((reason) => texts.describe(reason, i18n)).join(" ")}
      </div>
    );
  });
  return (
    <Context
      value={{
        requested: query.writes,
        loading: state.status === "loading",
        writes,
        descriptionId,
      }}
    >
      <Stack mt="auto" gap="xs">
        {children}
        {/* Mounted before the answer so changes are announced. Reserve the same space in all
            states, with scrolling available for longer texts. */}
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          fz="sm"
          style={{ blockSize: "4.5em", overflow: "auto", overflowWrap: "anywhere" }}
        >
          {explanations}
        </Box>
      </Stack>
    </Context>
  );
}

export interface ClearanceActionProps
  extends ButtonProps, ElementProps<"button", keyof ButtonProps> {
  readonly write: ClearanceWrite;
}

/**
 * A button for one kind of write in the Edit Drawer's action slot. While waiting it keeps its
 * usual look and ignores activation. A blocked answer disables it and describes it with the
 * same text the live region announces. A free answer uses the caller's button props unchanged.
 */
export function ClearanceAction({
  write,
  disabled,
  onClick,
  "aria-describedby": describedBy,
  ...props
}: ClearanceActionProps) {
  const clearance = use(Context);
  const waiting = clearance?.loading && clearance.requested.includes(write);
  const blocked = clearance?.writes[write]?.state === "blocked";
  const description = blocked
    ? [describedBy, clearance.descriptionId(write)].filter(Boolean).join(" ")
    : describedBy;
  return (
    <Button
      {...props}
      type="button"
      disabled={disabled || blocked}
      aria-disabled={waiting || props["aria-disabled"]}
      aria-describedby={description}
      onClick={waiting ? undefined : onClick}
    />
  );
}
