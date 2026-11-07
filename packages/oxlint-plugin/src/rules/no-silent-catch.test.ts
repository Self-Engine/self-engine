import { describe, expect, it } from "vite-plus/test";
import { lintFixture } from "../testing/lint-fixture.ts";

const hits = (source: string) => lintFixture("no-silent-catch", source).length;

describe("self-engine/no-silent-catch", () => {
  it.each([
    ["an empty catch", "try { run(); } catch {}"],
    ["a catch with an unused binding", "try { run(); } catch (error) { return null; }"],
    ["an empty .catch handler", "promise.catch(() => {});"],
    ["a .catch handler returning a fallback", "promise.catch(() => undefined);"],
    ["a .then rejection handler that drops the error", "promise.then(onValue, () => null);"],
    [
      "a throw that only runs in a nested function",
      "try { run(); } catch { later(() => { throw new Error('x'); }); }",
    ],
    [
      "a .then rejection handler that reads only a later parameter",
      "promise.then(onValue, (error, extra) => use(extra));",
    ],
    [
      "a named .catch handler that reads only its own name",
      "promise.catch(function retry() { schedule(retry); });",
    ],
  ])("flags %s", (_name, source) => {
    expect(hits(source)).toBe(1);
  });

  it.each([
    ["a catch that reads the error", "try { run(); } catch (error) { log.error('x', error); }"],
    ["a catch that explains itself", "try { run(); } catch {\n  // Storage is optional.\n}"],
    ["a catch that rethrows", "try { run(); } catch { throw new Error('wrapped'); }"],
    ["a .catch handler that reads the error", "promise.catch((error) => report(error));"],
    [
      "a catch that reads a destructured binding",
      "try { run(); } catch ({ message }) { log.error(message); }",
    ],
    [
      "a .catch handler that reads a destructured binding",
      "promise.catch(({ message }) => report(message));",
    ],
    ["a .catch handler that explains itself", "promise.catch(() => {\n  // Best effort.\n});"],
    ["a .catch with a named handler", "promise.catch(ignoreFailure);"],
    ["a .then without a rejection handler", "promise.then(() => null);"],
  ])("allows %s", (_name, source) => {
    expect(hits(source)).toBe(0);
  });

  it("names the ways out in its message", () => {
    expect(lintFixture("no-silent-catch", "try { run(); } catch {}")[0]).toContain(
      "Report it, rethrow it, or add a comment",
    );
  });
});
