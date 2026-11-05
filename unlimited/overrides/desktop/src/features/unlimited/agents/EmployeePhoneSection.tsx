/**
 * Unlimited Agent — the employee's own phone number (Agents > employee > Phone). Calls to this number are
 * answered by this employee; when you ask it on a call to call you back, it calls you from this number.
 */
import { Loader2, Phone, PhoneOutgoing } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { phoneApi, type PhoneStatus } from "../voice/phoneApi";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function EmployeePhoneSection({ slug, name }: { slug: string; name: string }) {
  const [st, setSt] = React.useState<PhoneStatus | null>(null);
  const [num, setNum] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    phoneApi
      .status()
      .then((s) => {
        setSt(s);
        setNum(Object.entries(s.numbers).find(([, v]) => v === slug)?.[0] ?? "");
      })
      .catch((e: unknown) => setMsg({ ok: false, text: errorText(e) }));
  }, [slug]);

  const save = async () => {
    if (!st) return;
    setBusy("save");
    setMsg(null);
    try {
      const numbers = Object.fromEntries(Object.entries(st.numbers).filter(([n, v]) => v !== slug && n !== num.trim()));
      if (num.trim()) numbers[num.trim().replace(/\s/g, "")] = slug;
      setSt(await phoneApi.update({ numbers }));
      setMsg({ ok: true, text: num.trim() ? `${name} answers ${num.trim()} now.` : "Number removed." });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy("");
    }
  };

  const callMe = async () => {
    setBusy("call");
    setMsg(null);
    try {
      await phoneApi.callMe(slug, "This is a test call from Settings to check the phone line works.");
      setMsg({ ok: true, text: `${name} is calling your phone now.` });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy("");
    }
  };

  const has = Boolean(st && Object.values(st.numbers).includes(slug));
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Phone className="h-4 w-4 text-muted-foreground" /> Phone number
        </h3>
        <p className="text-xs text-muted-foreground">
          Calls to this number are answered by {name}. On a call, ask {name} to call you back when a task is done and it will, from this number.
          Buy numbers in Twilio (Phone Numbers &gt; Buy a number) and point them to Unlimited Agent.
        </p>
      </div>
      <div className="flex gap-2">
        <Input className="h-10" onChange={(e) => setNum(e.target.value)} placeholder="+15550100123" value={num} />
        <Button className="h-10" disabled={!st || busy !== ""} onClick={() => void save()} type="button">
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
        </Button>
      </div>
      {has ? (
        <Button className="gap-1.5" disabled={busy !== "" || !st?.twilio.connected} onClick={() => void callMe()} size="sm" type="button" variant="outline">
          {busy === "call" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" />} Have {name} call me now
        </Button>
      ) : null}
      {has && !st?.twilio.connected ? (
        <p className="text-xs text-muted-foreground">To let {name} call you, connect Twilio in Settings &gt; Voice &gt; Phone line.</p>
      ) : null}
      {msg ? <p className={msg.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>{msg.text}</p> : null}
    </div>
  );
}
