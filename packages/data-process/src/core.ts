import type { AnyContractRouter } from "@orpc/contract";
import { implement } from "@orpc/server";
import type { Router } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";
import { appContract } from "@self-engine/contracts";
import { createMigrationRunner } from "@self-engine/db";
import type { Database, Migration } from "@self-engine/db";
import { sql } from "kysely";

/** What every procedure receives besides its input. */
export interface ProcedureContext {
  readonly database: Database;
}

/**
 * The data process's end of a channel to one renderer: a DOM or Node `MessagePort`, or
 * Electron's `MessagePortMain`. Those with `start` hold their messages until it runs.
 */
export type DataPort = Parameters<RPCHandler<ProcedureContext>["upgrade"]>[0] & {
  start?: () => void;
};

/** The procedures of the modules, by module name, each implementing that module's contract. */
export type ModuleRouters = Readonly<Record<string, Router<AnyContractRouter, ProcedureContext>>>;

export interface DataProcessOptions {
  /** An open database. The core owns it from here: nothing else reads or writes it. */
  readonly database: Database;
  /** Every module's migrations. The caller composes the list, so the core knows no module. */
  readonly migrations: readonly Migration[];
  /** Mounted next to the procedures of the app contract. */
  readonly modules?: ModuleRouters;
}

export interface DataProcessCore {
  /**
   * Answers calls on `port` until it closes. Call it once per port: each renderer connection,
   * a reload included, brings its own.
   */
  serve(port: DataPort): void;
}

async function sqliteVersion(database: Database): Promise<string> {
  const { rows } = await sql<{ version: string }>`select sqlite_version() as version`.execute(
    database.kysely,
  );
  const version = rows[0]?.version;
  if (version === undefined) throw new Error("SQLite did not report its version");
  return version;
}

/**
 * The data process without its platform: it runs the pending migrations, then serves the app
 * contract on every port it is given. It resolves only once the migrations have run, so the
 * first call is never answered from a half-migrated database.
 */
export async function createDataProcessCore({
  database,
  migrations,
  modules = {},
}: DataProcessOptions): Promise<DataProcessCore> {
  for (const name of Object.keys(modules)) {
    if (Object.hasOwn(appContract, name)) {
      throw new Error(`A module may not be named ${name}: the app contract uses that name`);
    }
  }
  await createMigrationRunner(database, migrations).run();
  // A successful run leaves every listed migration applied, and none besides: the runner fails
  // on a database that records one the list does not hold. Sorted, the order they ran in.
  const health = {
    state: "ready",
    sqliteVersion: await sqliteVersion(database),
    migrations: migrations.map(({ name }) => name).toSorted(),
  } as const;

  const app = implement(appContract).$context<ProcedureContext>();
  const handler = new RPCHandler<ProcedureContext>({
    ...modules,
    health: app.health.handler(() => health),
  });
  return {
    serve(port) {
      handler.upgrade(port, { context: { database } });
      port.start?.();
    },
  };
}
