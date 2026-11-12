import type { DataProcessOptions } from "@self-engine/data-process";
import { buildIdentity } from "./build-channel.ts";

/** Fixed by the build: development checks outputs, packaged channels do not (D188, D234). */
export const dataProcessOptions: Pick<DataProcessOptions, "checkOutputs" | "report"> = {
  checkOutputs: buildIdentity.channel === "dev",
  // #37 replaces this development console reporter with the local error log.
  ...(buildIdentity.channel === "dev"
    ? {
        report: (report) => {
          if (report.kind === "unexpected-error") console.error(report);
          else console.warn(report);
        },
      }
    : {}),
};
