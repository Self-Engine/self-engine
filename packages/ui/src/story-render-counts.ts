// For Stories and the render measurement only (docs/development/performance.md): counts which
// components React drew. A subpath of its own, so that nothing of it reaches what the package's
// main entry ships, and free of imports, so that the Component Catalog can install it before
// React loads.

/**
 * The part of a React Fiber that the count reads. React's DevTools commit hook hands over the
 * committed tree; this intentionally uses React's private Fiber flags, so review it when upgrading
 * React. It never enters the shipped application.
 */
export interface Fiber {
  readonly alternate?: Fiber | null;
  readonly tag: number;
  readonly flags: number;
  readonly type?: { readonly displayName?: string; readonly name?: string } | null;
  readonly child: Fiber | null;
  readonly sibling: Fiber | null;
}

/** Root commits, and committed renders by component name. Components sharing a name add up. */
export interface RenderCounts {
  commits: number;
  components: Record<string, number>;
}

/**
 * Count committed function-component work, excluding reused bailout subtrees and aborted renders.
 * Counts committed work, not DOM mutations.
 */
export function countCommit(
  root: Fiber,
  counts: RenderCounts,
  previous: WeakMap<Fiber, Fiber>,
): void {
  counts.commits++;
  const visit = (fiber: Fiber | null): void => {
    if (fiber === null) return;
    // FunctionComponent, ForwardRef, SimpleMemoComponent; PerformedWork = 1.
    const last =
      previous.get(fiber) ?? (fiber.alternate ? previous.get(fiber.alternate) : undefined);
    if (last !== fiber && [0, 11, 15].includes(fiber.tag) && (fiber.flags & 1) !== 0) {
      const name = fiber.type?.displayName || fiber.type?.name || "Anonymous";
      counts.components[name] = (counts.components[name] ?? 0) + 1;
    }
    previous.set(fiber, fiber);
    if (fiber.alternate) previous.set(fiber.alternate, fiber);
    visit(fiber.child);
    visit(fiber.sibling);
  };
  visit(root);
}

/** Isolate work committed between two cumulative snapshots. */
export function difference(after: RenderCounts, before: RenderCounts): RenderCounts {
  const components: Record<string, number> = {};
  for (const [name, count] of Object.entries(after.components)) {
    const delta = count - (before.components[name] ?? 0);
    if (delta !== 0) components[name] = delta;
  }
  return { commits: after.commits - before.commits, components };
}

interface Counter {
  readonly counts: RenderCounts;
  readonly afterCommit: Set<() => void>;
  connected: boolean;
}

const COUNTER = "__SE_RENDER_COUNTER__";
const HOOK = "__REACT_DEVTOOLS_GLOBAL_HOOK__";

function counterOf(scope: object): Counter | undefined {
  return Reflect.get(scope, COUNTER) as Counter | undefined;
}

/**
 * Installs the count as React's DevTools hook. React looks for the hook once, when it loads, so
 * this has to run before. Does nothing when a hook is already there. The browser of the story tests
 * declares the name with nothing in it, so only a value counts as a hook.
 */
export function installRenderCounter(scope: object = globalThis): void {
  if (Reflect.get(scope, HOOK) !== undefined) return;
  const counter: Counter = {
    counts: { commits: 0, components: {} },
    afterCommit: new Set(),
    connected: false,
  };
  const previous = new WeakMap<Fiber, Fiber>();
  Reflect.set(scope, COUNTER, counter);
  Reflect.set(scope, HOOK, {
    supportsFiber: true,
    renderers: new Map(),
    inject(this: { renderers: Map<number, unknown> }, renderer: unknown) {
      counter.connected = true;
      this.renderers.set(1, renderer);
      return 1;
    },
    onCommitFiberRoot(_id: number, root: { readonly current: Fiber }) {
      countCommit(root.current, counter.counts, previous);
      for (const listener of counter.afterCommit) listener();
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  });
}

function connectedCounter(scope: object): Counter {
  const counter = counterOf(scope);
  if (counter?.connected !== true) {
    throw new Error(
      "React drew without the render counter: installRenderCounter() has to run before React loads",
    );
  }
  return counter;
}

/** Everything counted so far, as a copy: take one before and one after, and compare. */
export function renderCounts(scope: object = globalThis): RenderCounts {
  const { counts } = connectedCounter(scope);
  return { commits: counts.commits, components: { ...counts.components } };
}

/**
 * Resolves once `shown` holds after a commit, or at once when it already holds. Waits for React
 * itself instead of asking again and again.
 */
export function commitWhere(shown: () => boolean, scope: object = globalThis): Promise<void> {
  const counter = connectedCounter(scope);
  if (shown()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (!shown()) return;
      counter.afterCommit.delete(check);
      resolve();
    };
    counter.afterCommit.add(check);
  });
}

/**
 * Resolves after the work React has scheduled by now, such as the effects of the last commit and
 * what they set. React schedules it as message tasks, and this one queues behind them.
 */
export function afterTheCommitsNowDue(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
}
