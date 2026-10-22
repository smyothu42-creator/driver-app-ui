import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Headphones, Minimize2, Route as RouteIcon, Smartphone, UserRound } from "lucide-react";
import { AppProvider, runStops, useApp, useT, type Tab } from "./store";
import { PhoneFrame } from "./components/PhoneFrame";
import { cn, SfkMark } from "./components/ui";
import { SignIn, Permissions } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { PackageScreen, Pickup } from "./screens/Pickup";
import { StopDetail } from "./screens/StopDetail";
import { Navigate } from "./screens/Navigate";
import { CameraScreen, ProofScreen } from "./screens/Proof";
import { History, Me, RouteTab, Tracking } from "./screens/Tabs";
import { RequestDetail, RequestsScreen, ScheduleTab } from "./screens/Schedule";
import { Inbox } from "./screens/Inbox";
import { ProblemFlow } from "./screens/Problem";
import { PublicPage, ScanScreen } from "./screens/Scan";
import { VehicleScreen } from "./screens/Vehicle";
import { OfflineBar, PushBanner, SwipeAway, UndoSnackbar, UpdateGate } from "./components/SystemLayer";
import { Sheets } from "./screens/Sheets";
import { AvailabilityScreen } from "./screens/Availability";
import { CollectScreen } from "./screens/Collect";
import { ComingSoon } from "./screens/ComingSoon";
import { AREAS, hiddenArea, isOn, laterFor } from "./data/sprints";
import { DispatchPage } from "./components/DispatchPage";

const TABS: { id: Tab; label: string; icon: typeof RouteIcon | typeof SfkMark }[] = [
  { id: "today", label: "Home", icon: SfkMark },
  { id: "map", label: "Route", icon: RouteIcon },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  // History moved out of the tab bar (Oct 15 2026). It goes in the Me / profile page when Profile is designed (Sprint 3).
  { id: "me", label: "Me", icon: UserRound },
];

function TabBar() {
  const { s, a } = useApp();
  const t = useT();
  // #18: pending requests show as a count on the Schedule tab.
  const pending = laterFor("schedule") ? 0 : s.requests.filter((r) => r.status === "pending").length;
  return (
    <nav aria-label="Main" className="grid grid-cols-4 border-t border-border bg-card px-1 pb-7 pt-1.5">
      {TABS.map(({ id, label, icon: I }) => {
        const on = s.tab === id;
        return (
          <button key={id} onClick={() => a.setTab(id)} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-0.5 py-1">
            <span className={cn("relative grid h-8 w-14 place-items-center rounded-full transition-colors", on ? "bg-teal-wash text-teal-deep" : "text-muted-foreground")}>
              <I className="size-[22px]" strokeWidth={on ? 2.4 : 2} />
              {id === "schedule" && pending > 0 && (
                <span className="nums absolute -top-0.5 right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-2xs font-bold text-white" aria-label={`${pending} pending`}>
                  {pending}
                </span>
              )}
            </span>
            <span className={cn("text-2xs font-semibold", on ? "text-teal-deep" : "text-muted-foreground")}>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Screens({ full }: { full: boolean }) {
  const { s, a } = useApp();
  const top = s.stack[s.stack.length - 1];
  const key = s.stack.map((x) => x.name + ("id" in x ? x.id : "")).join("/") + s.tab;
  // Tab bar hides while scrolling down and comes back on any scroll up (LinkedIn-style). Always shown on a new screen.
  const [barHidden, setBarHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    setBarHidden(false);
    lastY.current = 0;
  }, [key]);
  const lockUntil = useRef(0); // the bar's own resize moves scrollTop; ignore that so it can't bounce at the bottom
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    const dy = y - lastY.current;
    if (performance.now() < lockUntil.current) {
      lastY.current = y;
      return;
    }
    if (Math.abs(dy) < 6) return; // ignore jitter
    const hide = dy > 0 && y > 40;
    lastY.current = y;
    if (hide !== barHidden) {
      setBarHidden(hide);
      lockUntil.current = performance.now() + 350;
    }
  };

  let body: React.ReactNode;
  switch (top.name) {
    case "signin":
      body = <SignIn />;
      break;
    case "permissions":
      body = <Permissions />;
      break;
    case "pickup":
      body = <Pickup id={top.id} />;
      break;
    case "package":
      body = <PackageScreen id={top.id} />;
      break;
    case "collect":
      body = <CollectScreen id={top.id} />;
      break;
    case "stop":
      body = <StopDetail id={top.id} />;
      break;
    case "navigate":
      body = <Navigate id={top.id} />;
      break;
    case "camera":
      body = <CameraScreen id={top.id} />;
      break;
    case "proof":
      body = <ProofScreen id={top.id} />;
      break;
    case "tracking":
      body = <Tracking />;
      break;
    case "scan":
      body = <ScanScreen key={top.id ?? "any"} id={top.id} />;
      break;
    case "problem":
      body = <ProblemFlow id={top.id} reusables={top.reusables} />;
      break;
    case "request":
      body = <RequestDetail id={top.id} />;
      break;
    case "requests":
      body = <RequestsScreen />;
      break;
    case "inbox":
      body = <Inbox />;
      break;
    case "vehicle":
      body = <VehicleScreen />;
      break;
    case "publicPage":
      body = <PublicPage id={top.id} />;
      break;
    case "availability":
      body = <AvailabilityScreen />;
      break;
    case "tabs":
      body = { today: <Today />, map: <RouteTab />, schedule: <ScheduleTab />, history: <History />, me: <Me /> }[s.tab];
      break;
  }

  // Later-sprint screens and tabs stay in the code but show "Coming soon" for now.
  const hidden = hiddenArea(top.name === "tabs" ? s.tab : top.name);
  if (hidden) {
    const stopId = "id" in top ? top.id : undefined;
    // Prototype only: skip a hidden step so the route can still be walked end to end.
    const skip =
      hidden === "kitchen" && (top.name === "scan" || top.name === "pickup" || top.name === "package")
        ? {
            label: "Skip for now · mark route loaded",
            run: () => a.jump((p) => ({ pickupDone: true, pickupAt: p.pickupAt ?? p.clock, runLoadedAt: { ...p.runLoadedAt, [p.run]: p.pickupAt ?? p.clock }, bagChecks: { ...p.bagChecks, ...Object.fromEntries(runStops(p).flatMap((x) => x.bags.map((b) => [b.id, true]))) }, stack: [{ name: "tabs" }], tab: "today" })),
          }
        : stopId && (top.name === "camera" || top.name === "proof" || top.name === "collect")
          ? {
              label: top.name === "collect" ? "Skip for now · mark collected" : "Skip for now · mark delivered",
              run: () => a.jump((p) => ({ stops: { ...p.stops, [stopId]: { ...p.stops[stopId], status: "delivered", deliveredAt: p.clock } }, stack: [{ name: "tabs" }, { name: "stop", id: stopId }] })),
            }
          : undefined;
    body = <ComingSoon f={AREAS[hidden]} back={top.name !== "tabs"} skip={skip} />;
  }

  const isTabs = top.name === "tabs";
  const statusTop =
    top.name === "camera" || top.name === "scan" ? "black" : isTabs && (s.tab === "today" || ((s.tab === "schedule" || s.tab === "map") && !hidden)) ? "tealSoft" : top.name === "stop" || top.name === "availability" || top.name === "requests" ? "tealSoft" : top.name === "request" || top.name === "inbox" || top.name === "package" ? "mint" : top.name === "navigate" ? "mint" : isTabs && s.tab === "history" ? "teal" : "light";

  return (
    <PhoneFrame
      top={statusTop}
      full={full}
      // Navigation is Google Maps: iOS shows "◀ SFK Driver" to switch back to the app (lands on Home).
      backLink={top.name === "navigate" ? { label: "SFK Driver", onClick: () => a.jump(() => ({ stack: [{ name: "tabs" }], tab: "today", sheet: null })) } : undefined}
    >
      <div className="flex h-full flex-col">
        <OfflineBar />
        <div key={key} onScroll={isTabs ? onScroll : undefined} className={cn("anim-screen relative flex-1", top.name === "navigate" ? "overflow-hidden" : "overflow-y-auto")}>
          {body}
        </div>
        {isTabs && (
          // Collapses its height (not just slides) so pinned buttons at the bottom of the screen follow it down.
          <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", barHidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
            <div className="min-h-0 overflow-hidden">
              <TabBar />
            </div>
          </div>
        )}
      </div>
      <Sheets />
      <PushBanner />
      <UndoSnackbar />
      <UpdateGate />
      {/* Confirmations ("Accepted", "Slip scanned", "Sent to dispatch"): one dark-green banner that drops in under the
          status bar, like a system banner. Kept off the bottom so it never covers the action buttons. Swipe up or right to put it away. */}
      {(s.notice || s.toast) && (
        <div role="status" key={s.notice?.title ?? s.toast} className="anim-drop absolute inset-x-2 top-1 z-[75] max-[500px]:top-[calc(env(safe-area-inset-top)+4px)]">
          <SwipeAway onDismiss={a.dismissToast}>
            <div data-dark-surface className="flex items-center gap-3 rounded-[18px] bg-teal-deep px-3.5 py-3 text-white shadow-[0_10px_30px_rgba(0,64,69,0.28)]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[15px] font-semibold">{s.notice?.title ?? s.toast}</span>
                {s.notice?.body && <span className="mt-0.5 block truncate text-[13px] text-white/70">{s.notice.body}</span>}
              </span>
            </div>
          </SwipeAway>
        </div>
      )}
    </PhoneFrame>
  );
}

export default function App() {
  // Phone view: the app fills the browser window with its mobile layout, as on a real phone. Esc goes back to the frame.
  const [full, setFull] = useState(false);
  // Dispatch page beside the phone (desktop only). Shown once the Schedule sprint is live.
  const [dispatch, setDispatch] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <AppProvider>
      <div className={cn("flex h-full overflow-y-auto", full && "block")}>
        <div className={cn("m-auto flex items-start justify-center gap-6 p-6 max-[500px]:w-full max-[500px]:p-0", full && "w-full p-0")}>
          <Screens full={full} />
          {dispatch && !full && (
            <div className="max-[960px]:hidden">
              <DispatchPage onClose={() => setDispatch(false)} />
            </div>
          )}
        </div>
      </div>
      {full ? (
        <button
          onClick={() => setFull(false)}
          aria-label="Exit phone view"
          title="Exit phone view (Esc)"
          className="anim-fade fixed left-1/2 top-2 z-[90] flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 text-[13px] font-semibold text-white backdrop-blur-md max-[500px]:hidden"
        >
          <Minimize2 className="size-3.5" /> Exit phone view
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 z-[80] flex gap-2 max-[500px]:hidden">
          {isOn("schedule") && (
            <button
              onClick={() => setDispatch((d) => !d)}
              aria-pressed={dispatch}
              className="anim-fade flex h-12 items-center gap-2 rounded-full border border-border-strong bg-card pl-1.5 pr-5 text-[15px] font-semibold text-teal-deep shadow-raised transition hover:bg-teal-wash max-[960px]:hidden"
            >
              <span className="grid size-9 place-items-center rounded-full bg-teal-wash text-teal-deep">
                <Headphones className="size-[18px]" />
              </span>
              {dispatch ? "Hide dispatch" : "Dispatch view"}
            </button>
          )}
          <button
            onClick={() => setFull(true)}
            className="anim-fade flex h-12 items-center gap-2 rounded-full bg-teal-deep pl-1.5 pr-5 text-[15px] font-semibold text-white shadow-raised transition hover:bg-sidebar-active"
          >
            <span className="grid size-9 place-items-center rounded-full bg-yellow text-teal-deep">
              <Smartphone className="size-[18px]" />
            </span>
            Phone view
          </button>
        </div>
      )}
    </AppProvider>
  );
}
