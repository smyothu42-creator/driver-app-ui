import { useEffect } from "react";
import { BellRing, CloudOff, Download, X } from "lucide-react";
import { useApp, useT } from "../store";
import { SETTINGS } from "../data/route";
import { Button, cn } from "./ui";

/* ------------------------------------------------------------------
 * Things that sit above every screen:
 *   #15 push banner (time change, cancel, new request). Tap opens the stop or request.
 *   #23 offline bar: actions keep working and sync when signal is back.
 *   #24 required update blocks the app until updated; optional shows a sheet (see Sheets).
 * ------------------------------------------------------------------ */

export function PushBanner() {
  const { s, a } = useApp();
  const push = s.push;
  useEffect(() => {
    if (!push) return;
    const t = window.setTimeout(a.dismissPush, 6000);
    return () => window.clearTimeout(t);
  }, [push, a.dismissPush]);
  if (!push) return null;
  return (
    <div className="anim-fade absolute inset-x-2 top-1 z-[75]">
      <div className={cn("flex items-start gap-3 rounded-2xl bg-card/95 p-3 shadow-raised backdrop-blur", push.tone === "high" && "ring-2 ring-coral")}>
        <button onClick={a.openPush} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", push.tone === "high" ? "bg-coral text-white" : "bg-teal-wash text-teal")}>
            <BellRing className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-2xs font-semibold text-muted-foreground">SFK Driver · now</span>
            <span className="block text-[15px] font-bold leading-snug">{push.title}</span>
            <span className="block text-[13px] leading-snug text-muted-foreground">{push.body}</span>
          </span>
        </button>
        <button onClick={a.dismissPush} aria-label="Dismiss" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function OfflineBar() {
  const { s } = useApp();
  const t = useT();
  if (s.online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-foreground px-4 py-2 text-[13px] font-semibold text-white" data-dark-surface>
      <CloudOff className="size-4 shrink-0 text-yellow" />
      <span className="min-w-0 flex-1 truncate">{t("Offline · saved on your phone")}</span>
      {s.pendingSync > 0 && (
        <span className="nums shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-2xs">
          {s.pendingSync} {t("will sync when signal is back")}
        </span>
      )}
    </div>
  );
}

export function UpdateGate() {
  const { s, a } = useApp();
  const t = useT();
  if (s.update !== "required") return null;
  return (
    <div className="anim-fade absolute inset-0 z-[72] flex flex-col items-center justify-center bg-background px-8 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-teal-wash text-teal">
        <Download className="size-8" />
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Update to keep driving</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">You're on {SETTINGS.appVersion}. Every driver needs the current version so routes and stops match dispatch.</p>
      <p className="mt-1 text-2xs text-muted-foreground">Your stops and photos are saved.</p>
      <Button size="lg" className="mt-6 w-full" onClick={a.installUpdate}>
        {t("Update now")}
      </Button>
    </div>
  );
}
