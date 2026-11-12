import { monitorMainErrors } from "./main-errors.ts";

// Loaded before main startup, so the driver can read failures that precede its attachment.
// A monitor leaves Node/Electron's exception and unhandled-rejection handling intact.
const failures: string[] = [];
Object.defineProperty(globalThis, "__selfEngineMainErrors", { value: failures });
monitorMainErrors(process, (message) => failures.push(message), console);
