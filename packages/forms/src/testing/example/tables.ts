// The table the example entries would live in, by its columns as the database would name them.
// No Data Process serves it: it types the columns the example's form maps to its fields (D334),
// as a module's `TablesOf` of its Row Map does.

export interface ExampleTables {
  readonly example_entries: {
    readonly id: string;
    readonly title: string;
    readonly description: string | null;
    readonly icon: string | null;
    readonly color_set: string | null;
  };
}
