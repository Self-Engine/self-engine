import type { EventEmitter } from "node:events";
import { format } from "node:util";

/** Observes Node's default fatal-error path, including unhandled rejections, without handling it. */
export function monitorMainErrors(
  events: EventEmitter,
  report: (message: string) => void,
  output?: Pick<Console, "error">,
): void {
  events.on("uncaughtExceptionMonitor", (error: Error) =>
    report(`main uncaughtException: ${error.message}`),
  );
  if (output) {
    const error = output.error.bind(output);
    output.error = (...args: unknown[]) => {
      report(`main console.error: ${format(...args)}`);
      error(...args);
    };
  }
}
