/**
 * Unlimited Agent — "Workspaces" in the sidebar, under Usage. Platform owner only: hidden when the
 * control plane does not accept this identity.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { workspacesApi } from "@/features/unlimited/workspaces/api";
import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";

export function WorkspacesSidebarEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const allowed = useQuery({
    queryKey: ["unlimited", "workspaces"],
    queryFn: () => workspacesApi.list(),
    staleTime: 30_000,
    retry: false,
  });
  if (!allowed.isSuccess) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid="open-workspaces-view"
        isActive={location.pathname === "/workspaces"}
        onClick={() => void navigate({ to: "/workspaces" })}
        tooltip="Workspaces"
        type="button"
      >
        <Building2 className="h-4 w-4" />
        <SidebarMenuLabel>Workspaces</SidebarMenuLabel>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
