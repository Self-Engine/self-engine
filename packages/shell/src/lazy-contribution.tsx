import { useLingui } from "@lingui/react/macro";
import { Button, Stack, Text } from "@mantine/core";
import { Component, type ComponentType, type ReactNode, lazy, Suspense } from "react";

type LoadComponent<Props extends object> = () => Promise<{
  readonly default: ComponentType<Props>;
}>;

export interface LazyComponents<Props extends object> {
  readonly component: (load: LoadComponent<Props>) => ComponentType<Props>;
  readonly forget: (load: LoadComponent<Props>) => void;
}

/** Keeps lazy component identity stable across Shell updates, until a failure forgets one. */
export function lazyComponents<Props extends object>(): LazyComponents<Props> {
  const components = new WeakMap<LoadComponent<Props>, ComponentType<Props>>();
  return {
    component: (load) => {
      let component = components.get(load);
      if (!component) {
        component = lazy(load);
        components.set(load, component);
      }
      return component;
    },
    // React.lazy keeps a rejection for ever, so a retry needs a new one.
    forget: (load) => components.delete(load),
  };
}

export function ContributionFailure({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  const { t } = useLingui();
  return (
    <Stack align="flex-start" gap="xs">
      <Text role="alert" size="sm">
        {message}
      </Text>
      <Button onClick={onRetry} size="xs" variant="default">
        {t`Try again`}
      </Button>
    </Stack>
  );
}

function FailedContribution({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useLingui();
  return <ContributionFailure message={t`This part could not be loaded.`} onRetry={onRetry} />;
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
export function LazyContribution<Props extends object>(allProps: LazyContributionProps<Props>) {
  const { components, load } = allProps;
  return (
    <ContributionBoundary onFailure={() => components.forget(load)}>
      <Suspense fallback={null}>
        <LoadedContribution {...allProps} />
      </Suspense>
    </ContributionBoundary>
  );
}
