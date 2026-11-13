import { createDataConnection } from "@self-engine/data-client";
import { expect, it } from "vite-plus/test";
import { type RenderModules, startRenderDataProcess } from "./render-data-process.ts";

it("serves placeholder-alpha with its table, empty, over a real port", async () => {
  const process = await startRenderDataProcess();
  const connection = createDataConnection<RenderModules>();
  try {
    const ready = new Promise<void>((resolve) => {
      const stop = connection.subscribe(() => {
        if (connection.getState().status !== "ready") return;
        stop();
        resolve();
      });
    });
    connection.connect(process.openPort());
    await ready;
    expect(connection.describeEntry("placeholderAlpha", "list")).toEqual({
      kind: "query",
      reads: ["placeholder_alpha_entries"],
    });
    await expect(connection.client.placeholderAlpha.list({})).resolves.toEqual([]);
  } finally {
    connection.disconnect();
    await process.close();
  }
});
