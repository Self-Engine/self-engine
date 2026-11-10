import { createFileRoute, notFound } from "@tanstack/react-router";
import { findModule } from "../modules.ts";
import { ViewLoadError } from "../route-states.tsx";

export const Route = createFileRoute("/$module/$view")({
  loader: async ({ params }) => {
    const view = findModule(params.module)?.views.find((view) => view.id === params.view);
    if (!view) throw notFound();
    return { Component: (await view.load()).default };
  },
  component: ModuleView,
  errorComponent: ViewLoadError,
});

function ModuleView() {
  const { Component } = Route.useLoaderData();
  return <Component />;
}
