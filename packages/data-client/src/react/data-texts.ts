// Types only: the texts load at startup with the module list, where the storage module, its row
// schemas and its rules must not (startup check). The tie to them is a type-only import.
import type { ReasonDefinition, RowMap, SyncedTable, TablesOf } from "@self-engine/data-protocol";
import type { CountedName } from "@self-engine/i18n";
import type { AnyReasonText, ReasonTexts } from "./reason-texts.ts";

/** One plural name for each synced table a module owns (D335). */
export type TableNames<Table extends string = string> = Readonly<Record<Table, CountedName>>;

/**
 * What a storage module declares, as far as its page needs it: its row map and the Reasons its
 * rules answer with. `StorageModule` of `@self-engine/storage` has this shape.
 */
interface StorageModuleShape {
  readonly rowMap: RowMap;
  readonly rules?: readonly { readonly reasons: readonly ReasonDefinition[] }[] | undefined;
}

/** The synced tables of the module's row map. */
type TablesOfModule<Module extends StorageModuleShape> = SyncedTable<TablesOf<Module["rowMap"]>>;

/** Every Reason the module's own rules answer with. */
type ReasonsOfModule<Module extends StorageModuleShape> = NonNullable<
  Module["rules"]
>[number]["reasons"][number];

/** What `dataTexts` asks for: exactly the names and texts the storage module calls for. */
type DataTextsInput<Module extends StorageModuleShape> = [Module] extends [never]
  ? { readonly "name the module's storage module as the type argument": never }
  : string extends ReasonsOfModule<Module>["code"]
    ? { readonly "the storage module's rules lost the types of their Reasons": never }
    : { readonly tableNames: TableNames<TablesOfModule<Module>> } & ([
        ReasonsOfModule<Module>,
      ] extends [never]
        ? { readonly reasonTexts?: ReasonTexts<never> }
        : { readonly reasonTexts: ReasonTexts<ReasonsOfModule<Module>> });

declare const checked: unique symbol;

/**
 * The texts a module's data needs on the page, checked against its storage module by
 * `dataTexts`: a name for each synced table, a text for each Reason its rules answer with. The
 * module puts them into its Shell Contribution; the app's module list collects them.
 */
export interface DataTexts {
  readonly tableNames: TableNames;
  readonly reasonTexts: Readonly<Record<string, AnyReasonText>>;
  /** Only `dataTexts` makes it: a literal of the same shape checked nothing. */
  readonly [checked]: true;
}

/**
 * The data texts of the module whose storage module is the type argument (D334, D335): the
 * module's root entry imports it as a type only. A synced table without a name, or a Reason of
 * the module's rules without a text, does not compile.
 *
 * ```ts
 * import type { projects } from "./data/index.ts";
 * dataTexts<typeof projects>()({ tableNames: { projects: (count) => msg`…` } });
 * ```
 */
export function dataTexts<Module extends StorageModuleShape = never>() {
  return (
    texts: DataTextsInput<Module>,
  ): DataTexts & {
    readonly tableNames: TableNames<TablesOfModule<Module>>;
    readonly reasonTexts: ReasonTexts<ReasonsOfModule<Module>>;
  } => {
    // The input's type checked the names and texts against the storage module.
    const { tableNames, reasonTexts = {} } = texts as unknown as {
      readonly tableNames: TableNames;
      readonly reasonTexts?: Readonly<Record<string, AnyReasonText>>;
    };
    return { tableNames, reasonTexts } as never;
  };
}

/** The data texts of a module without data: no table, no rule. */
export const NO_DATA_TEXTS: DataTexts = { tableNames: {}, reasonTexts: {} } as unknown as DataTexts;
