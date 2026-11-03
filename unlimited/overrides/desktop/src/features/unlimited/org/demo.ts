/** Design preview only (window.__BUZZ_E2E__): sample org, plan and Today so the screens can be reviewed. */
const P = (id: string, name: string, title: string, kind: "ai" | "human", reports_to: string | null, extra: Record<string, unknown> = {}) => ({
  id, name, title, kind, reports_to, slug: id.replace("ai:", ""), capacity: 3, approves: [], status: "running", ...extra,
});
const people = [
  P("owner", "Mostafa Gabr", "CEO", "human", null, { owner: true, approves: ["plan", "staging", "production"] }),
  P("human:k", "Karim Adel", "Head of Delivery", "human", "owner", { approves: ["plan"] }),
  P("ai:hany", "Hany Saleh", "Tech Lead", "ai", "human:k", { lead: true }),
  P("ai:salma", "Salma Nabil", "Sales Lead", "ai", "human:k"),
  P("ai:farida", "Farida Ali", "Accounting", "ai", "human:k"),
  P("ai:omar", "Omar Hassan", "Senior Dev", "ai", "ai:hany", { odoo_user: "omar@unlimitedsolutions.technology" }),
  P("ai:yousef", "Yousef Samir", "Developer", "ai", "ai:hany"),
  P("ai:nour", "Nour Adel", "Developer", "ai", "ai:hany"),
  P("human:r", "Rana Sayed", "QA", "human", "ai:hany", { approves: ["staging"] }),
];
const T = (id: number, name: string, status: "open" | "done" | "blocked", spent = 0) => ({
  id, name, ref: `#${id}`, project: "Odoo 18 migration", stage: status === "done" ? "Done" : "In Progress", status, hours: 2, spent, url: "",
});
const row = (id: string, tasks: ReturnType<typeof T>[]) => ({
  member: people.find((p) => p.id === id)!, tasks, total: tasks.length,
  done: tasks.filter((t) => t.status === "done").length, blocked: tasks.filter((t) => t.status === "blocked").length,
  now: tasks.find((t) => t.status === "open")?.name ?? null, hours: tasks.length * 2, spent: tasks.reduce((a, t) => a + t.spent, 0),
});
const rows = [
  row("ai:omar", [T(412, "Migrate sale_custom to 18.0", "done", 2.5), T(415, "Fix invoice report header", "done", 1), T(418, "stock.move compute is slow", "open", 2)]),
  row("ai:yousef", [T(420, "Import client price lists", "blocked"), T(421, "Portal access rules", "open")]),
  row("ai:nour", [T(399, "Payroll rules review", "done"), T(402, "Website menu fix", "done"), T(404, "POS receipt layout", "done")]),
];
const iso = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const settings = { tz: "Africa/Cairo", plan_at: "08:00", report_at: "17:00", escalate_minutes: 30, workdays: [6, 0, 1, 2, 3], projects: [] };

/** Returns undefined when the path is not an org route. */
export function orgDemo(_method: string, path: string): unknown {
  if (path === "/admin/today")
    return {
      date: new Date().toISOString().slice(0, 10), tz: "Africa/Cairo", me: people[0], odoo: true, has_teams: true, settings,
      summary: { tasks: 8, done: 5, blocked: 1, open: 2, percent: 63 },
      needs_you: [{ kind: "plan", id: "demo-plan", lead: people[2], tasks: 8, people: 3, since: iso(20) }],
      teams: [{ plan: "demo-plan", status: "approved", lead: people[2], approver: people[1], decided_by: people[1], decided_at: iso(240), members: rows, notes: [] }],
    };
  if (path === "/admin/org")
    return { members: people.map((p) => ({ ...p, reports: people.filter((x) => x.reports_to === p.id).map((x) => x.id) })), settings,
      odoo: { kind: "company_odoo", state: "connected", detail: "https://unlimitedsolutions.technology · company · mostafa" } };
  if (path === "/admin/phone" || path.startsWith("/admin/phone/"))
    return { webhook: "", numbers: { "+12188456005": "developer" }, owner_phones: ["+966536428369"],
      twilio: { connected: true, account: "AC629694…" }, openai: true, recent: [] };
  if (path === "/admin/org/odoo-projects") return [{ id: 1, name: "Odoo 18 migration" }, { id: 2, name: "Internal tools" }];
  if (path.startsWith("/admin/plans/") && !path.endsWith("/decide"))
    return { id: "demo-plan", date: new Date().toISOString().slice(0, 10), lead: "ai:hany", status: "pending", approver: "human:k", created_at: iso(60),
      rows, lead_member: people[2], approver_member: people[1], team: [people[5], people[6], people[7]],
      notes: ["#420 needs the client CSV. Hany asked Salma to chase it."] };
  if (path.endsWith("/odoo")) return { login: "omar@unlimitedsolutions.technology", connected: true, checked_at: iso(30) };
  if (path.endsWith("/day"))
    return { member: people[5], manager: people[2], reports: [], approvers: { plan: people[1], drafted_by: people[2], staging: people[8], production: people[0] },
      date: "", plan_status: "approved", tasks: rows[0]!.tasks, done: 2, hours: 6, spent: 5.5 };
  if (path.startsWith("/admin/org") || path.startsWith("/admin/plans")) return { members: people, settings, odoo: { state: "connected", detail: "" } };
  return undefined;
}
