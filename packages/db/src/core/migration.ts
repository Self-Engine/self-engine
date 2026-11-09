/** One forward-only schema change of one module. */
export interface Migration {
  /** `<module>/<number>`, with a four-digit number per module, for example `time/0003`. */
  readonly name: string;
  /** Hand-written SQL. It may hold several statements. */
  readonly sql: string;
}

// The path the guard in scripts/check-migrations.ts watches, so no migration escapes it.
const FILE_PATH = /(?:^|\/)migrations\/(\d{4})\.sql$/;

/**
 * The migrations of one module, from its `migrations/<four digits>.sql` files as
 * `import.meta.glob` delivers them: path to SQL text. The number in the file name is the number
 * in the migration's name. The runner validates the name as a whole.
 */
export function defineMigrations(
  module: string,
  files: Readonly<Record<string, string>>,
): Migration[] {
  return Object.entries(files).map(([path, sql]) => {
    const number = FILE_PATH.exec(path)?.[1];
    if (number === undefined) {
      throw new Error(
        `Migration file ${path} of ${module} must be named migrations/<four digits>.sql`,
      );
    }
    return { name: `${module}/${number}`, sql };
  });
}
