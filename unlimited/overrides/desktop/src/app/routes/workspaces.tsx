import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const WorkspacesScreen = React.lazy(async () => {
  const module = await import("@/features/unlimited/workspaces/WorkspacesScreen");
  return { default: module.WorkspacesScreen };
});

export const Route = createFileRoute("/workspaces")({
  component: WorkspacesRouteComponent,
});

function WorkspacesRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <WorkspacesScreen />
    </React.Suspense>
  );
}
