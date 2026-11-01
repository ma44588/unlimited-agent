/**
 * Unlimited Agent — Software updates. Reads the release manifest our server publishes with every
 * release (/dl/latest.json) and offers the new Mac installer. Replaces Buzz's updater feed.
 */
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CircleCheck, Download, Loader2, RefreshCw } from "lucide-react";

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
            <Button onClick={() => void openUrl(`${BASE}${m.url}`)} size="sm" type="button">
              <Download className="h-3.5 w-3.5" /> Download {m.release}
            </Button>
            <p className="text-xs text-muted-foreground">Open the downloaded file and drag Unlimited Agent into Applications.</p>
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
