import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const TasksScreen = React.lazy(async () => {
  const module = await import("@/features/unlimited/tasks/TasksScreen");
  return { default: module.TasksScreen };
});

export const Route = createFileRoute("/tasks")({
  component: TasksRouteComponent,
});

function TasksRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <TasksScreen />
    </React.Suspense>
  );
}
