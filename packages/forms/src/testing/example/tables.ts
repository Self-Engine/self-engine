// The table the example entries would live in, by its columns as the database would name them,
// the convention columns included.
// No Data Process serves it: it types the columns the example's form maps to its fields (D334)
// and the Clearance its edit form asks (D336), as a module's `TablesOf` of its Row Map does.

import type { Archivable, Convention } from "@self-engine/db/schema";

export interface ExampleTables {
  readonly example_entries: Convention &
    Archivable & {
      readonly title: string;
      readonly description: string | null;
      readonly icon: string | null;
      readonly color_set: string | null;
    };
}
