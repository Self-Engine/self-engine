import { ORPCError } from "@orpc/server";
import type { Backup } from "@self-engine/data-protocol";
import { implementer } from "../implementer.ts";

/**
 * The platform's Backups of the database, which the core answers as the protocol's `backups`
 * (D94). The core takes no Backup itself: files and the SQLite driver belong to the platform
 * (D97). The desktop app passes `@self-engine/backup`.
 */
export interface BackupService {
  /** Every Backup that is kept, newest first. */
  list(): Promise<Backup[]>;
  /** Whether the last attempt at an automatic Backup failed and none has succeeded since. */
  automaticBackupFailed(): boolean;
  /** Takes a Backup now. */
  create(): Promise<Backup>;
  /**
   * Prepares the Backup `id` to replace the database when the Data Process starts anew, after
   * backing up what it replaces. The two expected failures are values, not throws (D190).
   */
  restore(
    id: string,
  ): Promise<
    | { readonly status: "restored"; readonly replaced: Backup }
    | { readonly status: "notFound" }
    | { readonly status: "unreadable" }
  >;
}

/**
 * What a platform that keeps Backups gives the core. Both or neither: a restore that is staged
 * without a restart would leave the old database answering, and every write after it would
 * vanish at the next start.
 */
export interface PlatformBackups {
  readonly service: BackupService;
  /**
   * Starts the Data Process anew on the same database file, which puts a restored Backup in
   * place. Called after a restore, once its answer is on the way to the page.
   */
  readonly restart: () => void;
}

export interface BackupProcedureOptions {
  /** Absent on a platform that keeps no Backups: every call then fails. */
  readonly backups: PlatformBackups | undefined;
  /** Where a failure nobody expected goes, with the entry that failed. */
  readonly reportUnexpected: (entry: string, error: unknown) => void;
}

/** The procedures of the protocol's `backups`, over the platform's Backups. */
export function backupProcedures({ backups, reportUnexpected }: BackupProcedureOptions) {
  /** Runs `work` on the Backups and reports what it throws beyond the declared errors. */
  async function reporting<Result>(
    entry: string,
    work: (platform: PlatformBackups) => Promise<Result>,
  ): Promise<Result> {
    try {
      if (backups === undefined) throw new Error("This Data Process keeps no Backups");
      return await work(backups);
    } catch (error) {
      if (!(error instanceof ORPCError)) reportUnexpected(`backups.${entry}`, error);
      throw error;
    }
  }
  return {
    list: implementer.backups.list.handler(() =>
      reporting("list", async ({ service }) => ({
        backups: await service.list(),
        automaticBackupFailed: service.automaticBackupFailed(),
      })),
    ),
    create: implementer.backups.create.handler(() =>
      reporting("create", ({ service }) => service.create()),
    ),
    restore: implementer.backups.restore.handler(({ input, errors }) =>
      reporting("restore", async ({ service, restart }) => {
        const outcome = await service.restore(input.id);
        if (outcome.status === "notFound") throw errors.NOT_FOUND();
        if (outcome.status === "unreadable") {
          throw errors.CONFLICT({ data: { reason: "backup_unreadable" } });
        }
        // In a later task: the answer is posted to the page within this one, and the restart
        // closes the port it travels on.
        setTimeout(restart);
        return outcome.replaced;
      }),
    ),
  };
}
