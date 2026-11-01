/**
 * Unlimited Agent — "Usage" in the sidebar, right under Projects. Owner-only: hidden when the
 * server's admin API does not accept this identity.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { odooApi } from "@/features/unlimited/odoo/api";
import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";

export function UsageSidebarEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const allowed = useQuery({
    queryKey: ["unlimited", "server-agents"],
    queryFn: () => odooApi.serverAgents(),
    staleTime: 15_000,
    retry: false,
  });
  if (allowed.isError) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid="open-usage-view"
        isActive={location.pathname === "/usage"}
        onClick={() => void navigate({ to: "/usage" })}
        tooltip="Usage"
        type="button"
      >
        <BarChart3 className="h-4 w-4" />
        <SidebarMenuLabel>Usage</SidebarMenuLabel>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
