import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Minimize2, Route as RouteIcon, Smartphone, UserRound } from "lucide-react";
import { AppProvider, runStops, useApp, useT, type Tab } from "./store";
import { PhoneFrame } from "./components/PhoneFrame";
import { cn, SfkMark } from "./components/ui";
import { SignIn, Permissions } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { PackageScreen, Pickup } from "./screens/Pickup";
import { StopDetail } from "./screens/StopDetail";
import { Navigate } from "./screens/Navigate";
import { CameraScreen, ProofScreen } from "./screens/Proof";
import { History, MapTab, Me, Tracking } from "./screens/Tabs";
import { RequestDetail, ScheduleTab } from "./screens/Schedule";
import { Inbox } from "./screens/Inbox";
import { ProblemFlow } from "./screens/Problem";
import { PublicPage, ScanScreen } from "./screens/Scan";
import { VehicleScreen } from "./screens/Vehicle";
import { OfflineBar, PushBanner, UpdateGate } from "./components/SystemLayer";
import { Sheets } from "./screens/Sheets";
import { AvailabilityScreen } from "./screens/Availability";
import { CollectScreen } from "./screens/Collect";
import { ComingSoon } from "./screens/ComingSoon";
import { AREAS, hiddenArea, laterFor } from "./data/sprints";

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
                <span className="nums absolute -top-0.5 right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white" aria-label={`${pending} pending`}>
                  {pending}
                </span>
              )}
            </span>
            <span className={cn("text-[11px] font-semibold", on ? "text-teal-deep" : "text-muted-foreground")}>{t(label)}</span>
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
      body = <ScanScreen />;
      break;
    case "problem":
      body = <ProblemFlow id={top.id} />;
      break;
    case "request":
      body = <RequestDetail id={top.id} />;
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
      body = { today: <Today />, map: <MapTab />, schedule: <ScheduleTab />, history: <History />, me: <Me /> }[s.tab];
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
    top.name === "camera" || top.name === "scan" ? "black" : isTabs && s.tab === "today" ? "tealSoft" : top.name === "stop" ? "mint" : (isTabs && s.tab === "history") || top.name === "navigate" ? "teal" : "light";

  return (
    <PhoneFrame top={statusTop} full={full}>
      <div className="flex h-full flex-col">
        <OfflineBar />
        <div key={key} className={cn("anim-screen relative flex-1", top.name === "navigate" || (isTabs && s.tab === "map") ? "overflow-hidden" : "overflow-y-auto")}>
          {body}
        </div>
        {isTabs && <TabBar />}
      </div>
      <Sheets />
      <PushBanner />
      <UpdateGate />
      {/* Success pop-up (e.g. "Slip scanned"): white card with a green tick, near the top. */}
      {s.notice && (
        <div role="status" className="anim-rise absolute inset-x-0 top-14 z-[70] flex justify-center px-4">
          <div className="nums flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-2 pr-4 text-foreground shadow-raised">
            <span className="grid size-8 place-items-center rounded-full bg-success-bg text-success">
              <CheckCircle2 className="size-5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-bold text-success">{s.notice.title}</span>
              {s.notice.body && <span className="block text-[13px] text-muted-foreground">{s.notice.body}</span>}
            </span>
          </div>
        </div>
      )}
      {s.toast && (
        <div role="status" className="anim-fade absolute inset-x-4 bottom-28 z-[70] rounded-2xl bg-teal-deep px-4 py-3 text-center text-sm font-semibold text-white shadow-raised">
          {s.toast}
        </div>
      )}
    </PhoneFrame>
  );
}

export default function App() {
  // Phone view: the app fills the browser window with its mobile layout, as on a real phone. Esc goes back to the frame.
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <AppProvider>
      <div className={cn("flex h-full overflow-y-auto", full && "block")}>
        <div className={cn("m-auto flex justify-center p-6 max-[500px]:w-full max-[500px]:p-0", full && "w-full p-0")}>
          <Screens full={full} />
        </div>
      </div>
      {full ? (
        <button
          onClick={() => setFull(false)}
          aria-label="Exit phone view"
          title="Exit phone view (Esc)"
          className="anim-fade fixed left-1/2 top-2 z-[90] flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold text-white backdrop-blur-md max-[500px]:hidden"
        >
          <Minimize2 className="size-3.5" /> Exit phone view
        </button>
      ) : (
        <button
          onClick={() => setFull(true)}
          className="anim-fade fixed bottom-6 right-6 z-[80] flex h-12 items-center gap-2 rounded-full bg-teal-deep pl-1.5 pr-5 text-sm font-semibold text-white shadow-raised transition hover:bg-sidebar-active max-[500px]:hidden"
        >
          <span className="grid size-9 place-items-center rounded-full bg-yellow text-teal-deep">
            <Smartphone className="size-[18px]" />
          </span>
          Phone view
        </button>
      )}
    </AppProvider>
  );
}
