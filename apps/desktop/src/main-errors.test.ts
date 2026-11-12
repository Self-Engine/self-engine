import { EventEmitter } from "node:events";
import { expect, it } from "vite-plus/test";
import { monitorMainErrors } from "./main-errors.ts";

it("records startup exceptions without handling exceptions or rejections", () => {
  const events = new EventEmitter();
  const errors: string[] = [];
  monitorMainErrors(events, (message) => errors.push(message));
  events.emit("uncaughtExceptionMonitor", new Error("startup failed"));
  expect(errors).toEqual(["main uncaughtException: startup failed"]);
  expect(events.listenerCount("uncaughtException")).toBe(0);
  expect(events.listenerCount("unhandledRejection")).toBe(0);
});

it("retains main console errors from startup while preserving console output", () => {
  const events = new EventEmitter();
  const errors: string[] = [];
  const output: unknown[][] = [];
  const console = {
    error: (...args: unknown[]) => {
      output.push(args);
    },
  };
  monitorMainErrors(events, (message) => errors.push(message), console);
  console.error("Startup %s", "failed");
  expect(errors).toEqual(["main console.error: Startup failed"]);
  expect(output).toEqual([["Startup %s", "failed"]]);
});
