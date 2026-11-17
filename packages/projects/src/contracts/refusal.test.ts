import type { ContractRouterClient } from "@orpc/contract";
import { safe } from "@orpc/server";
import type { Reason } from "@self-engine/db/schema";
import { expectTypeOf, test } from "vite-plus/test";
import { projectsContract, type ProjectId } from "./index.ts";

// Never called: the client has no Data Process behind it, the test is the compiler's.
async function _answers(client: ContractRouterClient<typeof projectsContract>, id: ProjectId) {
  return {
    create: await safe(client.create({ title: "Website" })),
    edit: await safe(client.edit({ id, title: "Website" })),
    archive: await safe(client.archive({ id })),
    unarchive: await safe(client.unarchive({ id })),
    delete: await safe(client.delete({ id })),
    restore: await safe(client.restore({ id })),
    active: await safe(client.active({})),
  };
}
type Answers = Awaited<ReturnType<typeof _answers>>;
/** The Reasons of the Refusal an answer's error can be; `never` when it cannot be one. */
type RefusalReasons<Answer> = Answer extends { error: infer Error } ? ReasonsOf<Error> : never;
type ReasonsOf<Error> = Error extends {
  code: "REFUSED";
  data: { reasons: infer Reasons };
}
  ? Reasons
  : never;

test("the typed client of every Operation of `projects` knows the Refusal and its Reasons", () => {
  type Reasons = Reason[];
  expectTypeOf<RefusalReasons<Answers["create"]>>().toExtend<Reasons>();
  expectTypeOf<RefusalReasons<Answers["create"]>>().not.toBeNever();
  expectTypeOf<RefusalReasons<Answers["edit"]>>().not.toBeNever();
  expectTypeOf<RefusalReasons<Answers["archive"]>>().not.toBeNever();
  expectTypeOf<RefusalReasons<Answers["unarchive"]>>().not.toBeNever();
  expectTypeOf<RefusalReasons<Answers["delete"]>>().not.toBeNever();
  expectTypeOf<RefusalReasons<Answers["restore"]>>().not.toBeNever();
});

test("the typed client of a Query knows no Refusal", () => {
  expectTypeOf<RefusalReasons<Answers["active"]>>().toBeNever();
});
