import Database from "better-sqlite3";

export interface ProjectRow {
  id: number;
  name: string;
}

export interface DbInfo {
  sqliteVersion: string;
  projects: ProjectRow[];
  runtime: string;
}

/** Opens (or creates) the spike database and seeds it once. */
export function openDb(file: string): Database.Database {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  const count = db.prepare("SELECT count(*) AS n FROM projects").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare("INSERT INTO projects (name) VALUES (?)");
    for (const name of ["Self-Engine Next", "Layer 0", "Spike S2"]) insert.run(name);
  }
  return db;
}

export function readInfo(db: Database.Database): DbInfo {
  const { v } = db.prepare("SELECT sqlite_version() AS v").get() as { v: string };
  const projects = db.prepare("SELECT id, name FROM projects ORDER BY id").all() as ProjectRow[];
  return {
    sqliteVersion: v,
    projects,
    runtime: `node ${process.versions.node}, abi ${process.versions.modules}${process.versions.electron ? `, electron ${process.versions.electron}` : ""}`,
  };
}
