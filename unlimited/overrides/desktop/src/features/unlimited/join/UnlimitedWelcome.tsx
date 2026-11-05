/**
 * Unlimited Agent — first screen of the app (Mac and Windows).
 * Page 1: what the app is (the AI team at work) with "Join with your invite" and an arrow down.
 * Page 2: sign in with the email the invite was sent to (6-digit code) or with the invite link.
 * Then: who invited you → Join. The sign-in key is made on this device and never shown.
 */
import * as React from "react";

import { useCommunities } from "@/features/communities/useCommunities";
import { getIdentity } from "@/shared/api/tauriIdentity";
import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";

import { type JoinInfo, joinApi } from "./api";

type Page = "hero" | "signin" | "code" | "invited" | "waiting";
type Tab = "email" | "link";

const CSS = `
.uw{--bg:#0c0814;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--text:#f4f0fa;--sub:#b4a9c7;--faint:#7d7290;
 --win1:rgba(29,20,48,.94);--win2:rgba(18,12,29,.96);--field:rgba(255,255,255,.05);--mt:#ddd4ea;--glass:rgba(23,16,36,.78);
 --a1:rgba(122,71,147,.45);--a2:rgba(154,51,103,.35);--a3:rgba(66,28,99,.55);--grad:linear-gradient(90deg,#d9b8ff,#f08cc0 60%,#ffc6e0);--link:#c58be6}
@media (prefers-color-scheme: light){.uw{--bg:#f7f3fb;--line:rgba(40,16,60,.08);--line2:rgba(40,16,60,.14);--text:#1a1024;--sub:#5d5170;
 --faint:#8b809b;--win1:#fff;--win2:#fff;--field:#fff;--mt:#2a2036;--glass:rgba(255,255,255,.86);--a1:rgba(176,106,217,.2);
 --a2:rgba(224,106,164,.16);--a3:rgba(122,71,147,.14);--grad:linear-gradient(90deg,#7a4793,#9a3367 70%);--link:#7a4793}}
.uw{position:fixed;inset:0;overflow:hidden;background:var(--bg);color:var(--text);font:15px/1.6 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
 -webkit-font-smoothing:antialiased}
.uw *{box-sizing:border-box}
.uw-aur{position:absolute;inset:-20% -10% auto -10%;height:120%;filter:blur(20px);pointer-events:none;
 background:radial-gradient(40% 35% at 20% 20%,var(--a1),transparent 70%),radial-gradient(35% 30% at 85% 10%,var(--a2),transparent 70%),
 radial-gradient(40% 40% at 60% 70%,var(--a3),transparent 70%);animation:uwdrift 18s ease-in-out infinite alternate}
@keyframes uwdrift{to{transform:translate3d(-3%,4%,0) scale(1.06)}}
.uw-grid{position:absolute;inset:0;opacity:.35;pointer-events:none;background-image:linear-gradient(var(--line) 1px,transparent 1px),
 linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(70% 60% at 50% 30%,#000 30%,transparent 80%)}
.uw-pages{position:absolute;inset:0;transition:transform .55s cubic-bezier(.2,.8,.2,1)}
.uw-page{position:absolute;left:0;right:0;height:100%;overflow:auto}
.uw-in{position:relative;max-width:1180px;margin:0 auto;padding:44px 56px 120px}
.uw-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.uw-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#7A4793,#9A3367);display:grid;place-items:center;flex:none}
.uw-brand small{display:block;font-weight:500;font-size:10.5px;color:var(--faint);letter-spacing:.06em;margin-top:-3px}
.uw-hero{display:grid;grid-template-columns:1.02fr 1fr;gap:48px;align-items:center;margin-top:44px}
@media (max-width:900px){.uw-hero{grid-template-columns:1fr}.uw-win{display:none}}
.uw-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line2);background:rgba(127,127,127,.06);border-radius:999px;
 padding:6px 12px 6px 8px;font-size:13px;color:var(--sub)}
.uw-dot{width:8px;height:8px;border-radius:50%;background:#3ddc97;animation:uwping 2s infinite}
@keyframes uwping{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}
.uw h1{font-size:clamp(36px,4.2vw,54px);line-height:1.04;letter-spacing:-.035em;font-weight:800;margin:20px 0 16px}
.uw-grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.uw-lead{font-size:17px;color:var(--sub);max-width:520px;margin:0}
.uw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;padding:12px 20px;font-weight:600;font-size:14.5px;
 cursor:pointer;border:0;transition:transform .15s, box-shadow .15s;font-family:inherit}
.uw-btn:disabled{opacity:.6;cursor:default}
.uw-p{background:linear-gradient(135deg,#7A4793,#9A3367);color:#fff;box-shadow:0 8px 30px -8px rgba(176,106,217,.6)}
.uw-p:not(:disabled):hover{transform:translateY(-1px)}
.uw-g{background:rgba(127,127,127,.08);border:1px solid var(--line2);color:var(--text)}
.uw-ctas{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap}
.uw-trust{display:flex;gap:20px;margin-top:26px;color:var(--faint);font-size:13px;flex-wrap:wrap}
.uw-trust span:before{content:"\\2713  ";color:#3ddc97}
.uw-win{border:1px solid var(--line2);border-radius:18px;background:linear-gradient(180deg,var(--win1),var(--win2));box-shadow:0 40px 80px -20px rgba(0,0,0,.45);overflow:hidden}
.uw-bar{display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--faint)}
.uw-bar i{width:10px;height:10px;border-radius:50%;background:rgba(127,127,127,.3)}
.uw-bar b{color:var(--sub);font-weight:600;margin-left:8px}
.uw-msgs{padding:18px;display:flex;flex-direction:column;gap:14px;min-height:380px}
.uw-m{display:flex;gap:10px;opacity:0;transform:translateY(8px);animation:uwin .5s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes uwin{to{opacity:1;transform:none}}
.uw-av{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:700;font-size:12px;color:#fff}
.uw-mn{font-size:12.5px;font-weight:600}.uw-mn em{font-style:normal;font-weight:500;color:var(--faint);margin-left:6px;font-size:11px}
.uw-tag{font-size:10px;padding:1px 6px;border-radius:5px;background:rgba(176,106,217,.18);color:#b06ad9;margin-left:6px;font-weight:600}
.uw-mt{font-size:13.5px;color:var(--mt);margin-top:2px}
.uw-cin{margin-top:6px;border:1px solid var(--line2);border-radius:10px;padding:9px 11px;font-size:12.5px;color:var(--sub)}.uw-cin b{color:var(--text)}
.uw-chip{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;margin:6px 6px 0 0}
.uw-cg{background:rgba(61,220,151,.12);color:#22b47a}.uw-ca{background:rgba(245,185,85,.14);color:#c88a1c}
.uw-down{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;
 color:var(--sub);font-size:13px;font-weight:500;background:none;border:0;cursor:pointer;font-family:inherit}
.uw-down span.c{width:46px;height:46px;border-radius:50%;border:1px solid var(--line2);background:rgba(127,127,127,.08);display:grid;place-items:center;
 box-shadow:0 0 0 8px rgba(176,106,217,.08);animation:uwbob 2.4s ease-in-out infinite}
@keyframes uwbob{50%{transform:translateY(4px)}}
.uw-center{min-height:100%;display:grid;place-items:center;padding:60px 16px}
.uw-card{width:100%;max-width:460px;border:1px solid var(--line2);border-radius:22px;background:var(--glass);backdrop-filter:blur(18px);
 padding:32px 34px;box-shadow:0 40px 80px -24px rgba(0,0,0,.45)}
.uw-card h2{font-size:26px;letter-spacing:-.02em;font-weight:800;margin:0}
.uw-s{color:var(--sub);font-size:14px;margin:6px 0 20px;line-height:1.55}
.uw-seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line2);border-radius:12px;padding:4px;margin-bottom:18px}
.uw-seg button{all:unset;text-align:center;font-size:13.5px;font-weight:600;padding:8px;border-radius:9px;color:var(--faint);cursor:pointer}
.uw-seg button.on{background:linear-gradient(135deg,#7A4793,#9A3367);color:#fff}
.uw label{display:block;font-size:12.5px;font-weight:600;color:var(--sub);margin-bottom:7px}
.uw-f{width:100%;height:48px;border:1px solid var(--line2);background:var(--field);border-radius:12px;padding:0 14px;font-size:15px;color:var(--text);
 outline:none;font-family:inherit}
.uw-f:focus{border-color:#b06ad9;box-shadow:0 0 0 4px rgba(176,106,217,.15)}
.uw-full{width:100%;margin-top:16px;height:48px}
.uw-hint{font-size:12.5px;color:var(--faint);margin-top:12px;line-height:1.55}
.uw-err{font-size:13px;color:#f08cc0;margin-top:12px}
.uw-ft{margin-top:22px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--faint);display:flex;justify-content:space-between;gap:8px}
.uw-a{all:unset;color:var(--link);font-weight:600;cursor:pointer}
.uw-code{display:flex;gap:9px;position:relative}
.uw-code div{flex:1;height:60px;border:1px solid var(--line2);background:var(--field);border-radius:12px;display:grid;place-items:center;font-size:24px;font-weight:700}
.uw-code div.on{border-color:#b06ad9;box-shadow:0 0 0 4px rgba(176,106,217,.15)}
.uw-code input{position:absolute;inset:0;opacity:0;font-size:24px}
.uw-inv{display:flex;gap:14px;align-items:center;border:1px solid var(--line2);border-radius:16px;padding:16px;margin-bottom:16px}
.uw-inv .lg{width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,#7A4793,#9A3367);display:grid;place-items:center;flex:none}
.uw-ch{display:inline-block;font-size:11.5px;font-weight:600;border-radius:99px;padding:2px 9px;margin-right:5px;background:rgba(176,106,217,.16);color:#b06ad9}
.uw-back{position:absolute;left:50%;top:18px;transform:translateX(-50%);background:none;border:0;color:var(--faint);font-size:12.5px;cursor:pointer;font-family:inherit}
.uw-pair{font-size:30px;font-weight:800;letter-spacing:4px;text-align:center;margin:10px 0 4px;color:var(--link)}
@media (prefers-reduced-motion: reduce){.uw *{animation:none!important;transition:none!important}.uw-m{opacity:1;transform:none}}
`;

function Inf({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 50" width={size}>
      <path
        d="M25 8a17 17 0 1 0 0 34c10 0 17-9 25-17s15-17 25-17a17 17 0 1 1 0 34c-10 0-17-9-25-17S35 8 25 8z"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="10"
      />
    </svg>
  );
}

function Chat() {
  const av = (bg: string) => ({ background: bg });
  return (
    <div aria-hidden="true" className="uw-win">
      <div className="uw-bar">
        <i /> <i /> <i />
        <b># unlimited-solutions-odoo.sh</b>
        <span style={{ marginLeft: "auto" }}>Youssef · Fahd · Mostafa Gabr</span>
      </div>
      <div className="uw-msgs">
        <div className="uw-m" style={{ animationDelay: ".3s" }}>
          <div className="uw-av" style={av("linear-gradient(135deg,#4c5a7a,#2e3850)")}>MG</div>
          <div>
            <div className="uw-mn">Mostafa Gabr<em>now</em></div>
            <div className="uw-mt">Add a dark mode to the POS screen — cashiers asked for it 🌙</div>
          </div>
        </div>
        <div className="uw-m" style={{ animationDelay: "1.1s" }}>
          <div className="uw-av" style={av("linear-gradient(135deg,#7a4793,#421c63)")}>TD</div>
          <div>
            <div className="uw-mn">Task Desk<span className="uw-tag">BOT</span><em>now</em></div>
            <div className="uw-mt">Youssef picked it up and is studying the database and code.</div>
          </div>
        </div>
        <div className="uw-m" style={{ animationDelay: "2s" }}>
          <div className="uw-av" style={av("linear-gradient(135deg,#e2457a,#a3245a)")}>Y</div>
          <div>
            <div className="uw-mn">Youssef<em>1 min</em></div>
            <div className="uw-mt">Plan ready. 3 steps, one module, nothing on production.</div>
            <div className="uw-cin">
              <b>Plan · POS dark mode</b>
              <br />
              1. Theme toggle in POS settings · 2. Dark palette · 3. Test on staging
              <br />
              <span className="uw-chip uw-cg">Staging only</span>
              <span className="uw-chip uw-ca">Waiting for your approval</span>
            </div>
          </div>
        </div>
        <div className="uw-m" style={{ animationDelay: "3s" }}>
          <div className="uw-av" style={av("linear-gradient(135deg,#4f7dff,#2c4fc9)")}>F</div>
          <div>
            <div className="uw-mn">Fahd<em>typing…</em></div>
            <div className="uw-mt" style={{ color: "var(--faint)" }}>● ● ●</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnlimitedWelcome({
  complete,
  onExistingKey,
}: {
  complete: (pubkey?: string, options?: { continueToProfile?: boolean }) => void;
  onExistingKey: (mode: "key" | "phone") => void;
}) {
  const { addCommunity, switchCommunity } = useCommunities();
  const [page, setPage] = React.useState<Page>("hero");
  const [tab, setTab] = React.useState<Tab>("email");
  const [email, setEmail] = React.useState("");
  const [link, setLink] = React.useState("");
  const [digits, setDigits] = React.useState("");
  const [name, setName] = React.useState("");
  const [info, setInfo] = React.useState<JoinInfo | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resendAt, setResendAt] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const enter = React.useCallback(
    async (joined: JoinInfo) => {
      const identity = await getIdentity();
      const id = addCommunity({
        id: crypto.randomUUID(),
        name: joined.workspace,
        relayUrl: joined.relay_url,
        pubkey: identity.pubkey,
        addedAt: new Date().toISOString(),
      });
      switchCommunity(id);
      complete(identity.pubkey, { continueToProfile: false });
    },
    [addCommunity, complete, switchCommunity],
  );

  // While the owner decides, check every few seconds.
  React.useEffect(() => {
    if (page !== "waiting") return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await joinApi.status();
        if (!alive) return;
        if (s.status === "joined") await enter(s);
        else if (s.status === "rejected") {
          setError("Your request was declined. Ask your manager for a new invite.");
          setPage("signin");
        }
      } catch {
        // Keep waiting; the network may come back.
      }
    };
    const t = window.setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [enter, page]);

  const sendCode = () =>
    run(async () => {
      const r = await joinApi.emailStart(email.trim());
      setResendAt(Date.now() + (r.resend_in || 45) * 1000);
      setDigits("");
      setPage("code");
    });

  const verify = (value: string) =>
    run(async () => {
      const r = await joinApi.emailVerify(email.trim(), value);
      setInfo(r);
      setCode(r.code ?? "");
      setName(r.name || "");
      setPage("invited");
    });

  const openLink = () =>
    run(async () => {
      const r = await joinApi.lookup(link.trim());
      setInfo(r);
      setCode(link.trim());
      setName(r.name || "");
      setPage("invited");
    });

  const join = () =>
    run(async () => {
      const r = await joinApi.claim(code, name.trim());
      setInfo(r);
      if (r.status === "joined") await enter(r);
      else setPage("waiting");
    });

  const left = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const toSignIn = () => {
    setError("");
    setPage("signin");
  };

  return (
    <div className="uw" data-testid="unlimited-welcome">
      <style>{CSS}</style>
      <div className="uw-aur" />
      <div className="uw-grid" />
      <StartupWindowDragRegion />
      <div className="uw-pages" style={{ transform: `translateY(${page === "hero" ? "0" : "-100%"})` }}>
        <section aria-hidden={page !== "hero"} className="uw-page" style={{ top: 0 }}>
          <div className="uw-in">
            <div className="uw-brand">
              <span className="uw-logo">
                <Inf />
              </span>
              <span>
                Unlimited Agent<small>BY UNLIMITED SOLUTIONS</small>
              </span>
            </div>
            <div className="uw-hero">
              <div>
                <span className="uw-pill">
                  <span className="uw-dot" />
                  AI employees online now · working on live projects
                </span>
                <h1>
                  Your AI team that ships <span className="uw-grad">Odoo work</span> — around the clock.
                </h1>
                <p className="uw-lead">
                  Ask in plain words. An AI employee studies your database and code, writes a plan, waits for your approval,
                  builds on staging and reports back.
                </p>
                <div className="uw-ctas">
                  <button className="uw-btn uw-p" data-testid="welcome-join" onClick={toSignIn} type="button">
                    Join with your invite →
                  </button>
                  <button className="uw-btn uw-g" onClick={() => onExistingKey("key")} type="button">
                    I already have an account
                  </button>
                </div>
                <div className="uw-trust">
                  <span>Nothing ships without your approval</span>
                  <span>Production is never touched</span>
                  <span>Invite only</span>
                </div>
              </div>
              <Chat />
            </div>
          </div>
          <button className="uw-down" data-testid="welcome-arrow" onClick={toSignIn} type="button">
            <span>Sign in</span>
            <span className="c">↓</span>
          </button>
        </section>

        <section aria-hidden={page === "hero"} className="uw-page" style={{ top: "100%" }}>
          <button
            className="uw-back"
            onClick={() => {
              setError("");
              setPage(page === "signin" ? "hero" : "signin");
            }}
            type="button"
          >
            ↑ Back
          </button>
          <div className="uw-center">
            <div className="uw-card" data-testid="welcome-card">
              {page === "signin" || page === "hero" ? (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
                    <span className="uw-logo">
                      <Inf />
                    </span>
                    <b style={{ fontSize: 14 }}>Unlimited Agent</b>
                  </div>
                  <h2>Join your company</h2>
                  <p className="uw-s">Use the email your invite was sent to, or paste the invite link.</p>
                  <div className="uw-seg" role="tablist">
                    <button
                      aria-selected={tab === "email"}
                      className={tab === "email" ? "on" : ""}
                      onClick={() => {
                        setTab("email");
                        setError("");
                      }}
                      role="tab"
                      type="button"
                    >
                      Email
                    </button>
                    <button
                      aria-selected={tab === "link"}
                      className={tab === "link" ? "on" : ""}
                      onClick={() => {
                        setTab("link");
                        setError("");
                      }}
                      role="tab"
                      type="button"
                    >
                      Invite link
                    </button>
                  </div>
                  {tab === "email" ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (email.trim()) void sendCode();
                      }}
                    >
                      <label htmlFor="uw-email">Work email</label>
                      <input
                        autoComplete="email"
                        className="uw-f"
                        id="uw-email"
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        type="email"
                        value={email}
                      />
                      <button className="uw-btn uw-p uw-full" disabled={busy || !email.trim()} type="submit">
                        {busy ? "Sending…" : "Send me a code"}
                      </button>
                      <p className="uw-hint">We send a 6-digit code to that email. No password.</p>
                    </form>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (link.trim()) void openLink();
                      }}
                    >
                      <label htmlFor="uw-link">Invite link</label>
                      <input
                        className="uw-f"
                        id="uw-link"
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Paste the link you received"
                        style={{ fontSize: 13 }}
                        value={link}
                      />
                      <button className="uw-btn uw-p uw-full" disabled={busy || !link.trim()} type="submit">
                        {busy ? "Checking…" : "Continue"}
                      </button>
                      <p className="uw-hint">The link came from your manager by WhatsApp or email.</p>
                    </form>
                  )}
                  {error ? <p className="uw-err">{error}</p> : null}
                </>
              ) : page === "code" ? (
                <>
                  <h2>Check your email</h2>
                  <p className="uw-s">
                    We sent a code to <b style={{ color: "var(--text)" }}>{email.trim()}</b>. It works for 10 minutes.
                  </p>
                  <label htmlFor="uw-code">6-digit code</label>
                  <div className="uw-code">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div className={i === Math.min(digits.length, 5) ? "on" : ""} key={i}>
                        {digits[i] ?? ""}
                      </div>
                    ))}
                    <input
                      autoComplete="one-time-code"
                      autoFocus
                      id="uw-code"
                      inputMode="numeric"
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setDigits(v);
                        if (v.length === 6) void verify(v);
                      }}
                      value={digits}
                    />
                  </div>
                  <button className="uw-btn uw-p uw-full" disabled={busy || digits.length < 6} onClick={() => void verify(digits)} type="button">
                    {busy ? "Checking…" : "Continue"}
                  </button>
                  {error ? <p className="uw-err">{error}</p> : null}
                  <p className="uw-hint">
                    Didn't get it?{" "}
                    {left > 0 ? (
                      <span>Send again in 0:{String(left).padStart(2, "0")}</span>
                    ) : (
                      <button className="uw-a" onClick={() => void sendCode()} type="button">
                        Send again
                      </button>
                    )}
                    {" · "}
                    <button className="uw-a" onClick={toSignIn} type="button">
                      Use a different email
                    </button>
                  </p>
                </>
              ) : page === "invited" && info ? (
                <>
                  <h2>You're invited</h2>
                  <p className="uw-s">Check it's right, then join. This device keeps your sign-in — no key to copy.</p>
                  <div className="uw-inv">
                    <span className="lg">
                      <Inf size={30} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{info.workspace}</div>
                      <div style={{ fontSize: 13, color: "var(--faint)", margin: "2px 0 6px" }}>Invited by {info.invited_by}</div>
                      <span className="uw-ch">{info.role.charAt(0).toUpperCase() + info.role.slice(1)}</span>
                      {info.department ? <span className="uw-ch">{info.department}</span> : null}
                    </div>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void join();
                    }}
                  >
                    <label htmlFor="uw-name">Your name</label>
                    <input
                      className="uw-f"
                      id="uw-name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="First and last name"
                      value={name}
                    />
                    <button className="uw-btn uw-p uw-full" disabled={busy || !name.trim()} type="submit">
                      {busy ? "Joining…" : `Join ${info.workspace}`}
                    </button>
                  </form>
                  {error ? <p className="uw-err">{error}</p> : null}
                  {info.confirm ? (
                    <p className="uw-hint" style={{ color: "#3ddc97" }}>
                      ● {info.invited_by} confirms new people first. You get in as soon as they do.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <h2>Waiting for {info?.invited_by ?? "your manager"}</h2>
                  <p className="uw-s">They confirm new people before they get in. This screen moves on by itself.</p>
                  <div className="uw-pair">{info?.pair ?? "··"}</div>
                  <p className="uw-hint" style={{ textAlign: "center" }}>
                    {info?.invited_by ?? "They"} sees the same numbers next to your request.
                  </p>
                  {error ? <p className="uw-err">{error}</p> : null}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
