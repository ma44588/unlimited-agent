/**
 * Unlimited Agent — "Today" and "Team" in the sidebar. Today shows to the owner and to the people who approve
 * plans (the connector decides); Team is owner-only.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ListChecks, Network, Sun } from "lucide-react";

import { odooApi } from "@/features/unlimited/odoo/api";

import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";

import { orgApi } from "./api";

export function TodaySidebarEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const today = useQuery({ queryKey: ["unlimited", "today"], queryFn: () => orgApi.today(), retry: false, refetchInterval: 60_000 });
  if (today.isError) return null;
  const waiting = today.data?.needs_you.length ?? 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid="open-today-view"
        isActive={location.pathname === "/today"}
        onClick={() => void navigate({ to: "/today" as never })}
        tooltip="Today"
        type="button"
      >
        <Sun className="h-4 w-4" />
        <SidebarMenuLabel>Today</SidebarMenuLabel>
        {waiting ? (
          <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">{waiting}</span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** All projects' tasks on one page; the badge counts plans and results waiting for the owner. */
export function TasksSidebarEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const waiting = useQuery({ queryKey: ["unlimited", "tasks-waiting"], queryFn: () => odooApi.tasksWaiting(), retry: false, refetchInterval: 30_000 });
  const n = waiting.data?.count ?? 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid="open-tasks-view"
        isActive={location.pathname === "/tasks"}
        onClick={() => void navigate({ to: "/tasks" as never })}
        tooltip="Tasks"
        type="button"
      >
        <ListChecks className="h-4 w-4" />
        <SidebarMenuLabel>Tasks</SidebarMenuLabel>
        {n ? <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{n}</span> : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function TeamSidebarEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), retry: false, staleTime: 30_000 });
  if (org.isError) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-testid="open-team-view"
        isActive={location.pathname === "/team"}
        onClick={() => void navigate({ to: "/team" as never })}
        tooltip="Team"
        type="button"
      >
        <Network className="h-4 w-4" />
        <SidebarMenuLabel>Team</SidebarMenuLabel>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
