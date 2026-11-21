import { describe, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { type InputErrorReason, inputErrorData, inputErrors } from "./input-error.ts";

describe("inputErrors", () => {
  const declared = inputErrors("start_in_future", "end_in_future");
  const schema = declared.BAD_REQUEST.data;

  test("accepts the data of an input error with a declared reason, unchanged", () => {
    const data = inputErrorData(["startedAt"], "start_in_future");
    expect(data).toEqual({
      issues: [
        {
          code: "custom",
          path: ["startedAt"],
          message: "start_in_future",
          params: { reason: "start_in_future" },
        },
      ],
    });
    expect(schema.parse(data)).toEqual(data);
  });

  test("rejects a reason the entry does not declare, and the frame's own check of the input", () => {
    expect(schema.safeParse(inputErrorData(["startedAt"], "start_too_early")).success).toBe(false);
    const ownCheck = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    expect(schema.safeParse({ issues: ownCheck.error?.issues }).success).toBe(false);
  });

  test("its type names the declared reasons", () => {
    expectTypeOf<InputErrorReason<typeof schema>>().toEqualTypeOf<
      "start_in_future" | "end_in_future"
    >();
  });
});
