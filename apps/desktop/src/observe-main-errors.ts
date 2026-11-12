import { buildIdentity } from "./build-channel.ts";
import { shouldHideWindow } from "./channel.ts";
import { monitorMainErrors } from "./main-errors.ts";

// Only a hidden dev start (the app check and the smoke stage) records main-process errors, so
// released apps never wrap `console.error` or keep a list. Imported first in main.ts, so the
// check also sees failures from before its driver attaches. A monitor leaves Node/Electron's
// exception and unhandled-rejection handling intact.
if (shouldHideWindow(buildIdentity.channel, process.env.SELF_ENGINE_HIDDEN)) {
  const failures: string[] = [];
  Object.defineProperty(globalThis, "__selfEngineMainErrors", { value: failures });
  monitorMainErrors(process, (message) => failures.push(message), console);
}
