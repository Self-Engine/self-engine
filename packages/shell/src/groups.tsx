import { ACTIVE_ENTRY_VARS } from "./navigation-style.ts";
import { NavLink, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useCloseOverlayOnPick, useShellRouting } from "./routing.tsx";
import type { ViewSearch } from "./view-search.ts";

export function ShellGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Stack gap={0} role="group" aria-label={title}>
      <Text size="xs" fw={600} p="xs">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

export function ShellGroupEntry({
  label,
  search,
  active = false,
}: {
  readonly label: string;
  readonly search: ViewSearch | ((previous: ViewSearch) => ViewSearch);
  readonly active?: boolean;
}) {
  const { Link } = useShellRouting();
  const closeOverlay = useCloseOverlayOnPick();
  return (
    <NavLink
      component={Link}
      to="."
      search={search}
      label={label}
      vars={ACTIVE_ENTRY_VARS}
      active={active}
      aria-current={active ? "true" : undefined}
      onClick={closeOverlay}
    />
  );
}
