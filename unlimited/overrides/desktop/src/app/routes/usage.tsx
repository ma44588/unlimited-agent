import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const UsageScreen = React.lazy(async () => {
  const module = await import("@/features/unlimited/usage/UsageScreen");
  return { default: module.UsageScreen };
});

export const Route = createFileRoute("/usage")({
  component: UsageRouteComponent,
});

function UsageRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <UsageScreen />
    </React.Suspense>
  );
}
