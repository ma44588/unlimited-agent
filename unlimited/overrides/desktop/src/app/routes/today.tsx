import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const TodayScreen = React.lazy(async () => {
  const module = await import("@/features/unlimited/org/TodayScreen");
  return { default: module.TodayScreen };
});

export const Route = createFileRoute("/today")({
  component: TodayRouteComponent,
});

function TodayRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <TodayScreen />
    </React.Suspense>
  );
}
