import { CircleCheck, CircleX, Cloud, GitBranch, Loader2, Lock, Search, Server } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

import { type CheckStep, type OdooProject, type OdooShBranch, type OdooShProject, odooApi } from "./api";

const STEPS = ["Hosting", "Odoo", "GitHub", "Agents"] as const;
const AGENT_INFO: Record<string, string> = {
  developer: "Writes modules, pushes to staging and follows the builds",
  documentation: "Writes user guides with screenshots from staging",
};
const CHECK_LABEL: Record<string, string> = {
  github: "GitHub write access",
  build: "Latest staging build found",
  ssh: "Server reaches the build",
  agent: "Agent user ready on staging",
  version: "Odoo version detected",
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ConnectOdooWizard({
  buzzProjectId,
  defaultName,
  existing,
  onDone,
  onOpenChange,
  open,
}: {
  buzzProjectId: string;
  defaultName: string;
  existing?: OdooProject | null;
  onDone: (p: OdooProject) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [step, setStep] = React.useState(existing ? 1 : 0);
  const [projects, setProjects] = React.useState<OdooShProject[] | null>(null);
  const [branches, setBranches] = React.useState<OdooShBranch[] | null>(null);
  const [allAgents, setAllAgents] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [odooSh, setOdooSh] = React.useState(existing?.odoosh_project ?? "");
  const [branch, setBranch] = React.useState(existing?.branch ?? "stag");
  const [agents, setAgents] = React.useState<string[]>(existing?.agents ?? ["developer", "documentation"]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<OdooProject | null>(null);
  const [checks, setChecks] = React.useState<CheckStep[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    odooApi.odooShProjects().then(setProjects).catch((e: Error) => setError(e.message));
    odooApi.overview().then((o) => setAllAgents(o.agents)).catch(() => undefined);
  }, [open]);

  React.useEffect(() => {
    if (!odooSh) return;
    setBranches(null);
    odooApi
      .branches(odooSh)
      .then((rows) => {
        setBranches(rows);
        const staging = rows.filter((b) => b.stage === "staging" && !b.locked);
        if (!staging.some((b) => b.name === branch) && staging[0]) setBranch(staging[0].name);
      })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odooSh]);

  const selected = projects?.find((p) => p.name === odooSh);
  const stagingBranches = (branches ?? []).filter((b) => b.stage === "staging" && !b.locked);
  const locked = (branches ?? []).filter((b) => b.locked).map((b) => b.name);
  const filtered = (projects ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const canNext =
    step === 0 || (step === 1 && Boolean(odooSh) && stagingBranches.some((b) => b.name === branch)) || step === 2;

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const p = await odooApi.save({ buzz_project: buzzProjectId, name: defaultName, odoosh_project: odooSh, branch, agents });
      setSaved(p);
      setStep(4);
      const res = await odooApi.check(p.id);
      setChecks(res.steps);
    } catch (e) {
      setError((e as Error).message);
      setChecks((c) => c ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] w-[720px] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-border/60 px-6 pb-4 pt-5">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-lg font-semibold">{existing ? "Manage connection" : "Connect Odoo & GitHub"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {step < 4 ? `Step ${step + 1} of 4 · ${STEPS[step]}` : "Checking the connection"}
            </DialogDescription>
          </div>
          <ol aria-label="Steps" className="grid grid-cols-4 gap-2">
            {STEPS.map((label, i) => (
              <li aria-current={i === step ? "step" : undefined} className="flex flex-col gap-1.5" key={label}>
                <span className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                <span className={cn("text-xs", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {i + 1} · {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-h-[320px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {step === 0 ? (
            <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Where does this client's Odoo run?</legend>
              <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-primary bg-primary/5 p-4">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Cloud className="h-4 w-4 text-primary" /> Odoo.sh
                  <input checked className="ml-auto accent-[hsl(var(--primary))]" name="hosting" readOnly type="radio" />
                </span>
                <span className="text-xs text-muted-foreground">
                  Picked straight from your Odoo.sh account. Builds, logs and staging are followed automatically.
                </span>
              </label>
              <label aria-disabled className="flex flex-col gap-2 rounded-xl border border-border/70 p-4 opacity-60">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Server className="h-4 w-4" /> Own server
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Soon</span>
                </span>
                <span className="text-xs text-muted-foreground">Client servers and Odoo Online, through a staging copy.</span>
              </label>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Odoo.sh projects on your account</span>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <input
                    aria-label="Search projects"
                    className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={projects ? `Search ${projects.length} projects` : "Loading projects…"}
                    type="search"
                    value={query}
                  />
                </label>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70">
                  {projects === null && !error ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Reading your Odoo.sh account…
                    </div>
                  ) : null}
                  {filtered.map((p) => {
                    const taken = Boolean(p.connected_as) && p.name !== existing?.odoosh_project;
                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border-b border-border/50 px-3.5 py-3 text-sm last:border-b-0",
                          odooSh === p.name && "bg-muted/60",
                          taken && "cursor-not-allowed opacity-50",
                        )}
                        key={p.name}
                      >
                        <input
                          checked={odooSh === p.name}
                          className="accent-[hsl(var(--primary))]"
                          disabled={taken}
                          name="odoosh"
                          onChange={() => setOdooSh(p.name)}
                          type="radio"
                        />
                        <span className={cn("flex-1", odooSh === p.name && "font-semibold")}>{p.name}</span>
                        <span className="text-xs text-muted-foreground">{taken ? "Already connected" : p.repo}</span>
                        {p.version ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{p.version}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
              {odooSh ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Branch agents work on</span>
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      disabled={!branches}
                      onChange={(e) => setBranch(e.target.value)}
                      value={branch}
                    >
                      {stagingBranches.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} · Staging</option>
                      ))}
                    </select>
                    {branches && stagingBranches.length === 0 ? (
                      <span className="text-xs text-destructive">This project has no staging branch yet. Add one in Odoo.sh first.</span>
                    ) : null}
                  </label>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Production</span>
                    <span className="flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" /> {locked.join(", ") || "production"} · locked
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                The repository comes from Odoo.sh, so there is nothing to paste. Agents push only to the staging branch.
              </p>
              <dl className="divide-y divide-border/60 rounded-xl border border-border/70 text-sm">
                <Row label="Repository" value={selected?.repo ?? existing?.repo ?? "—"} icon={<GitBranch className="h-4 w-4" />} />
                <Row label="Agents push to" value={branch} />
                <Row label="Locked (never pushed)" value={[...new Set([...locked, "main", "master"])].join(", ")} icon={<Lock className="h-3.5 w-3.5" />} />
                <Row label="Access" value="Server deploy key · no personal token" />
              </dl>
            </div>
          ) : null}

          {step === 3 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Agents on this project</legend>
              {(allAgents.length ? allAgents : ["developer", "documentation"]).map((a) => (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 px-4 py-3" key={a}>
                  <input
                    checked={agents.includes(a)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    onChange={(e) => setAgents((cur) => (e.target.checked ? [...cur, a] : cur.filter((x) => x !== a)))}
                    type="checkbox"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{titleCase(a)}</span>
                    <span className="text-xs text-muted-foreground">{AGENT_INFO[a] ?? "AI employee"}</span>
                  </span>
                </label>
              ))}
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 px-4 py-3 opacity-60">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">Analyst</span>
                  <span className="text-xs text-muted-foreground">Fit-gap analysis · coming soon</span>
                </span>
              </div>
            </fieldset>
          ) : null}

          {step === 4 ? (
            <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Automatic setup</h3>
              <ul className="flex flex-col gap-2.5 text-sm">
                {(checks ?? Object.keys(CHECK_LABEL).map((key) => ({ key, ok: false, detail: null }))).map((s) => (
                  <li className="flex items-center gap-2.5" key={s.key}>
                    {checks === null ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : s.ok ? (
                      <CircleCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <CircleX className="h-4 w-4 text-destructive" />
                    )}
                    <span className="flex-1">{CHECK_LABEL[s.key] ?? s.key}</span>
                    <span className="max-w-[45%] truncate text-xs text-muted-foreground" title={String(s.detail ?? "")}>
                      {checks === null ? "" : s.key === "build" && s.ok ? `#${s.detail}` : String(s.detail ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
          {step > 0 && step < 4 ? (
            <Button onClick={() => setStep((s) => s - 1)} variant="outline">Back</Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">No passwords or keys to paste</span>
          {step < 3 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : step === 3 ? (
            <Button disabled={busy || agents.length === 0} onClick={connect}>
              {busy ? <Loader2 className="animate-spin" /> : null} Connect
            </Button>
          ) : (
            <Button disabled={checks === null} onClick={() => saved && onDone(saved)}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <dt className="w-44 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 truncate font-medium">{icon}{value}</dd>
    </div>
  );
}
