import { createFileRoute, redirect } from "@tanstack/react-router";
import { defaultAddress, modules } from "../modules.ts";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: defaultAddress(modules[0]!) });
  },
});
