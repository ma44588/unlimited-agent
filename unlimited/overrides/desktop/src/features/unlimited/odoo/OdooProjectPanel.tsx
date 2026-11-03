import {
  Activity, Bot, CircleCheck, CircleX, Clock, Database, ExternalLink, GitBranch, HeartPulse,
  Loader2, Lock, Plus, RefreshCw, ShieldCheck,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { type Org, orgApi } from "../org/api";
import { OrgAvatar } from "../org/ui";
import { ApiError, type HealthReport, type OdooProject, type ProjectStatus, odooApi } from "./api";
import { ConnectOdooWizard } from "./ConnectOdooWizard";

const TOOL_LABEL: Record<string, string> = {
  odoo_fields: "Read the data model",
  odoo_search_read: "Read records",
  odoo_call: "Ran an Odoo action",
  odoo_install_modules: "Installed modules",
  repo_sync: "Synced the repository",
  repo_commit_push: "Pushed to staging",
  build_wait: "Followed the build",
  build_status: "Checked the build",
  build_logs: "Read the build logs",
  build_errors: "Read build errors",
  db_query: "Queried the database (read-only)",
  health_check: "Ran a health check",
  project_info: "Read the project profile",
};

function ago(ts?: string) {
  if (!ts) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function OdooProjectPanel({ buzzProjectId, projectName }: { buzzProjectId: string; projectName: string }) {
  const [project, setProject] = React.useState<OdooProject | null | undefined>(undefined);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [wizard, setWizard] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState<number | undefined>(undefined);

  const load = React.useCallback(() => {
    setError(null);
    odooApi.byBuzz(buzzProjectId).then(setProject).catch((e: ApiError) => setError(e));
  }, [buzzProjectId]);
  React.useEffect(load, [load]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <Notice
        action={<Button onClick={load} size="sm" variant="outline"><RefreshCw /> Try again</Button>}
        text={error.status === 401 ? "Only the workspace owner can manage project connections." : error.message}
        title={error.status === 401 ? "Owner access needed" : "Couldn't reach the connector"}
      />
    );
  } else if (project === undefined) {
    body = (
      <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connection…
      </div>
    );
  } else if (project === null) {
    body = <FirstConnection onStart={() => setWizard(true)} />;
  } else {
    body = (
      <ConnectedDashboard
        onManage={() => {
          setWizardStep(undefined);
          setWizard(true);
        }}
        onManageAgents={() => {
          setWizardStep(3);
          setWizard(true);
        }}
        project={project}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="unlimited-odoo-panel">
      {body}
      {wizard ? (
        <ConnectOdooWizard
          buzzProjectId={buzzProjectId}
          defaultName={projectName}
          existing={project ?? null}
          startStep={wizardStep}
          onDone={(p) => {
            setWizard(false);
            setProject(p);
          }}
          onOpenChange={setWizard}
          open
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ first connection
function FirstConnection({ onStart }: { onStart: () => void }) {
  const steps = [
    ["Connect Odoo", "Pick it from your Odoo.sh account"],
    ["Link GitHub", "The repo and staging branch come with it"],
    ["Assign agents", "Developer, Documentation and more"],
  ];
  const can = [
    "Read the data model", "Write modules and push to staging", "Follow every Odoo.sh build",
    "Read logs and fix errors", "Run a health check", "Document with screenshots",
  ];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Connect this project to Odoo & GitHub</h2>
          <p className="text-sm text-muted-foreground">
            Connect the client's Odoo and GitHub once. Your agents read the data, push to staging, follow the build
            and report back, all inside this project.
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li className="flex gap-3 rounded-xl bg-muted/40 p-3.5" key={t}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{t}</span>
                <span className="text-xs text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-3">
          <Button onClick={onStart}><Plus /> Connect Odoo & GitHub</Button>
          <span className="text-xs text-muted-foreground">Takes about 2 minutes · no passwords to paste</span>
        </div>
      </section>
      <section className="flex flex-col gap-3 px-1">
        <h3 className="text-sm font-semibold">Once connected, your agents can</h3>
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {can.map((c) => (
            <li className="flex items-center gap-2" key={c}>
              <CircleCheck className="h-4 w-4 text-primary" /> {c}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Production is never touched. Anything irreversible waits for your approval.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ connected
function ConnectedDashboard({
  project,
  onManage,
  onManageAgents,
}: {
  project: OdooProject;
  onManage: () => void;
  onManageAgents: () => void;
}) {
  const [org, setOrg] = React.useState<Org | null>(null);
  React.useEffect(() => {
    orgApi.org().then(setOrg).catch(() => undefined);
  }, []);
  const [status, setStatus] = React.useState<ProjectStatus | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<HealthReport | null>(null);
  const [healthBusy, setHealthBusy] = React.useState(false);
  const [deciding, setDeciding] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    odooApi.status(project.id).then((s) => { setStatus(s); setErr(null); }).catch((e: Error) => setErr(e.message));
  }, [project.id]);
  React.useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 30000);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function runHealth() {
    setHealthBusy(true);
    try { setHealth(await odooApi.health(project.id)); } catch (e) { setErr((e as Error).message); } finally { setHealthBusy(false); }
  }
  async function decide(id: string, d: "approve" | "reject") {
    setDeciding(id);
    try { await odooApi.decide(id, d); refresh(); } catch (e) { setErr((e as Error).message); } finally { setDeciding(null); }
  }

  const build = status && typeof status.build.detail === "object" ? status.build.detail : null;
  const buildOk = build?.state === "success";
  const sessionOk = status?.session?.ok !== false;
  const healthWarn = health?.checks?.filter((c) => c.status !== "ok") ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-base font-semibold">{project.name}</h2>
          <span className="text-xs text-muted-foreground">
            Odoo {project.odoo_version || "—"} · {project.provider === "cicdoo" ? "CICDoo" : "Odoo.sh"} · {project.repo}
          </span>
        </div>
        {build?.url ? (
          <Button asChild size="sm" variant="outline">
            <a href={build.url} rel="noreferrer" target="_blank"><ExternalLink /> Open staging</a>
          </Button>
        ) : null}
        <Button onClick={onManage} size="sm" variant="outline">Manage</Button>
      </div>

      {!sessionOk ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          The Odoo.sh session expired. Run "Odoo.sh Session Update" from the Unlimited Tools folder to renew it.
        </p>
      ) : null}
      {err ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Database} label="Odoo" value={sessionOk ? "Connected" : "Session expired"} tone={sessionOk ? "good" : "bad"}
          sub="Staging only · production locked" />
        <Stat icon={Activity} label="Latest build" tone={!status ? "idle" : buildOk ? "good" : build?.state === "pending" ? "idle" : "bad"}
          value={!status ? "…" : build ? cap(build.state === "success" ? "passed" : build.state ?? "unknown") : "No build"}
          sub={build?.build_id ? `#${build.build_id}` : typeof status?.build.detail === "string" ? status.build.detail : ""} />
        <Stat icon={HeartPulse} label="Health" tone={health ? (healthWarn.length ? "warn" : "good") : "idle"}
          value={health?.score != null ? `${health.score} / 100` : "Not run yet"}
          sub={health ? (healthWarn.length ? `${healthWarn.length} warning · ${healthWarn[0].name.replace(/_/g, " ")}` : "All checks passed") : ""}
          action={<Button disabled={healthBusy} onClick={runHealth} size="xs" variant="ghost">{healthBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run</Button>} />
        <Stat icon={Clock} label="Waiting for you" tone={status?.approvals.length ? "warn" : "good"}
          value={status ? `${status.approvals.length} approval${status.approvals.length === 1 ? "" : "s"}` : "…"}
          sub="Irreversible actions never run alone" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {status?.approvals.map((a) => (
            <section className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/10" key={a.id}>
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Approval needed</div>
              <p className="text-sm">{cap(a.agent)} wants to: {a.reason}</p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background/80 p-2.5 text-[11px] leading-relaxed">{a.tool} {a.args}</pre>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground">Runs once, exactly as shown</span>
                <Button disabled={deciding === a.id} onClick={() => decide(a.id, "reject")} size="sm" variant="outline">Reject</Button>
                <Button disabled={deciding === a.id} onClick={() => decide(a.id, "approve")} size="sm">Approve</Button>
              </div>
            </section>
          ))}
          <section className="rounded-xl border border-border/70 bg-card">
            <h3 className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Agent activity</h3>
            <ul className="divide-y divide-border/50">
              {(status?.activity ?? []).length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">{status ? "No agent activity yet." : "Loading…"}</li>
              ) : null}
              {status?.activity.map((e) => (
                <li className="flex items-center gap-3 px-4 py-2.5 text-sm" key={e.seq}>
                  {e.outcome === "ok" ? <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" /> : <CircleX className="h-4 w-4 shrink-0 text-destructive" />}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{cap(e.agent)}</span>{" "}
                    <span className="text-muted-foreground">{(TOOL_LABEL[e.tool] ?? e.tool).toLowerCase()}</span>
                    {e.outcome !== "ok" && e.detail ? <span className="text-destructive"> · {e.detail.slice(0, 80)}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(e.ts)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card onManage={onManageAgents} title={`Agents on this project · ${project.agents.length}`}>
            {project.agents.length === 0 ? <p className="px-4 pb-3 text-sm text-muted-foreground">No agents assigned.</p> : null}
            {project.agents.map((a) => {
              const m = org?.members.find((x) => x.slug === a);
              return (
                <div className="flex items-center gap-3 px-4 py-1.5" key={a}>
                  {m ? (
                    <OrgAvatar badge={false} person={m} size={30} />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m?.name ?? cap(a)}</span>
                    {m?.title ? <span className="block truncate text-xs text-muted-foreground">{m.title}</span> : null}
                  </span>
                </div>
              );
            })}
          </Card>
          <Card onManage={onManage} title="GitHub">
            <Detail label="Repository" value={project.repo} icon={<GitBranch className="h-3.5 w-3.5" />} />
            <Detail label="Agents push to" value={project.branch} />
            <Detail label="Locked" value={[...new Set([...project.locked_branches, "main", "master"])].join(", ")} icon={<Lock className="h-3.5 w-3.5" />} />
          </Card>
          <Card onManage={onManage} title="Odoo">
            {project.provider === "cicdoo" ? (
              <Detail label="Staging instance" value={project.odoo_url ? project.odoo_url.replace(/^https?:\/\//, "") : "—"} />
            ) : (
              <>
                <Detail label="Odoo.sh project" value={project.odoosh_project} />
                <Detail label="Staging build" value={build?.build_id ? `#${build.build_id}` : "—"} />
              </>
            )}
            <Detail label="Agent user" value={project.agent_login} />
            <Detail label="Database" value="Read-only queries" />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone, action }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string;
  tone: "good" | "warn" | "bad" | "idle"; action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> <span className="flex-1">{label}</span> {action}
      </div>
      <div className="flex items-center gap-2 text-base font-semibold">
        <span className={cn("h-2 w-2 rounded-full",
          tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-destructive" : "bg-muted-foreground/40")} />
        {value}
      </div>
      {sub ? <div className="truncate text-xs text-muted-foreground">{sub}</div> : null}
    </section>
  );
}

function Card({ title, onManage, children }: { title: string; onManage: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card pb-2">
      <div className="flex items-center px-4 pb-1 pt-3">
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        <button className="text-xs font-medium text-primary hover:underline" onClick={onManage} type="button">Manage</button>
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-sm">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">{icon}{value}</span>
    </div>
  );
}

function Notice({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-12 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
