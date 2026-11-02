import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const TeamScreen = React.lazy(async () => {
  const module = await import("@/features/unlimited/org/TeamScreen");
  return { default: module.TeamScreen };
});

export const Route = createFileRoute("/team")({
  component: TeamRouteComponent,
});

function TeamRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <TeamScreen />
    </React.Suspense>
  );
}
