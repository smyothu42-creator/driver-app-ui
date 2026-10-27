import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { BellRing, CloudOff, Download, X } from "lucide-react";
import { useApp, useT } from "../store";
import { SETTINGS } from "../data/route";
import { isOn } from "../data/sprints";
import { Button, cn } from "./ui";

/* ------------------------------------------------------------------
 * Things that sit above every screen:
 *   #15 push banner (time change, cancel, new request). Tap opens the stop or request.
 *   #23 offline bar: actions keep working and sync when signal is back.
 *   #24 required update blocks the app until updated; optional shows a sheet (see Sheets).
 * ------------------------------------------------------------------ */

/**
 * iPhone-style banner: drag it up or to the right to put it away. Down and left only give a little.
 * A short tap still reaches the buttons inside; a drag never counts as a tap.
 * The drag writes the transform straight to the element once per frame (no React render per move), so it
 * stays smooth on a phone; on release it carries on at the finger's speed.
 */
const EASE = "cubic-bezier(.2,.8,.2,1)";

export function SwipeAway({ onDismiss, children }: { onDismiss: () => void; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const gone = useRef(false);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  const paint = (x: number, y: number, ms = 0) => {
    const node = el.current;
    if (!node) return;
    node.style.transition = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : "none";
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    node.style.opacity = String(1 - Math.min(0.6, Math.max(x, -y, 0) / 250));
  };

  // The finger is followed on the window, so a fast flick that leaves the banner on its first move still counts.
  const down = (e: PointerEvent) => {
    if (gone.current) return;
    stop.current();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let last = { x: 0, y: 0 };
    let frame = 0;
    // The last few positions, for the speed at release.
    const trail: { x: number; y: number; t: number }[] = [];
    dragged.current = false;
    const move = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!dragged.current && Math.hypot(dx, dy) < 6) return;
      dragged.current = true;
      // One direction at a time, like iOS: whichever way the finger moved most.
      last = Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? dx : dx * 0.2, y: 0 } : { x: 0, y: dy < 0 ? dy : dy * 0.2 };
      trail.push({ ...last, t: ev.timeStamp });
      if (trail.length > 5) trail.shift();
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        paint(last.x, last.y);
      });
    };
    const up = () => {
      stop.current();
      cancelAnimationFrame(frame);
      if (!dragged.current) return;
      // Speed over the last few moves (px per ms); a quick flick puts it away even when it's moved only a little.
      const a = trail[0];
      const b = trail[trail.length - 1];
      const dt = a && b && b.t > a.t ? b.t - a.t : 1;
      const vx = a && b ? (b.x - a.x) / dt : 0;
      const vy = a && b ? (b.y - a.y) / dt : 0;
      const { x, y } = last;
      const dir = x > 80 || (x > 20 && vx > 0.4) ? "right" : y < -32 || (y < -10 && vy < -0.3) ? "up" : null;
      if (!dir) return paint(0, 0, 260);
      gone.current = true;
      // Finish at roughly the finger's speed: faster flick, shorter exit.
      const v = Math.abs(dir === "right" ? vx : vy);
      const ms = Math.round(Math.min(260, Math.max(140, 180 / Math.max(v, 0.5))));
      const node = el.current!;
      paint(dir === "right" ? node.offsetWidth * 1.2 : 0, dir === "up" ? -node.offsetHeight * 1.8 : 0, ms);
      if (el.current) el.current.style.opacity = "0";
      window.setTimeout(onDismiss, ms);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  };

  return (
    <div
      ref={el}
      onPointerDown={down}
      onClickCapture={(e) => dragged.current && (e.stopPropagation(), e.preventDefault())}
      className="touch-none select-none will-change-transform"
    >
      {children}
    </div>
  );
}

export function PushBanner() {
  const { s, a } = useApp();
  const push = s.push;
  useEffect(() => {
    if (!push) return;
    const t = window.setTimeout(a.dismissPush, 6000);
    return () => window.clearTimeout(t);
  }, [push, a.dismissPush]);
  // Notifications (inbox) is hidden for now, but request and reminder pushes still show with Schedule.
  if (!push || !(isOn("notifications") || (push.schedule && isOn("schedule")))) return null;
  // Oct 27 2026: Me → Notifications can turn off request and message banners (they still land in the inbox).
  if ((push.cat === "request" && !s.notifPrefs.requests) || (push.cat === "message" && !s.notifPrefs.messages)) return null;
  // Oct 27 2026: a request still waiting for an answer can be accepted from the banner, without opening it.
  const req = push.open?.name === "request" ? s.requests.find((r) => r.id === (push.open as { id: string }).id && r.status === "pending" && !r.days) : undefined;
  // Same dark-green drop-in banner as the confirmations ("Time off requested"), plus a close button.
  return (
    <div key={push.id} className="anim-drop absolute inset-x-2 top-1 z-[75] max-[500px]:top-[calc(env(safe-area-inset-top)+4px)]">
      <SwipeAway onDismiss={a.dismissPush}>
        <div data-dark-surface className="flex items-center gap-3 rounded-[18px] bg-teal-deep py-2 pl-3.5 pr-1.5 text-white shadow-[0_10px_30px_rgba(0,64,69,0.28)]">
          <button onClick={a.openPush} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", push.tone === "high" ? "bg-coral" : "bg-white/15")}>
              <BellRing className="size-4" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[15px] font-semibold">{push.title}</span>
              {push.body && <span className="mt-0.5 block truncate text-[13px] text-white/70">{push.body}</span>}
            </span>
          </button>
          {req && (
            <button
              onClick={() => {
                a.dismissPush();
                a.answerRequest(req.id, "accepted");
              }}
              className="h-10 shrink-0 rounded-full bg-white px-4 text-[15px] font-semibold text-teal-deep active:scale-[0.97]"
            >
              Accept
            </button>
          )}
          <button onClick={a.dismissPush} aria-label="Dismiss" className="grid size-10 shrink-0 place-items-center rounded-full text-white/70 active:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
      </SwipeAway>
    </div>
  );
}

/**
 * Undo after accepting a request (Oct 22 2026): a dark snackbar at the bottom, above the tab bar, for 8 seconds.
 * Accept is one tap, so a mistap is one tap to take back. Swipe it away like the banners.
 */
export function UndoSnackbar() {
  const { s, a } = useApp();
  const t = useT();
  const undo = s.undo;
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(a.dismissUndo, 8000);
    return () => window.clearTimeout(id);
  }, [undo, a.dismissUndo]);
  if (!undo) return null;
  const aboveTabs = s.stack.at(-1)?.name === "tabs";
  return (
    <div key={undo.seq} role="status" className={cn("anim-rise absolute inset-x-3 z-[74]", aboveTabs ? "bottom-[92px]" : "bottom-8")}>
      <SwipeAway onDismiss={a.dismissUndo}>
        <div data-dark-surface className="flex items-center gap-3 rounded-2xl bg-foreground py-1.5 pl-4 pr-1.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {t("Accepted")} · <span className="font-medium text-white/75">{undo.name}</span>
          </span>
          <button onClick={a.undoAccept} className="h-10 shrink-0 rounded-xl px-3 text-[15px] font-bold text-yellow active:bg-white/10">
            {t("Undo")}
          </button>
        </div>
      </SwipeAway>
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
      <h2 className="mt-4 text-2xl font-bold tracking-tight">{t("Update to keep driving")}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {t("You're on")} {SETTINGS.appVersion}. {t("Every driver needs the current version so routes and stops match dispatch.")}
      </p>
      <p className="mt-1 text-2xs text-muted-foreground">{t("Your stops and photos are saved.")}</p>
      <Button size="lg" className="mt-6 w-full" onClick={a.installUpdate}>
        {t("Update now")}
      </Button>
    </div>
  );
}
