import { expect, test } from "vite-plus/test";
import { storyModuleList } from "../story-module-list.ts";

type Load = (id: string) => string | undefined;
const loadOf = (enabled: boolean) => storyModuleList(enabled).load as Load | undefined;

test("when enabled, the dev server's app module list is the stories' one", () => {
  const plugin = storyModuleList(true);
  expect(plugin.apply).toBe("serve");
  expect(loadOf(true)?.("/repo/apps/web/src/modules.ts")).toBe(
    'export { storyModules as appModules } from "./story-modules.ts";\n',
  );
  expect(loadOf(true)?.("/repo/apps/web/src/modules.ts?t=1")).toContain("storyModules");
});

test("when enabled, every other module loads as it is", () => {
  expect(loadOf(true)?.("/repo/apps/web/src/router.ts")).toBeUndefined();
  expect(loadOf(true)?.("/repo/packages/shell/src/modules.ts")).toBeUndefined();
});

test("when disabled, the plugin applies nowhere, a build neither", () => {
  const plugin = storyModuleList(false);
  expect(
    typeof plugin.apply === "function" &&
      plugin.apply({}, { command: "serve", mode: "development" }),
  ).toBe(false);
  expect(plugin.load).toBeUndefined();
});
