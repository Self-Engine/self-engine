import { describe, expect, it } from "vite-plus/test";
import { FieldMessages } from "./field-messages.ts";

/** How often the field `count` heard of a change to its message. */
function heardBy(messages: FieldMessages): { count: number } {
  const heard = { count: 0 };
  messages.subscribe("count", () => {
    heard.count += 1;
  });
  return heard;
}

describe("FieldMessages", () => {
  it("shows a message with a bigint again without telling the field twice", () => {
    const messages = new FieldMessages();
    const heard = heardBy(messages);
    const shown = () => new Map([["count", { id: "at-most", values: { limit: 1n } }]]);

    messages.replace(shown());
    messages.replace(shown());

    expect(messages.of("count")?.values).toEqual({ limit: 1n });
    expect(heard.count).toBe(1);
  });

  it("tells the field when the same text carries another number", () => {
    const messages = new FieldMessages();
    const heard = heardBy(messages);

    messages.replace(new Map([["count", { id: "at-most", values: { limit: 1 } }]]));
    messages.replace(new Map([["count", { id: "at-most", values: { limit: 2 } }]]));

    expect(messages.of("count")?.values).toEqual({ limit: 2 });
    expect(heard.count).toBe(2);
  });
});
