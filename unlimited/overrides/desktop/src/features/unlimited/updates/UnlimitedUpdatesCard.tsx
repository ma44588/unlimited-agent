/**
 * Unlimited Agent — Software updates. Builds that carry the updater install the next release in place
 * with one click (signed .app archive from /dl/updater.json, then a restart). The Mac installer download
 * is only offered when this build has no updater or the in-place check failed, and the reason is shown.
 */
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { CircleCheck, Download, Loader2, RefreshCw } from "lucide-react";
import * as React from "react";

import { UNLIMITED_RELEASE } from "@/features/unlimited/updates/release";
import { Button } from "@/shared/ui/button";

const BASE = "https://app.unlimitedsolutions.technology";
type Manifest = { release: string; url: string; notes?: string; published_at?: string };

function parts(tag: string): number[] {
  return tag.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
}

export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export function UnlimitedUpdatesCard() {
  const latest = useQuery({
    queryKey: ["unlimited", "latest-release"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/dl/latest.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`The update server answered ${res.status}`);
      return (await res.json()) as Manifest;
    },
    retry: false,
  });
  const inPlace = useInPlaceUpdate();
  const m = latest.data;
  const newer = m ? isNewer(m.release, UNLIMITED_RELEASE) : false;
  const refresh = () => {
    void latest.refetch();
    inPlace.recheck();
  };

  let body: React.ReactNode;
  if (inPlace.update && inPlace.state !== "failed") {
    // The signed update is ready: one click, no file to open.
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Version {m?.release ?? inPlace.update.version} is available.</p>
        {m?.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{m.notes}</p> : null}
        <Button disabled={inPlace.state !== "ready"} onClick={() => void inPlace.install()} size="sm" type="button">
          {inPlace.state === "ready" ? <Download className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {inPlace.state === "downloading"
            ? `Updating… ${inPlace.percent}%`
            : inPlace.state === "installing"
              ? "Installing… the app restarts by itself"
              : "Update now"}
        </Button>
        <p className="text-xs text-muted-foreground">Installs in place and Unlimited Agent restarts. Nothing to download or drag.</p>
      </div>
    );
  } else if (inPlace.state === "checking" || latest.isLoading) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking for updates…
      </p>
    );
  } else if (newer && m) {
    // A newer release exists but this build can't install it in place: say why, then offer the installer.
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Version {m.release} is available.</p>
        {m.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{m.notes}</p> : null}
        {inPlace.error ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {inPlace.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {inPlace.error ? (
            <Button onClick={refresh} size="sm" type="button">
              <RefreshCw className="h-3.5 w-3.5" /> Try the one-click update again
            </Button>
          ) : null}
          <Button onClick={() => void openUrl(`${BASE}${m.url}`)} size="sm" type="button" variant={inPlace.error ? "outline" : "default"}>
            <Download className="h-3.5 w-3.5" /> Download installer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">With the installer: open the file and drag Unlimited Agent into Applications, replacing the old one.</p>
      </div>
    );
  } else if (latest.isError && !inPlace.checked) {
    body = (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Couldn't reach the update server. Check your connection and try again.</p>
        <Button onClick={refresh} size="sm" type="button" variant="outline">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CircleCheck className="h-4 w-4 text-emerald-600" /> You have the latest version.
        </p>
        <Button onClick={refresh} size="sm" type="button" variant="outline">
          <RefreshCw className="h-3.5 w-3.5" /> Check again
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6" data-testid="unlimited-updates">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Software updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">You're on Unlimited Agent {UNLIMITED_RELEASE}.</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-background p-5">{body}</div>
    </section>
  );
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The signed in-place update from /dl/updater.json, checked as soon as the screen opens. */
function useInPlaceUpdate() {
  const [update, setUpdate] = React.useState<Update | null>(null);
  const [state, setState] = React.useState<"checking" | "idle" | "ready" | "downloading" | "installing" | "failed">("checking");
  const [checked, setChecked] = React.useState(false);
  const [percent, setPercent] = React.useState(0);
  const [error, setError] = React.useState("");
  const [round, setRound] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    setState("checking");
    setError("");
    check({ timeout: 30_000 })
      .then((u) => {
        if (!alive) return;
        setUpdate(u);
        setState(u ? "ready" : "idle");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setUpdate(null);
        setError(`One-click update isn't available right now (${message(e)}).`);
        setState("idle");
      })
      .finally(() => {
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [round]);
  const install = async () => {
    if (!update) return;
    setState("downloading");
    setError("");
    setPercent(0);
    let total = 0;
    let got = 0;
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        else if (e.event === "Progress") {
          got += e.data.chunkLength;
          if (total) setPercent(Math.min(99, Math.round((got / total) * 100)));
        } else if (e.event === "Finished") setState("installing");
      });
      await relaunch();
    } catch (e) {
      setError(`The one-click update didn't finish (${message(e)}).`);
      setState("failed");
      setUpdate(null);
    }
  };
  return { update, state, checked, percent, error, install, recheck: () => setRound((r) => r + 1) };
}
