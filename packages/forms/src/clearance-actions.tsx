import { useLingui } from "@lingui/react";
import { Box, Button, type ButtonProps, type ElementProps } from "@mantine/core";
import {
  type Clearance,
  type ClearanceQuery,
  type ClearanceWrite,
  describeReasons,
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
  const explanations = query.writes.flatMap((write) => {
    const answer = writes[write];
    if (answer?.state !== "blocked") return [];
    return [
      <div key={write} id={descriptionId(write)}>
        {describeReasons(texts, answer.reasons, i18n)}
      </div>,
    ];
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
      {/* Pushed to the bottom of the drawer with the footer. A blocked action's text takes its
          room above the footer, from the free space below the fields: while the fields do not
          fill the drawer, its arrival moves nothing. The live region is mounted before the
          answer, empty and without height, so the text is announced when it arrives. */}
      <Box mt="auto">
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          fz="sm"
          mb={explanations.length > 0 ? "xs" : 0}
          style={{ overflowWrap: "anywhere" }}
        >
          {explanations}
        </Box>
        {children}
      </Box>
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
