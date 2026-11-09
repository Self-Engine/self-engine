import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { defaultAddress, findModule } from "../modules.ts";

export const Route = createFileRoute("/$module")({
  beforeLoad: ({ params, location }) => {
    if (location.pathname.replace(/\/$/, "").split("/").length !== 2) return;
    const module = findModule(params.module);
    if (!module) throw notFound();
    throw redirect({ href: defaultAddress(module) });
  },
});
