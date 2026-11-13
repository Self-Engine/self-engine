// The rows of the View Data (D94, D198): take a Backup of the database now, and restore one. Both
// go through the Operation hook (D251), so a failure is announced by the data building block.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { Alert, Box, Button, Group, Stack, Text } from "@mantine/core";
import { useDataAccess } from "@self-engine/data-client/react";
import { ErrorIcon } from "@self-engine/icons";
import { roleColor } from "@self-engine/theme";
import { deviceTimeZone, formatInstant, type TimeZone } from "@self-engine/time";
import { notifyDone, notifyUndoable, QueryStateBlock } from "@self-engine/ui";
import { memo, useCallback, useState } from "react";
import {
  type Backup,
  restoreBackup,
  useBackupList,
  useCreateBackup,
  useReloadBackups,
  useRestoreBackup,
} from "./backup-port.ts";
import type { SettingsRow, SettingsRowControlProps } from "./row.ts";
import type { Translator } from "./text.ts";
import { VIEW_IDS } from "./views.ts";

/** Why a Backup was taken, as its line says it. */
const KIND_NAMES: Readonly<Record<Backup["kind"], MessageDescriptor>> = {
  daily: msg`Daily backup`,
  "before-migration": msg`Before an update`,
  manual: msg`Created by you`,
  "before-restore": msg`Before a restore`,
};

/** What `i18n.number` needs of Lingui's `i18n`, so a test can pass a plain formatter. */
interface NumberFormatter {
  number(value: number, format?: Intl.NumberFormatOptions): string;
}

/** The size of a Backup's file in the unit that reads best, in the language shown. */
export function backupSize(bytes: number, i18n: NumberFormatter): string {
  const [value, unit] =
    bytes < 1_000_000
      ? [bytes / 1000, "kilobyte"]
      : bytes < 1_000_000_000
        ? [bytes / 1_000_000, "megabyte"]
        : [bytes / 1_000_000_000, "gigabyte"];
  return i18n.number(value, {
    style: "unit",
    unit,
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
}

/** When a Backup was taken, in the language shown and the zone given. */
export function backupTime(
  backup: Pick<Backup, "takenAt">,
  { locale }: Translator,
  timeZone: TimeZone,
): string {
  return formatInstant(backup.takenAt, "dateTime", locale, timeZone);
}

/** Mantine's alert in the theme's warning roles, which its own `color` cannot name. */
const WARNING_VARS = () => ({
  root: {
    "--alert-bg": roleColor("warningSoft"),
    "--alert-color": roleColor("warningText"),
    "--alert-bd": "none",
  },
});

/**
 * Shown while the automatic Backups fail (D94): nobody asked for them, so nobody would be told.
 * It goes when the next Backup succeeds, whoever asked for it.
 */
function AutomaticBackupFailed() {
  return (
    // Its own line below the title and the button.
    <Alert
      flex="1 1 100%"
      // The icon the app already loads at startup: one of its own would add 3.3 KB there.
      icon={<ErrorIcon />}
      title={<Trans>The last automatic backup failed</Trans>}
      vars={WARNING_VARS}
    >
      <Trans>
        Your data is not being backed up at the moment. Check that this device has free disk space.
        The app tries again within the hour, and "Create backup now" tries at once.
      </Trans>
    </Alert>
  );
}

function CreateBackup({ labelledBy }: SettingsRowControlProps) {
  const list = useBackupList();
  const { run, running } = useCreateBackup();
  const reload = useReloadBackups();
  const create = async () => {
    const created = await run({});
    // A failure was announced by the building block.
    if (created.status !== "success") return;
    // The reload also takes the hint away: a Backup that succeeds ends the failure.
    reload();
    notifyDone({ message: <Trans>Backup created.</Trans> });
  };
  return (
    <>
      <Button
        aria-describedby={labelledBy}
        loading={running}
        onClick={() => void create()}
        variant="default"
      >
        <Trans>Create backup now</Trans>
      </Button>
      {"data" in list && list.data.automaticBackupFailed && <AutomaticBackupFailed />}
    </>
  );
}

/**
 * Withdraws the offer to undo the last restore. Kept beside the rows, not in one: the Notice
 * outlives the row when the View changes.
 */
let withdrawUndoOffer: (() => void) | undefined;

interface BackupLineProps {
  readonly backup: Backup;
  /** The zone the Backup's time is shown in. */
  readonly timeZone: TimeZone;
  /** A restore is running: of this Backup, or of another one. */
  readonly restoring: "this" | "another" | undefined;
  readonly onRestore: (backup: Backup) => void;
}

const BackupLine = memo(function BackupLine({
  backup,
  timeZone,
  restoring,
  onRestore,
}: BackupLineProps) {
  const { t, i18n } = useLingui();
  const takenAt = backupTime(backup, i18n, timeZone);
  return (
    <Group component="li" gap="md" justify="space-between" wrap="nowrap">
      <Stack gap={0}>
        <Text>{takenAt}</Text>
        <Text c="dimmed" size="sm">
          {i18n._(KIND_NAMES[backup.kind])} · {backupSize(backup.sizeBytes, i18n)}
        </Text>
      </Stack>
      <Button
        aria-label={t`Restore the backup from ${takenAt}`}
        disabled={restoring === "another"}
        loading={restoring === "this"}
        onClick={() => {
          onRestore(backup);
        }}
        size="compact-sm"
        variant="default"
      >
        <Trans context="Button that restores one backup">Restore</Trans>
      </Button>
    </Group>
  );
});

function RestoreBackup({ labelledBy }: SettingsRowControlProps) {
  const state = useBackupList();
  const { run } = useRestoreBackup();
  const reload = useReloadBackups();
  const data = useDataAccess();
  const [restoring, setRestoring] = useState<Backup["id"]>();
  // TODO #110: the zone the user picked. Until that Setting exists, the device's, read once.
  const [timeZone] = useState(deviceTimeZone);
  // A restore is not asked about first: what it replaces is backed up, so the Notice offers the
  // way back instead (D79).
  const restore = useCallback(
    async (backup: Backup) => {
      setRestoring(backup.id);
      const restored = await run({ id: backup.id });
      setRestoring(undefined);
      // Pruned since the list was read, so the list is behind.
      if (restored.status === "notFound") reload();
      if (restored.status !== "success") return;
      const replaced = restored.data;
      // Of one day only the newest Backup from before a restore is kept, so the Backup that an
      // earlier restore's Notice would restore may be gone now: its offer goes with it.
      withdrawUndoOffer?.();
      withdrawUndoOffer = notifyUndoable({
        message: <Trans>Backup restored.</Trans>,
        // The function form: the undo may be taken after this row has left the screen. Its
        // failures are announced by the building block.
        undo: async () => {
          await restoreBackup(data, { id: replaced.id });
        },
      });
      // The Data Process starts anew on the restored database, and the reconnect reloads every
      // answer on the page, this list among them (D250).
    },
    [run, reload, data],
  );
  const onRestore = useCallback((backup: Backup) => void restore(backup), [restore]);
  return (
    // Its own line below the title: a list does not fit beside it.
    <Box flex="1 1 100%">
      <QueryStateBlock state={state}>
        {({ backups }) =>
          backups.length === 0 ? (
            <Text c="dimmed" size="sm">
              <Trans>There is no backup yet.</Trans>
            </Text>
          ) : (
            <Stack
              aria-labelledby={labelledBy}
              component="ul"
              gap="sm"
              m={0}
              p={0}
              style={{ listStyle: "none" }}
            >
              {backups.map((backup) => (
                <BackupLine
                  backup={backup}
                  key={backup.id}
                  onRestore={onRestore}
                  timeZone={timeZone}
                  restoring={
                    restoring === undefined
                      ? undefined
                      : restoring === backup.id
                        ? "this"
                        : "another"
                  }
                />
              ))}
            </Stack>
          )
        }
      </QueryStateBlock>
    </Box>
  );
}

/** The rows of the View Data. */
export const BACKUP_ROWS: readonly SettingsRow[] = [
  {
    id: "create-backup",
    view: VIEW_IDS.data,
    title: msg`Backups`,
    description: msg`Your data is backed up once a day and before an update changes it. Of the last 7 days one backup per day and reason is kept, and one per week for the 4 weeks before.`,
    searchWords: [msg`Save a copy`, msg`Safety copy`],
    values: [],
    control: CreateBackup,
  },
  {
    id: "restore-backup",
    view: VIEW_IDS.data,
    title: msg`Restore a backup`,
    description: msg`Replaces all your data with the data of a backup. Your current data is backed up first, so you can go back.`,
    searchWords: [msg`Recover`, msg`Roll back`],
    values: Object.values(KIND_NAMES),
    control: RestoreBackup,
  },
];
