import { describe, expectTypeOf, it } from "vite-plus/test";
import type { ColorFieldProps, IconFieldProps } from "./picker-fields.tsx";

interface Draft {
  readonly title: string;
  readonly icon: string | null;
  readonly color: string | null;
  /** Takes "empty", but neither an icon nor a color. */
  readonly hours: number | null;
}

describe("the fields a picker may be bound to", () => {
  it("are those that take everything the picker answers", () => {
    expectTypeOf<IconFieldProps<Draft>["name"]>().toEqualTypeOf<"icon" | "color">();
    expectTypeOf<ColorFieldProps<Draft>["name"]>().toEqualTypeOf<"icon" | "color">();
  });
});
