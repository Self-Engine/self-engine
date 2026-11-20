import { useLingui } from "@lingui/react/macro";
import { ErrorState } from "@self-engine/ui";
import { Component, type ComponentType, type ReactNode, lazy, Suspense } from "react";

type LoadComponent<Props extends object> = () => Promise<{
  readonly default: ComponentType<Props>;
}>;

export interface LazyComponents<Props extends object> {
  readonly component: (load: LoadComponent<Props>) => ComponentType<Props>;
  /**
   * Loads the code ahead of its first showing, so that showing it then does not wait. Code that
   * arrived before its first showing is shown without React.lazy, which would suspend once more.
   */
  readonly preload: (load: LoadComponent<Props>) => void;
  readonly forget: (load: LoadComponent<Props>) => void;
}

/** Keeps lazy component identity stable across Shell updates, until a failure forgets one. */
export function lazyComponents<Props extends object>(): LazyComponents<Props> {
  const components = new WeakMap<LoadComponent<Props>, ComponentType<Props>>();
  const preloaded = new WeakMap<LoadComponent<Props>, ComponentType<Props>>();
  const preloading = new WeakSet<LoadComponent<Props>>();
  return {
    component: (load) => {
      let component = components.get(load);
      if (!component) {
        component = preloaded.get(load) ?? lazy(load);
        components.set(load, component);
      }
      return component;
    },
    preload: (load) => {
      if (components.has(load) || preloading.has(load)) return;
      preloading.add(load);
      void load().then(
        (loaded) => preloaded.set(load, loaded.default),
        () => {
          // Safe to ignore: it only costs the head start. The first showing loads again and
          // reports its own failure.
          preloading.delete(load);
        },
      );
    },
    // React.lazy keeps a rejection for ever, so a retry needs a new one.
    forget: (load) => {
      components.delete(load);
      preloaded.delete(load);
      preloading.delete(load);
    },
  };
}

function FailedContribution({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useLingui();
  return <ErrorState onRetry={onRetry} title={t`This part could not be loaded.`} />;
}

interface BoundaryProps {
  readonly onFailure: () => void;
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
    return this.state.failed ? (
      <FailedContribution onRetry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}

/** Below the boundary, so that a retry looks the component up again. */
function LoadedContribution<Props extends object>({
  components,
  load,
  props,
}: LazyContributionProps<Props>) {
  const Loaded = components.component(load) as ComponentType<object>;
  return <Loaded {...props} />;
}

interface LazyContributionProps<Props extends object> {
  readonly components: LazyComponents<Props>;
  readonly load: LoadComponent<Props>;
  readonly props: Props;
}

/** A module's code, loaded when it is first shown. Give it a key per thing it shows. */
export function LazyContribution<Props extends object>({
  fallback = null,
  ...contribution
}: LazyContributionProps<Props> & { readonly fallback?: ReactNode }) {
  const { components, load } = contribution;
  return (
    <ContributionBoundary onFailure={() => components.forget(load)}>
      <Suspense fallback={fallback}>
        <LoadedContribution {...contribution} />
      </Suspense>
    </ContributionBoundary>
  );
}
