import { beforeAll, describe, expect, it } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

const RULE = "no-silent-catch";

// [name, source, diagnostics]. Every fixture goes through one real Oxlint run (beforeAll).
const FIXTURES: [string, string, number][] = [
  // Catch clauses.
  ["an empty catch", "try { run(); } catch {}", 1],
  ["a catch with an unused binding", "try { run(); } catch (error) { return null; }", 1],
  ["a catch that reads the error", "try { run(); } catch (error) { log.error('x', error); }", 0],
  ["a catch that only overwrites the error", "try { run(); } catch (error) { error = null; }", 1],
  [
    "a catch that updates the error from itself",
    "try { run(); } catch (error) { error ??= 1; }",
    0,
  ],
  [
    "a catch whose read is shadowed by a block binding",
    "try { run(); } catch (error) { { const error = 1; use(error); } }",
    1,
  ],
  [
    "a catch whose read is shadowed by a nested parameter",
    "try { run(); } catch (error) { later((error) => use(error)); }",
    1,
  ],
  [
    "a catch that hands the error to a callback",
    "try { run(); } catch (error) { setTimeout(() => report(error)); }",
    0,
  ],
  // Destructuring in the catch binding.
  [
    "a catch that reads a destructured binding",
    "try { run(); } catch ({ message }) { log.error(message); }",
    0,
  ],
  ["a catch with an unused destructured binding", "try { run(); } catch ({ message }) {}", 1],
  [
    "a catch whose destructured default is only written",
    "try { run(); } catch ({ message = 'x' }) {}",
    1,
  ],
  [
    "a catch that reads a destructured binding with a default",
    "try { run(); } catch ({ message = 'x' }) { log(message); }",
    0,
  ],
  [
    "a catch that reads a nested destructured binding",
    "try { run(); } catch ({ cause: { code } }) { log(code); }",
    0,
  ],
  ["a catch with an unused nested binding", "try { run(); } catch ({ cause: { code } }) {}", 1],
  [
    "a catch that reads a rest binding",
    "try { run(); } catch ({ message, ...rest }) { log(rest); }",
    0,
  ],
  ["a catch with an unused rest binding", "try { run(); } catch ({ ...rest }) {}", 1],
  ["a catch that reads an array binding", "try { run(); } catch ([first]) { log(first); }", 0],
  // Rethrows.
  ["a catch that rethrows", "try { run(); } catch { throw new Error('wrapped'); }", 0],
  ["a catch that rethrows conditionally", "try { run(); } catch { if (strict) throw stop; }", 0],
  [
    "a throw that only runs in a nested function",
    "try { run(); } catch { later(() => { throw new Error('x'); }); }",
    1,
  ],
  [
    "a throw that only runs in a nested function expression",
    "try { run(); } catch { later(function () { throw new Error('x'); }); }",
    1,
  ],
  [
    "a throw that only runs in a nested method",
    "try { run(); } catch { use({ fail() { throw stop; } }); }",
    1,
  ],
  [
    "a throw that an inner catch takes",
    "try { run(); } catch { try { throw stop; } catch (inner) { log(inner); } }",
    1,
  ],
  [
    "a throw from an inner catch",
    "try { run(); } catch { try { retry(); } catch (inner) { throw inner; } }",
    0,
  ],
  [
    "a throw from an inner finally",
    "try { run(); } catch { try { retry(); } catch (inner) { log(inner); } finally { throw stop; } }",
    0,
  ],
  [
    "a throw in an inner try without a catch",
    "try { run(); } catch { try { throw stop; } finally { cleanup(); } }",
    0,
  ],
  // Comments.
  ["a catch with a line comment", "try { run(); } catch {\n  // Storage is optional.\n}", 0],
  ["a catch with a block comment", "try { run(); } catch { /* Storage is optional. */ }", 0],
  [
    "a catch whose only comment sits in a nested function",
    "try { run(); } catch { later(() => { /* Inner. */ }); }",
    1,
  ],
  [
    "a catch whose only comment explains a nested .catch",
    "try { run(); } catch { promise.catch(() => {\n  // Best effort.\n}); }",
    1,
  ],
  ["a comment outside the catch", "// Nothing here.\ntry { run(); } catch {}", 1],
  // Nested try statements: each catch answers for itself.
  ["two silent catches, one inside the other", "try { a(); } catch { try { b(); } catch {} }", 2],
  // .catch(handler).
  ["an empty .catch handler", "promise.catch(() => {});", 1],
  ["a .catch handler returning a fallback", "promise.catch(() => undefined);", 1],
  ["a .catch handler that reads the error", "promise.catch((error) => report(error));", 0],
  ["a .catch handler that only defaults the error", "promise.catch((error = null) => {});", 1],
  ["an async .catch handler that drops the error", "promise.catch(async () => {});", 1],
  [
    "an async .catch handler that reads the error",
    "promise.catch(async (error) => { await report(error); });",
    0,
  ],
  ["a .catch function expression that drops the error", "promise.catch(function () {});", 1],
  [
    "a .catch function expression that reads the error",
    "promise.catch(function (error) { report(error); });",
    0,
  ],
  [
    "a named .catch handler that reads only its own name",
    "promise.catch(function retry() { schedule(retry); });",
    1,
  ],
  [
    "a .catch handler that reads a destructured binding",
    "promise.catch(({ message }) => report(message));",
    0,
  ],
  ["a .catch handler that rethrows", "promise.catch(() => { throw stop; });", 0],
  ["a .catch handler that explains itself", "promise.catch(() => {\n  // Best effort.\n});", 0],
  [
    "a .catch handler with a comment before its expression body",
    "promise.catch(() => /* Best effort. */ undefined);",
    0,
  ],
  [
    "a .catch handler whose only comment sits in a nested function",
    "promise.catch(() => { later(() => { /* Inner. */ }); });",
    1,
  ],
  ["a .catch with a named handler", "promise.catch(ignoreFailure);", 0],
  ["a .catch without a handler", "promise.catch();", 0],
  ["an optional .catch", "promise?.catch(() => {});", 1],
  ["a computed .catch", 'promise["catch"](() => {});', 1],
  ["an optional computed .catch", 'promise?.["catch"](() => {});', 1],
  ["a template-literal .catch", "promise[`catch`](() => {});", 1],
  ["a computed .catch that reads the error", 'promise["catch"]((error) => report(error));', 0],
  ["a member call whose name is not static", "promise[method](() => {});", 0],
  ["a template literal with an expression", "promise[`${name}`](() => {});", 0],
  ["a .finally handler", "promise.finally(() => {});", 0],
  // Syntax only: the receiver's type is unknown, so any .catch method counts.
  ["a .catch method of a non-Promise object", "queue.catch(() => {});", 1],
  // .then(onValue, handler).
  ["a .then rejection handler that drops the error", "promise.then(onValue, () => null);", 1],
  [
    "a .then rejection handler that reads the error",
    "promise.then(onValue, (error) => report(error));",
    0,
  ],
  [
    "a .then rejection handler that reads only a later parameter",
    "promise.then(onValue, (error, extra) => use(extra));",
    1,
  ],
  ["a computed .then rejection handler", 'promise["then"](onValue, () => {});', 1],
  ["a .then without a rejection handler", "promise.then(() => null);", 0],
  ["a .then with a named rejection handler", "promise.then(onValue, onError);", 0],
];

describe("self-engine/no-silent-catch", () => {
  let results: string[][] = [];
  beforeAll(() => {
    results = lintFixtures(
      RULE,
      FIXTURES.map(([, source]) => source),
    );
  });

  it.each(FIXTURES.map((fixture, index) => [...fixture, index] as const))(
    "%s",
    (_name, _source, expected, index) => {
      expect(results[index]).toHaveLength(expected);
    },
  );

  it("names the ways out in its message", () => {
    expect(results[0]?.[0]).toContain(
      "This swallows the error. Report it, rethrow it, or add a comment saying why ignoring it is safe.",
    );
  });

  it("reports the catch clause and the handler where they start", () => {
    const [catchClause, handler] = lintFixtures(RULE, [
      "try {\n  run();\n} catch {}",
      "promise\n  .catch(() => {});",
    ]);
    expect(catchClause?.[0]).toMatch(/:3:3: /);
    expect(handler?.[0]).toMatch(/:2:10: /);
  });
});
