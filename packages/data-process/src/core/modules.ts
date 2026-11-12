import type { RowMap, StorageContract, StorageModule } from "@self-engine/storage";

/** One data entry per module, under its contract namespace (D233). */
type DataModule = Pick<
  StorageModule<StorageContract, RowMap>,
  "contract" | "migrations" | "rowMap"
> & {
  /** Each entry retains its own row and input types, checked by defineStorageModule. */
  readonly entries: Readonly<
    Record<
      string,
      {
        readonly kind: "query" | "operation";
        readonly run: (...args: never[]) => unknown;
      }
    >
  >;
};
export type DataModules = Readonly<Record<string, DataModule>>;

/** Add a module's data entry here; both migrations and calls come from this list. */
export const modules: DataModules = {};
