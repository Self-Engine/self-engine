import SqliteDriver from "better-sqlite3";
import { Kysely, SqliteAdapter, SqliteDialect } from "kysely";
import type { Database } from "../core/index.ts";

/** SQLite can roll back DDL. Reporting that makes Kysely wrap a whole migration run in one transaction. */
class TransactionalDdlAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true;
  }
}

class TransactionalDdlDialect extends SqliteDialect {
  override createAdapter(): SqliteAdapter {
    return new TransactionalDdlAdapter();
  }
}

function applyPragmas(sqlite: SqliteDriver.Database): void {
  // First, since it only takes effect on a database without tables; on any other it does nothing.
  sqlite.pragma("auto_vacuum = INCREMENTAL");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("checkpoint_fullfsync = ON");
  sqlite.pragma("temp_store = MEMORY");
  sqlite.pragma(`journal_size_limit = ${128 * 1024 * 1024}`);
}

/** Opens the database at `path`, or a private in-memory one for `:memory:`. */
export function openDatabase(path: string): Database {
  const sqlite = new SqliteDriver(path);
  applyPragmas(sqlite);
  const kysely = new Kysely<unknown>({
    dialect: new TransactionalDdlDialect({ database: sqlite }),
  });
  return {
    kysely,
    executeScript: (sql) => {
      sqlite.exec(sql);
      return Promise.resolve();
    },
    close: async () => {
      await kysely.destroy();
      // Kysely only closes the connection if a query already went through it.
      if (sqlite.open) sqlite.close();
    },
  };
}
