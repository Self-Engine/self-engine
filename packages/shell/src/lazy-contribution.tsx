import { useLingui } from "@lingui/react/macro";
import { ErrorState } from "@self-engine/ui";
import {
  Component,
  type ComponentType,
  type ReactNode,
  Suspense,
  useEffect,
  useState,
} from "react";

export type LoadComponent<Props extends object> = () => Promise<{
  readonly default: ComponentType<Props>;
}>;

export interface LazyComponents<Props extends object> {
  /** The component once its code has arrived; undefined before, and after `forget`. */
  readonly loaded: (load: LoadComponent<Props>) => ComponentType<Props> | undefined;
  /** Loads the code once for every caller, until the load fails or is forgotten. */
  readonly load: (load: LoadComponent<Props>) => Promise<ComponentType<Props>>;
  /** Loads the code ahead of its first showing, so that showing it then does not wait. */
  readonly preload: (load: LoadComponent<Props>) => void;
  /** Drops the loaded code, so that the next showing loads it again, as a retry needs. */
  readonly forget: (load: LoadComponent<Props>) => void;
}

/** Keeps each loaded component, the same one across Shell updates, until a failure forgets it. */
export function lazyComponents<Props extends object>(): LazyComponents<Props> {
  const loaded = new WeakMap<LoadComponent<Props>, ComponentType<Props>>();
  const loading = new WeakMap<LoadComponent<Props>, Promise<ComponentType<Props>>>();
  const load = (code: LoadComponent<Props>) => {
    let pending = loading.get(code);
    if (!pending) {
      pending = code().then((module) => {
        loaded.set(code, module.default);
        return module.default;
      });
      loading.set(code, pending);
      pending.catch(() => {
        // Safe to drop here: the callers hear the failure. It is not kept, so the next showing
        // loads anew.
        loading.delete(code);
      });
    }
    return pending;
  };
  return {
    loaded: (code) => loaded.get(code),
    load,
    preload: (code) => {
      load(code).catch(() => {
        // Safe to ignore: it only costs the head start. The first showing loads again and
        // reports its own failure.
      });
    },
    forget: (code) => {
      loaded.delete(code);
      loading.delete(code);
    },
  };
}

function FailedContribution({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useLingui();
  return <ErrorState onRetry={onRetry} title={t`This part could not be loaded.`} />;
}

interface BoundaryProps {
  readonly onFailure: () => void;
  readonly renderFailure: ((onRetry: () => void) => ReactNode) | undefined;
  readonly children: ReactNode;
}

/** Keeps a failure in a module's code to the area that the module fills. */
class ContributionBoundary extends Component<BoundaryProps, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onFailure();
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const retry = () => this.setState({ failed: false });
    return this.props.renderFailure ? (
      this.props.renderFailure(retry)
    ) : (
      <FailedContribution onRetry={retry} />
    );
  }
}

/**
 * Below the boundary, so that a retry looks the component up again. Until the code has arrived
 * it shows `fallback` as plain content and loads the code; a failed load throws here, for the
 * boundary to show.
 *
 * Not React.lazy, which suspends: React shows content behind a Suspense boundary no sooner than
 * 300 ms after the boundary showed its fallback, however soon the code arrives (#297). The code's
 * arrival is an ordinary update instead, drawn in the next frames.
 */
function LoadedContribution<Props extends object>({
  components,
  load,
  props,
  onShown,
  fallback,
}: LazyContributionProps<Props> & { readonly fallback: ReactNode }) {
  // The code that arrived, or its failure, for this load. Held as state, not read from
  // `components` again: the React Compiler keeps a read per `components` and `load`.
  const [arrival, setArrival] = useState<{
    readonly load: LoadComponent<Props>;
    readonly component?: ComponentType<Props>;
    readonly failure?: unknown;
  }>();
  const Loaded = (components.loaded(load) ??
    (arrival?.load === load ? arrival.component : undefined)) as ComponentType<object> | undefined;
  useEffect(() => {
    // Runs once the code has arrived and drawn, so also after a successful retry.
    if (Loaded) return onShown?.();
    let wanted = true;
    components.load(load).then(
      (component) => wanted && setArrival({ load, component }),
      (failure: unknown) => wanted && setArrival({ load, failure }),
    );
    return () => {
      wanted = false;
    };
  }, [components, load, Loaded, onShown]);
  if (arrival?.load === load && "failure" in arrival) throw arrival.failure;
  return Loaded ? <Loaded {...props} /> : fallback;
}

interface LazyContributionProps<Props extends object> {
  readonly components: LazyComponents<Props>;
  readonly load: LoadComponent<Props>;
  readonly props: Props;
  /** Told each time the code is on screen, once it arrived or after a retry. Keep it stable. */
  readonly onShown?: () => void;
}

/**
 * A module's code, loaded when it is first shown, with `fallback` until it has arrived. Give it a
 * key per thing it shows.
 */
export function LazyContribution<Props extends object>({
  fallback = null,
  renderFailure,
  ...contribution
}: LazyContributionProps<Props> & {
  readonly fallback?: ReactNode;
  readonly renderFailure?: BoundaryProps["renderFailure"];
}) {
  const { components, load } = contribution;
  return (
    <ContributionBoundary onFailure={() => components.forget(load)} renderFailure={renderFailure}>
      {/* For the module's own code: a part of it that suspends shows the fallback as well. */}
      <Suspense fallback={fallback}>
        <LoadedContribution {...contribution} fallback={fallback} />
      </Suspense>
    </ContributionBoundary>
  );
}
