import { msg } from "@lingui/core/macro";
import { type DataTexts, dataTexts, NO_DATA_TEXTS } from "@self-engine/data-client/react";
import { expectTypeOf, test } from "vite-plus/test";
import type { projects } from "./data/index.ts";
import type { projectsRowMap } from "./data/rows.ts";
import { contribution } from "./index.ts";

test("the Shell Contribution's data texts are checked against the module's storage module", () => {
  // Compile-time checks: the type check of `pnpm verify` fails if any expectation breaks.
  // Made by `dataTexts` for this module's storage module, not for another one, and not left out.
  expectTypeOf(contribution.dataTexts).toEqualTypeOf<
    ReturnType<ReturnType<typeof dataTexts<typeof projects>>>
  >();
  expectTypeOf(NO_DATA_TEXTS).not.toEqualTypeOf(contribution.dataTexts);
  expectTypeOf(contribution.dataTexts).toExtend<DataTexts>();
});

test("a second synced table in the storage module needs its name in the contribution", () => {
  type WithLinks = typeof projects & {
    readonly rowMap: typeof projectsRowMap & { project_links: (typeof projectsRowMap)["projects"] };
  };
  const project = (count: number) => msg`${String(count)} projects`;
  // @ts-expect-error The new table `project_links` has no name.
  dataTexts<WithLinks>()({ tableNames: { projects: project } });
  expectTypeOf(
    dataTexts<WithLinks>()({ tableNames: { projects: project, project_links: project } }),
  ).toExtend<DataTexts>();
});
