/**
 * Unlimited Agent — Software updates. Builds that carry the updater install the next release in place
 * with one click (signed .app archive from /dl/updater.json, then a restart). Older builds, or when the
 * in-place update fails, fall back to the release manifest (/dl/latest.json) and the Mac installer.
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
  const m = latest.data;
  const newer = m ? isNewer(m.release, UNLIMITED_RELEASE) : false;
  const inPlace = useInPlaceUpdate(newer);

  return (
    <section className="space-y-6" data-testid="unlimited-updates">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Software updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">You're on Unlimited Agent {UNLIMITED_RELEASE}.</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-background p-5">
        {latest.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking for updates…
          </p>
        ) : latest.isError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Couldn't reach the update server. Check your connection and try again.</p>
            <Button onClick={() => void latest.refetch()} size="sm" type="button" variant="outline">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        ) : newer && m ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Version {m.release} is available.</p>
            {m.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{m.notes}</p> : null}
            {inPlace.update && inPlace.state !== "failed" ? (
              <>
                <Button disabled={inPlace.state !== "ready"} onClick={() => void inPlace.install()} size="sm" type="button">
                  {inPlace.state === "ready" ? <Download className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {inPlace.state === "downloading"
                    ? `Downloading… ${inPlace.percent}%`
                    : inPlace.state === "installing"
                      ? "Installing… the app restarts by itself"
                      : `Update now to ${m.release}`}
                </Button>
                <p className="text-xs text-muted-foreground">The update installs in place and Unlimited Agent restarts. Nothing to delete or drag.</p>
              </>
            ) : (
              <>
                <Button onClick={() => void openUrl(`${BASE}${m.url}`)} size="sm" type="button">
                  <Download className="h-3.5 w-3.5" /> Download {m.release}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {inPlace.error ? `${inPlace.error} ` : ""}Open the downloaded file and drag Unlimited Agent into Applications (replace the old one).
                  From this version on, updates install with one click.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CircleCheck className="h-4 w-4 text-emerald-600" /> You have the latest version.
            </p>
            <Button onClick={() => void latest.refetch()} size="sm" type="button" variant="outline">
              <RefreshCw className="h-3.5 w-3.5" /> Check again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** The signed in-place update, when this build has the updater and the feed offers a newer release. */
function useInPlaceUpdate(enabled: boolean) {
  const [update, setUpdate] = React.useState<Update | null>(null);
  const [state, setState] = React.useState<"idle" | "ready" | "downloading" | "installing" | "failed">("idle");
  const [percent, setPercent] = React.useState(0);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    check()
      .then((u) => {
        if (!alive) return;
        setUpdate(u);
        setState(u ? "ready" : "idle");
      })
      .catch(() => {
        // Builds before 0.5.28-31 have no updater; they use the installer download.
        if (alive) setState("idle");
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  const install = async () => {
    if (!update) return;
    setState("downloading");
    setError("");
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
      setError(`The in-place update didn't finish (${e instanceof Error ? e.message : String(e)}).`);
      setState("failed");
    }
  };
  return { update, state, percent, error, install };
}
