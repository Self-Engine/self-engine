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

export interface BackupProcedureOptions {
  /** Absent on a platform that keeps no Backups: every call then fails. */
  readonly backups: BackupService | undefined;
  /** Starts the Data Process anew, which puts a restored Backup in place. */
  readonly restart: () => void;
  /** Where a failure nobody expected goes, with the entry that failed. */
  readonly reportUnexpected: (entry: string, error: unknown) => void;
}

/** The procedures of the protocol's `backups`, over the platform's Backups. */
export function backupProcedures({ backups, restart, reportUnexpected }: BackupProcedureOptions) {
  /** Runs `work` on the Backups and reports what it throws beyond the declared errors. */
  async function reporting<Result>(
    entry: string,
    work: (service: BackupService) => Promise<Result>,
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
    list: implementer.backups.list.handler(() => reporting("list", (service) => service.list())),
    create: implementer.backups.create.handler(() =>
      reporting("create", (service) => service.create()),
    ),
    restore: implementer.backups.restore.handler(({ input, errors }) =>
      reporting("restore", async (service) => {
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
