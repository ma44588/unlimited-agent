/** Design preview only (window.__BUZZ_E2E__): sample org, plan and Today so the screens can be reviewed. */
const P = (id: string, name: string, title: string, kind: "ai" | "human", reports_to: string | null, extra: Record<string, unknown> = {}) => ({
  id, name, title, kind, reports_to, slug: id.replace("ai:", ""), capacity: 3, approves: [], status: "running", ...extra,
});
const people = [
  P("owner", "Mostafa Gabr", "CEO", "human", null, { owner: true, approves: ["plan", "staging", "production"], avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/55f0e36b1379321f2050.jpg" }),
  P("ai:karim", "Karim", "Head of Delivery", "ai", "owner", { dept: "dl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/548badd43fc0bcd7da01.jpg" }),
  P("ai:rana", "Rana", "Head of Growth", "ai", "owner", { dept: "gr", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/9110e64537933b98955e.jpg" }),
  P("ai:bassem", "Bassem", "Project Manager", "ai", "ai:karim", { dept: "dl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/015dc95c18672d1d5a3e.jpg" }),
  P("ai:sara", "Sara", "QA Lead", "ai", "ai:karim", { dept: "dl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/c786df2ce3797f876882.jpg" }),
  P("ai:mazen", "Mazen", "DevOps Engineer", "ai", "ai:karim", { dept: "dl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/08414c11635156327617.jpg" }),
  P("ai:documentation", "Rami", "Delivery Officer", "ai", "ai:karim", { dept: "dl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/dead84a394e9be4f963e.jpg" }),
  P("ai:hana", "Hana", "Lead Business Analyst", "ai", "ai:karim", { dept: "ba", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/dcd57a09d66d11545c31.jpg" }),
  P("ai:reem", "Reem", "Business Analyst", "ai", "ai:hana", { dept: "ba", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/3c35050c5f83089d497f.jpg" }),
  P("ai:khaled", "Khaled", "Lead Implementer", "ai", "ai:karim", { dept: "im", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/7ec01e2d78e558bd5d00.jpg" }),
  P("ai:mona", "Mona", "Odoo Implementer (Finance & Inventory)", "ai", "ai:khaled", { dept: "im", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/bba46fab54e7f8fb95cb.jpg" }),
  P("ai:waleed", "Waleed", "Odoo Implementer (Sales, CRM & HR)", "ai", "ai:khaled", { dept: "im", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/b2d8ae35fd06e1f1cb63.jpg" }),
  P("ai:omar", "Omar", "Technical Lead", "ai", "ai:karim", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/2b99b56a9872ae2e2b28.jpg" }),
  P("ai:developer", "Youssef", "Senior Odoo Developer", "ai", "ai:omar", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/1d75947379e1ef28c788.jpg" }),
  P("ai:nour", "Nour", "Odoo Reports Developer", "ai", "ai:omar", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/293fb9fc801ee0e405d6.jpg" }),
  P("ai:laila", "Laila", "Website & Frontend Developer", "ai", "ai:omar", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/37d8b4e968e865c83ed4.jpg" }),
  P("ai:tarek", "Tarek", "Integration Developer", "ai", "ai:omar", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/804d035d6963d0740c7f.jpg" }),
  P("ai:ziad", "Ziad", "Data Migration Specialist", "ai", "ai:omar", { dept: "dv", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/d0f05df5c5f229991b2b.jpg" }),
  P("ai:mariam", "Mariam", "Marketing Manager", "ai", "ai:rana", { dept: "mk", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/f9e6d35cd298203c6ecf.jpg" }),
  P("ai:salma", "Salma", "Content Writer", "ai", "ai:mariam", { dept: "mk", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/6db5a91f9e31886bc0df.jpg" }),
  P("ai:dina", "Dina", "Social Media & Ads Specialist", "ai", "ai:mariam", { dept: "mk", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/faa84a0f9812746bf2bd.jpg" }),
  P("ai:samir", "Samir", "Sales Manager", "ai", "ai:rana", { dept: "sl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/ca11dba5f519065fe1fe.jpg" }),
  P("ai:adam", "Adam", "Pre-sales & Proposal Writer", "ai", "ai:samir", { dept: "sl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/71810d1c7899c512bb21.jpg" }),
  P("ai:jana", "Jana", "Account Manager", "ai", "ai:samir", { dept: "sl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/e86aaf12e96eef3b6ad2.jpg" }),
  P("ai:yara", "Yara", "Lead Generation Specialist", "ai", "ai:samir", { dept: "sl", avatar: "https://app.unlimitedsolutions.technology/unlimited-api/avatars/442f4f02bc4599a508d9.jpg" }),
];
const departments = [
  { id: "dl", name: "Delivery", head: "ai:karim", parent: "" },
  { id: "ba", name: "Business Analysis", head: "ai:hana", parent: "dl" },
  { id: "im", name: "Implementation", head: "ai:khaled", parent: "dl" },
  { id: "dv", name: "Development", head: "ai:omar", parent: "dl" },
  { id: "gr", name: "Growth", head: "ai:rana", parent: "" },
  { id: "mk", name: "Marketing", head: "ai:mariam", parent: "gr" },
  { id: "sl", name: "Sales", head: "ai:samir", parent: "gr" },
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
  row("ai:developer", [T(412, "Migrate sale_custom to 18.0", "done", 2.5), T(415, "Fix invoice report header", "done", 1), T(418, "stock.move compute is slow", "open", 2)]),
  row("ai:tarek", [T(420, "Import client price lists", "blocked"), T(421, "Portal access rules", "open")]),
  row("ai:nour", [T(399, "Payroll rules review", "done"), T(402, "Website menu fix", "done"), T(404, "POS receipt layout", "done")]),
  row("ai:mona", [T(430, "VAT setup review", "open")]),
];
const iso = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const settings = { tz: "Africa/Cairo", plan_at: "08:00", report_at: "17:00", escalate_minutes: 30, workdays: [6, 0, 1, 2, 3], projects: [] };

const DEMO_DEPLOY: Record<string, { state: "building" | "waiting" | "live" | "failed"; task: string; since: string; branch: string; project: string }> = {
  "ai:developer": { state: "building", task: "stock.move compute is slow", since: iso(4), branch: "test_1", project: "alfares" },
  "ai:nour": { state: "waiting", task: "Arabic invoice layout", since: iso(2), branch: "test_1", project: "alfares" },
  "ai:mona": { state: "live", task: "VAT setup review", since: iso(40), branch: "test_1", project: "alfares" },
};

/** Returns undefined when the path is not an org route. */
export function orgDemo(_method: string, path: string): unknown {
  if (path === "/admin/today")
    return {
      date: new Date().toISOString().slice(0, 10), tz: "Africa/Cairo", me: people[0], odoo: true, has_teams: true, settings,
      summary: { tasks: 8, done: 5, blocked: 1, open: 2, percent: 63 },
      needs_you: [{ kind: "plan", id: "demo-plan", lead: people[2], tasks: 8, people: 3, since: iso(20) }],
      teams: [{ plan: "demo-plan", status: "approved", lead: people[2], approver: people[1], decided_by: people[1], decided_at: iso(240),
        members: rows.map((r) => ({ ...r, ...(DEMO_DEPLOY[r.member.id] ? { deploy: DEMO_DEPLOY[r.member.id] } : {}) })), notes: [] }],
      deploys: [{ project: "alfares", name: "Alfares", branch: "test_1", building: true, by: "Youssef", waiting: 1 }],
    };
  if (path === "/admin/org")
    return { members: people.map((p) => ({ ...p, reports: people.filter((x) => x.reports_to === p.id).map((x) => x.id) })), settings,
      odoo: { kind: "company_odoo", state: "connected", detail: "https://unlimitedsolutions.technology · company · mostafa" }, departments };
  if (path === "/admin/phone" || path.startsWith("/admin/phone/"))
    return { webhook: "", numbers: { "+15550100123": "developer" }, owner_phones: ["+966500000000"],
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
