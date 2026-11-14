import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { defaultAddress } from "../module-list.ts";

export const Route = createFileRoute("/$module")({
  beforeLoad: ({ params, location, context }) => {
    if (location.pathname.replace(/\/$/, "").split("/").length !== 2) return;
    const module = context.modules.find(params.module);
    if (!module) throw notFound();
    throw redirect({ href: defaultAddress(module) });
  },
});
