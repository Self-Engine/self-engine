import { buildIdentity } from "./build-channel.ts";

/** Fixed by the build: development checks outputs, packaged channels do not (D188, D234). */
export const dataProcessOptions = { checkOutputs: buildIdentity.channel === "dev" };
