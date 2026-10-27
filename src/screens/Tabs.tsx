import { Bell, BellRing, CalendarOff, Camera, Car, CheckCircle2, ChevronLeft, ChevronRight, ChevronUp, Clock, CircleHelp, Download, Eye, EyeOff, Headphones, Languages, LogOut, Navigation, RadioTower, RotateCcw, ShieldAlert, Smartphone, History as HistoryIcon } from "lucide-react";
import { liveRoute, needsKitchenRun, useApp, nextStop, useRoute, useT, type LocationPerm, type NotifPrefs } from "../store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DISPATCH, DRIVER, KITCHEN, PAST, ROUTE_DATE, ROUTE_ISO, SETTINGS, KITCHEN_READY, driveBetween, fmtTime, fmtWindow, legBetween, runOf, type Stop } from "../data/route";
import type { Availability } from "../data/availability";
import { DutyCard, HeaderActions } from "./Today";
import { Badge, Button, Card, cn, IconChip, SectionLabel, SfkMark, StatusText, StopAvatar, Toggle, TopBar, WorkTags } from "../components/ui";
import { MapView, type Pin } from "../components/MapView";
import driverPhoto from "../assets/driver-photo.jpg";
import { DeliveryScene } from "../components/Illustrations";
import { RouteTimeline } from "./Today";

/* ---------------- Route tab ----------------
 * The whole day on a map, with a swipeable row of stop cards at the bottom (back to this style Oct 15 2026).
 * Swipe the cards → the matching pin is selected; tap a pin → its card scrolls into the middle; tap a card → stop.
 * ------------------------------------------------------------------ */
const CARD_W = 304; // w-[304px]
const CARD_GAP = 12; // gap-3

/**
 * Mouse drag-to-swipe for a snapping card rail. Touch already scrolls natively; a mouse
 * doesn't, so on desktop we move scrollLeft by hand, then snap to a card on release.
 * A flick (fast or > 40px) moves at least one card. A real drag never counts as a tap.
 */
function useDragRail(rail: React.RefObject<HTMLDivElement | null>, step: number, count: number, onSettle: (index: number) => void) {
  const drag = useRef<{ x: number; left: number; t: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !rail.current) return;
    drag.current = { x: e.clientX, left: rail.current.scrollLeft, t: performance.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = rail.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      // Snap fights manual scrolling, so switch it off for the drag and back on at release.
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
    }
    el.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = rail.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    justDragged.current = true;
    const dx = e.clientX - d.x;
    const fast = Math.abs(dx) / Math.max(1, performance.now() - d.t) > 0.4; // px per ms
    const from = Math.round(d.left / step);
    let to = Math.round(el.scrollLeft / step);
    if (to === from && (fast || Math.abs(dx) > 40)) to = from + (dx < 0 ? 1 : -1);
    to = Math.max(0, Math.min(count - 1, to));
    el.style.cursor = "";
    onSettle(to); // select now; don't wait for the smooth scroll to finish
    el.scrollTo({ left: to * step, behavior: "smooth" });
    window.setTimeout(() => (el.style.scrollSnapType = ""), 400);
  };
  // Swallow the click that follows a drag so it doesn't open the card underneath.
  const onClickCapture = (e: React.MouseEvent) => {
    if (!justDragged.current) return;
    justDragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture };
}

/**
 * Route tab (Oct 21 2026): no map, just today's route as a timeline (kitchen pickups and stops in order).
 * Same mint header + white panel as Schedule. MapTab below is kept for when the map comes back.
 */
export function RouteTab() {
  const t = useT();
  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-[#CFE8E8]">
      <div className="bg-[#CFE8E8] px-4 pb-8 pt-1 text-teal-deep">
        {/* Title and date on the left; the Requests / Inbox pill centred on both, so it sits a little lower. */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 px-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{t("Route of the day")}</h1>
            <p className="nums mt-0.5 text-[15px] font-semibold text-teal-deep/80">{ROUTE_DATE}</p>
          </div>
          <HeaderActions />
        </div>
        {/* Oct 26 2026: Home is gone; its duty card (status, progress, next-step button) opens the Route tab. */}
        <div className="mt-3">
          <DutyCard />
        </div>
      </div>
      {/* Rows and title bands run edge to edge, so the panel has no side padding; its rounded top clips the first band. */}
      <div className="relative z-[2] -mx-px -mt-4 w-[calc(100%+2px)] flex-1 overflow-hidden rounded-t-[28px] border border-b-0 border-border-strong bg-white pb-8">
        <RouteTimeline />
      </div>
    </div>
  );
}

export function MapTab() {
  const { s, a } = useApp();
  const STOPS = liveRoute(s); // assigned + claimed, numbered in route order; cancelled stops drop off the map
  const next = nextStop(s);
  const lastDone = [...STOPS].reverse().find((x) => s.stops[x.id].status === "delivered");
  // Cards follow the day in order: kitchen pickup, its deliveries, the next kitchen pickup, … then reusables pickups.
  type Item = { key: string; pin: string; kind: "kitchen"; run: number } | { key: string; pin: string; kind: "stop"; stop: (typeof STOPS)[number] };
  const items: Item[] = [];
  STOPS.forEach((x, i) => {
    const startsRun = x.kind !== "pickup" && (i === 0 || runOf(STOPS[i - 1]) !== runOf(x) || STOPS[i - 1].kind === "pickup");
    if (startsRun) items.push({ key: `k${runOf(x)}`, pin: "k", kind: "kitchen", run: runOf(x) });
    items.push({ key: x.id, pin: x.id, kind: "stop", stop: x });
  });
  const startKey = !s.pickupDone ? `k${s.run}` : (next?.id ?? items[0].key);
  const [selected, setSelected] = useState(startKey);
  const rail = useRef<HTMLDivElement>(null);
  const settle = useRef<number>(undefined);
  const dragRail = useDragRail(rail, CARD_W + CARD_GAP, items.length, (i) => setSelected(items[i].key));
  const selectedPin = items.find((x) => x.key === selected)?.pin ?? selected;
  const [hidden, setHidden] = useState(false); // stop cards swiped away
  const vDrag = useRef<{ y: number; x: number } | null>(null);
  const swiped = useRef(false);
  // Open on the current step (kitchen pickup or next stop), not the first card.
  useEffect(() => {
    const i = items.findIndex((x) => x.key === startKey);
    if (i > 0) rail.current?.scrollTo({ left: i * (CARD_W + CARD_GAP) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pins: Pin[] = [
    { id: "k", at: KITCHEN.at, label: "SF", state: "kitchen" },
    ...STOPS.map((x) => ({
      id: x.id,
      at: x.at,
      label: String(x.seq),
      title: x.name,
      state: (s.stops[x.id].status === "delivered" ? "done" : x.id === next?.id ? "active" : "todo") as Pin["state"],
    })),
  ];
  // Whole day in order; a leg turns gray once the stop it leads to is delivered.
  // A claimed order loaded on its own kitchen run starts from the kitchen, not the previous stop.
  const fromOf = (i: number) => (i === 0 || s.loaded[STOPS[i].id] === "kitchen-run" || needsKitchenRun(s, STOPS[i].id) ? "k" : STOPS[i - 1].id);
  const route = STOPS.map((x, i) => ({ coords: legBetween(fromOf(i), x.id), done: s.stops[x.id].status === "delivered" }));
  /** Oct 20 2026: estimated drive into each card, from the kitchen or the stop before it. */
  const driveTo = (it: Item) => {
    if (it.kind === "kitchen") {
      const before = STOPS[STOPS.findIndex((x) => x.kind !== "pickup" && runOf(x) === it.run) - 1];
      return before ? { ...driveBetween(before.id, "k"), from: `back from ${before.name}` } : null;
    }
    const i = STOPS.indexOf(it.stop);
    const from = fromOf(i);
    return { ...driveBetween(from, it.stop.id), from: from === "k" ? "from the kitchen" : `from ${STOPS[i - 1].name}` };
  };
  const DriveLine = ({ it }: { it: Item }) => {
    const d = driveTo(it);
    return d ? (
      <div className="nums mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Car className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          <b className="font-semibold text-foreground">{d.mins} min drive</b> {d.from} · {d.miles} mi
        </span>
      </div>
    ) : null;
  };

  // Pin tap → bring its card into the middle of the carousel (Uber Eats pattern).
  const pickPin = (id: string) => {
    // The kitchen pin maps to the current run's kitchen card.
    const i = id === "k" ? Math.max(0, items.findIndex((x) => x.key === `k${s.run}`)) : items.findIndex((x) => x.key === id);
    if (i < 0) return;
    setSelected(items[i].key);
    rail.current?.scrollTo({ left: i * (CARD_W + CARD_GAP), behavior: "smooth" });
  };
  // Swipe the carousel → the card that settles in the middle becomes the selected pin.
  const onRailScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const i = Math.round((rail.current?.scrollLeft ?? 0) / (CARD_W + CARD_GAP));
      setSelected(items[Math.min(items.length - 1, Math.max(0, i))].key);
    }, 120);
  };

  return (
    <div className="relative h-full">
      <MapView
        pins={pins}
        route={route}
        driverAt={s.pickupDone ? (lastDone?.at ?? KITCHEN.at) : KITCHEN.at}
        showDriver={s.shiftOn}
        selectedId={selectedPin}
        onPinClick={pickPin}
        padding={{ top: 90, bottom: hidden ? 70 : 250, left: 50, right: 50 }}
        recenterClassName={hidden ? "bottom-16 right-3" : "bottom-[250px] right-3"}
      />
      {/* Where the driver is right now, in words. Flat pill with a stroke (no glow). */}
      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3 rounded-full border border-border-strong bg-card px-4 py-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">
          {(() => {
            if (!s.shiftOn) return "Off duty";
            if (!s.pickupDone) return s.run > 1 ? "Back to the kitchen" : "At the kitchen";
            if (!next) return "All stops done";
            const st = s.stops[next.id].status;
            return st === "arrived" ? `At ${next.name}` : st === "en_route" ? `On the way to ${next.name}` : `Next: ${next.name}`;
          })()}
        </span>
        <StatusText tone={s.shiftOn ? "done" : "later"}>{s.shiftOn ? "Live" : "Off duty"}</StatusText>
      </div>
      {/* Swipe the cards down to hide them (more map); swipe the tab up (or tap it) to bring them back. */}
      <div
        className={cn("absolute inset-x-0 bottom-0 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", hidden && "translate-y-[calc(100%-8px)]")}
        onPointerDown={(e) => (vDrag.current = { y: e.clientY, x: e.clientX })}
        onPointerUp={(e) => {
          const d = vDrag.current;
          vDrag.current = null;
          if (!d) return;
          const dy = e.clientY - d.y;
          if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(e.clientX - d.x)) {
            swiped.current = true;
            setHidden(dy > 0);
          }
        }}
        onClickCapture={(e) => {
          // A vertical swipe shouldn't also open the card it ended on.
          if (!swiped.current) return;
          swiped.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {/* grab handle: also a tap target to toggle */}
        <button onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Show stops" : "Hide stops"} className="mx-auto mb-1 flex h-6 w-16 items-center justify-center">
          <span className="h-1.5 w-11 rounded-full bg-teal-deep/40" />
        </button>
      {hidden && (
        <button onClick={() => setHidden(false)} className="absolute -top-12 left-1/2 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-card px-4 text-[15px] font-semibold text-teal-deep">
          <ChevronUp className="size-4" /> Show stops
        </button>
      )}
      <div
        ref={rail}
        onScroll={onRailScroll}
        {...dragRail}
        className="no-scrollbar flex cursor-grab touch-pan-x select-none items-stretch snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-152px)] pb-3 pt-1 [&_*]:[-webkit-user-drag:none]"
      >
        {items.map((it) => {
          const on = it.key === selected;
          if (it.kind === "kitchen") {
            const loadedAt = s.runLoadedAt[it.run];
            const done = it.run < s.run || (it.run === s.run && s.pickupDone);
            return (
              <Card key={it.key} onClick={!done && it.run === s.run ? a.openLoad : undefined} className={cn("flex w-[304px] shrink-0 snap-center flex-col p-4 transition-shadow", on && "ring-2 ring-teal-deep")}>
                <div className="flex items-start gap-2.5">
                  {/* Superfine logo as the kitchen's profile picture */}
                  <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-teal-deep text-yellow">
                    <SfkMark className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-tight">{it.run === 1 ? "Kitchen pickup" : `Kitchen pickup ${it.run}`}</span>
                  <StatusText tone={done ? "done" : it.run === s.run ? "now" : "later"}>{done ? "Loaded" : it.run === s.run ? "Now" : "Later"}</StatusText>
                </div>
                <address className="mt-2 text-[15px] not-italic leading-snug text-muted-foreground">
                  <span className="block font-medium text-foreground">{KITCHEN.name}</span>
                  <span className="block">{KITCHEN.addressLine1}</span>
                </address>
                <div className="nums mt-2 text-[15px] font-semibold text-teal-deep">
                  {done && loadedAt != null ? `Loaded ${fmtTime(loadedAt)}` : `Dispatch ready ${fmtTime(KITCHEN_READY[it.run] ?? KITCHEN.readyAt)}`}
                </div>
                {!done && <DriveLine it={it} />}
              </Card>
            );
          }
          const x = it.stop;
          const st = s.stops[x.id];
          return (
            <Card key={it.key} onClick={() => a.push({ name: "stop", id: x.id })} className={cn("flex w-[304px] shrink-0 snap-center flex-col p-4 transition-shadow", on && "ring-2 ring-teal-deep")}>
              <div className="flex items-start gap-2.5">
                {/* Company logo tile or the person's photo, so a company vs an individual reads at a glance. */}
                <StopAvatar stop={x} className="size-11 text-[15px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold leading-tight">{x.name}</span>
                  <span className="mt-0.5 block text-[13px] font-medium text-muted-foreground">
                    Stop {x.seq} · {x.customerType === "individual" ? "Individual" : x.kind === "pickup" ? "Reusables pickup" : "Company"}
                  </span>
                </span>
                <StatusTag stop={x} next={next?.id === x.id} />
              </div>
              <WorkTags stop={x} variant="plain" className="mt-2.5 [&>span]:text-[15px] [&_svg]:size-4" />
              {/* Full address so the driver can confirm the drop without opening the stop. */}
              <address className="mt-3 border-t border-border pt-3 text-[15px] not-italic leading-snug text-muted-foreground">
                <span className="block font-medium text-foreground">{x.addressLine1}</span>
                {x.addressLine2 && <span className="block">{x.addressLine2}</span>}
                <span className="block">{x.city}</span>
              </address>
              <div className="nums mt-2 text-[15px] font-semibold text-teal-deep">
                {st.status === "delivered" ? `${x.kind === "pickup" ? "Collected" : "Delivered"} ${fmtTime(st.deliveredAt!)}` : fmtWindow(x.windowStart, x.windowEnd)}
              </div>
              {st.status !== "delivered" && st.status !== "arrived" && <DriveLine it={it} />}
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/** Where a stop is in the day, in one word: Delivered / Problem / Here / On the way / Next / Upcoming / Cancelled. */
function StatusTag({ stop, next }: { stop: Stop; next: boolean }) {
  const { s } = useApp();
  const st = s.stops[stop.id].status;
  const pickup = stop.kind === "pickup";
  if (st === "delivered") return <StatusText tone="done">{pickup ? "Collected" : "Delivered"}</StatusText>;
  if (st === "cancelled") return <StatusText tone="off">Cancelled</StatusText>;
  // Reported to dispatch: the route has moved on, so it no longer reads as "Here" / "Next".
  if (s.stops[stop.id].issue && !next) return <StatusText tone="off">Problem</StatusText>;
  if (st === "arrived") return <StatusText tone="now">Here</StatusText>;
  if (st === "en_route") return <StatusText tone="now">On the way</StatusText>;
  if (next) return <StatusText tone="now">Next</StatusText>;
  return <StatusText tone="later">Upcoming</StatusText>;
}

/* ---------------- History tab ----------------
 * Same frame as Home: a dark teal header with the title and the 30-day numbers, then light sections.
 * Rows put the time/result on the right (like the route list) and pair colour with an icon + word.
 */
/** Past deliveries. Opened from Me (with Back) since History left the tab bar (Oct 15 2026). */
export function History({ onBack }: { onBack?: () => void }) {
  const { s, a } = useApp();
  const t = useT();
  const done = useRoute().filter((x) => s.stops[x.id].status === "delivered");
  return (
    <div>
      <div data-dark-surface className="bg-teal-deep px-5 pb-5 pt-4 text-white">
        {onBack && (
          <button onClick={onBack} aria-label={t("Back")} className="-ml-2 mb-2 grid size-11 place-items-center rounded-full active:bg-sidebar-active">
            <ChevronLeft className="size-6" />
          </button>
        )}
        <p className="text-2xs font-semibold text-sidebar-muted">{t("Last 30 days")}</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">{t("History")}</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["98%", "On time"],
            ["212", "Stops"],
            ["4.9", "Rating"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-sidebar-active/60 px-3 py-3 text-center">
              <div className="nums text-2xl font-bold leading-none tracking-tight">{v}</div>
              <div className="mt-1.5 text-2xs font-semibold text-sidebar-muted">{t(l)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-4 pb-6 pt-4">
        <section>
          <SectionLabel>{t("Today")}</SectionLabel>
          {done.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-muted-foreground">{t("Delivered stops and photos show here.")}</Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {done.map((x) => {
                const at = s.stops[x.id].deliveredAt!;
                const onTime = at <= x.windowEnd;
                return (
                  <button key={x.id} onClick={() => a.push({ name: "stop", id: x.id })} className="flex min-h-[72px] w-full items-center gap-3 px-3 py-3 text-left active:bg-teal-wash/60">
                    <span className="size-12 shrink-0 overflow-hidden rounded-xl">
                      <DeliveryScene variant={x.seq} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold leading-tight">{x.name}</span>
                      <span className="nums mt-0.5 block truncate text-[13px] text-muted-foreground">{x.orderNo}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="nums block text-[15px] font-semibold leading-tight">{fmtTime(at)}</span>
                      <ResultTag ok={onTime}>{onTime ? t("On time") : `${at - x.windowEnd} min ${t("late")}`}</ResultTag>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </Card>
          )}
        </section>

        <section>
          <SectionLabel>{t("Earlier")}</SectionLabel>
          <Card className="divide-y divide-border">
            {PAST.map((d) => {
              const ok = d.onTime === d.stops;
              return (
                <div key={d.date} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold leading-tight">{d.date}</div>
                    <div className="nums mt-0.5 text-[13px] text-muted-foreground">
                      {d.stops} {t("stops")}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="nums block text-[15px] font-semibold leading-tight">
                      {d.onTime}/{d.stops}
                    </span>
                    <ResultTag ok={ok}>{ok ? t("All on time") : `${d.stops - d.onTime} ${t("late")}`}</ResultTag>
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}

/** On-time / late result: icon + word + colour, so it never relies on colour alone. */
function ResultTag({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CheckCircle2 : Clock;
  return (
    <span className={cn("nums mt-0.5 inline-flex items-center gap-1 text-2xs font-semibold", ok ? "text-success" : "text-warning")}>
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

/* ---------------- Me tab ---------------- */
export function Me() {
  const { s, a } = useApp();
  const t = useT();
  const unread = s.inbox.filter((m) => m.from === "dispatch" && !m.read).length;
  const changed = Object.keys(s.vehicleFor).length;
  return (
    <div>
      <TopBar title={t("Me")} />
      <div className="space-y-5 px-4 py-4">
        {/* #7: the driver signs in on their own phone and stays signed in there. */}
        <Card className="flex items-center gap-3 p-4">
          {/* Oct 26 2026: the driver's photo; tap it to change (camera or library). The same photo shows on Route. */}
          <label className="relative size-14 shrink-0 cursor-pointer" aria-label={t("Change profile photo")}>
            <img src={s.profilePhoto ?? driverPhoto} alt={DRIVER.name} className="size-14 rounded-full object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-card bg-teal text-white" aria-hidden>
              <Camera className="size-3.5" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  a.setProfilePhoto(URL.createObjectURL(f));
                  a.toast(t("Profile photo updated"));
                }
              }}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold tracking-tight">{DRIVER.name}</div>
            <div className="text-2xs text-muted-foreground">
              {t(`${DRIVER.type} driver`)} · {DRIVER.phone}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-2xs font-semibold text-teal">
              <Smartphone className="size-3.5" /> {t("Signed in on this phone")}
            </div>
          </div>
        </Card>

        <section>
          <SectionLabel>{t("Duty")}</SectionLabel>
          <Card className="divide-y divide-border">
            {/* #8 / #78: one Ready (on duty) toggle. While on, dispatch sees the driver's live location (#5); off stops it at once. */}
            <div className="flex items-center gap-3 p-4">
              <IconChip tone={s.shiftOn ? "success" : "teal"}>
                <RadioTower />
              </IconChip>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.shiftOn ? t("On duty") : t("Off duty")}</div>
                <div className="text-2xs text-muted-foreground">{s.shiftOn ? `${t("Since")} ${fmtTime(s.shiftStartedAt!)} · ${t("location on")}` : t("Location off")}</div>
              </div>
              <Toggle on={s.shiftOn} label={t("On duty")} onChange={(v) => a.openSheet({ name: v ? "startShift" : "endShift" })} />
            </div>
          </Card>
        </section>

        {/* Oct 27 2026: language and notifications up front, not buried in Support. Language switches in one tap. */}
        <section>
          <SectionLabel>{t("Settings")}</SectionLabel>
          <Card className="divide-y divide-border">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <IconChip>
                  <Languages />
                </IconChip>
                <div className="min-w-0 flex-1 font-semibold">Language · Idioma</div>
              </div>
              <div role="radiogroup" aria-label="Language" className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-border-strong bg-white p-1">
                {(
                  [
                    ["en", "English"],
                    ["es", "Español"],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={s.lang === v} onClick={() => a.setLang(v)} className={cn("h-11 rounded-full text-[15px] font-semibold transition-colors", s.lang === v ? "bg-teal-deep text-white" : "text-foreground/70")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Row icon={<BellRing />} title={t("Notifications")} sub={notifSummary(s.notifPrefs, t)} onClick={() => a.push({ name: "notifSettings" })} />
          </Card>
        </section>

        <section>
          <SectionLabel>{t("Work")}</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<Car />} title={t("Vehicle")} sub={`${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}${changed ? ` · ${changed} ${t(changed === 1 ? "delivery in an SFK van" : "deliveries in an SFK van")}` : ""}`} onClick={() => a.push({ name: "vehicle" })} />
            <Row icon={<CalendarOff />} title={t("Time off")} sub={availabilitySummary(s.availability, t)} onClick={() => a.push({ name: "availability" })} />
            <Row icon={<HistoryIcon />} title={t("History")} sub={t("Past deliveries and photos")} onClick={() => a.push({ name: "history" })} />
          </Card>
        </section>

        <section>
          <SectionLabel>{t("Support")}</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<Bell />} title={t("Inbox")} sub={unread ? `${unread} ${t("unread from dispatch")}` : t("All read")} onClick={() => a.push({ name: "inbox" })} />
            <Row icon={<Headphones />} title={t("Call dispatch")} sub={`${DISPATCH.name} · ${DISPATCH.phone}`} onClick={() => a.toast(`${t("Calling")} ${DISPATCH.name}…`)} />
            <Row icon={<CircleHelp />} title={t("Driver handbook")} sub={t("Food safety, hot/cold rules, escalation")} />
            {/* #24: the store auto-updates the app; a version SFK marks as required blocks the app (UpdateGate). */}
            <Row
              icon={<Download />}
              title={`${t("Version")} ${SETTINGS.appVersion}`}
              sub={s.update === "none" ? t("Up to date · updates install automatically") : t("Update available")}
              onClick={s.update === "none" ? undefined : () => a.openSheet({ name: "update" })}
            />
          </Card>
        </section>

        <Card>
          <Row icon={<LogOut />} title={t("Sign out")} sub={t("Goes off duty and stops location")} onClick={() => a.jump(() => ({ signedIn: false, shiftOn: false, sheet: null, stack: [{ name: "signin" }] }))} />
        </Card>

        <section>
          <SectionLabel>Prototype</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<Download />} title="Show update prompt" sub="A new version is out: Update now / After this route" onClick={() => a.setUpdate("optional")} />
            <Row icon={<ShieldAlert />} title="Require an update" sub="An old version is blocked until it updates" onClick={() => a.setUpdate("required")} />
            <Row icon={<RotateCcw />} title="Reset demo route" sub="Start the day again from kitchen pickup" onClick={a.resetDemo} />
          </Card>
        </section>
      </div>
    </div>
  );
}

/** One-line summary of the notification settings for the Me tab row. */
function notifSummary(p: NotifPrefs, t: (text: string) => string) {
  const off = [!p.requests && t("requests off"), !p.messages && t("messages off"), !p.sound && t("silent")].filter(Boolean);
  return [`${t("Reminders every")} ${p.reminderHours} h`, ...off].join(" · ");
}

/** One-line summary of upcoming restrictions for the Me tab row. */
function availabilitySummary(av: Availability, t: (text: string) => string) {
  const upcoming = Object.entries(av).filter(([iso]) => iso >= ROUTE_ISO);
  const off = upcoming.filter(([, d]) => d.status === "unavailable").length;
  const hours = upcoming.filter(([, d]) => d.status === "custom").length;
  if (!off && !hours) return `${t("None booked")} · ${SETTINGS.timeOffNoticeDays} ${t("days' notice")}`;
  return [off && `${off} ${t(off === 1 ? "day of time off" : "days of time off")}`, hours && `${hours} ${t("with set hours")}`].filter(Boolean).join(" · ");
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left">
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="truncate text-2xs text-muted-foreground">{sub}</div>
      </div>
      {onClick && <ChevronRight className="size-5 text-muted-foreground" />}
    </Tag>
  );
}

/* ---------------- Location tracking ---------------- */
export function Tracking() {
  const { s, a } = useApp();
  const t = useT();
  const next = nextStop(s);
  const opts: { v: LocationPerm; t: string }[] = [
    { v: "always", t: "Always, while on duty" },
    { v: "while", t: "Only while app is open" },
  ];
  return (
    <div>
      <TopBar title={t("Location sharing")} onBack={a.back} />
      <div className="space-y-5 px-4 py-4">
        {/* #5: live location only while on duty; off duty it stops at once (#8). */}
        <Card className="overflow-hidden">
          <div data-dark-surface className="flex items-center gap-3 bg-teal-deep p-4 text-white">
            <span className="relative grid size-10 place-items-center rounded-full bg-sidebar-active">
              {s.shiftOn && <span className="anim-pulse absolute size-10 rounded-full bg-[#5BD6A0]/40" />}
              <Navigation className="relative size-5 text-yellow" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.shiftOn ? t("On duty · sharing live location") : t("Off duty · not sharing")}</div>
              <div className="text-2xs text-sidebar-muted">{s.shiftOn ? t("Updates every 15 s · battery saver on") : t("Starts when you go on duty")}</div>
            </div>
          </div>
          <div className="p-4 text-[13px] text-muted-foreground">{t("Location turns on when you go on duty and stops the moment you go off. SFK never tracks you off duty. Each delivery also logs where you were when you marked it delivered.")}</div>
        </Card>

        {/* Review: app times are for comparison only; payroll uses the separate clock-in system. */}
        <div className="flex gap-2.5 rounded-xl border border-border bg-muted p-3 text-[13px]">
          <Clock className="mt-0.5 size-4 shrink-0 text-teal" />
          <span>
            <b className="font-semibold">{t("This isn't your clock-in.")}</b> {t("Clock in and out for pay on the SFK time clock as usual. Times in this app are only used to compare against deliveries.")}
          </span>
        </div>

        <section>
          <SectionLabel>{t("Who sees what")}</SectionLabel>
          <Card className="divide-y divide-border">
            <Who icon={<Eye />} title={t("SFK dispatch & admin")} body={t("Your live position on the dispatch map, route progress and ETAs for every stop.")} />
            <Who
              icon={<Eye />}
              title={t("The customer you're heading to")}
              body={next ? `${t("Only while you're on the way to them. Right now:")} ${s.stops[next.id].status === "en_route" ? next.name : t("nobody, you're not navigating yet")}.` : t("Nobody, your route is done.")}
            />
            <Who icon={<EyeOff />} title={t("Other customers")} body={t("See an ETA and their stop number, never your location.")} muted />
          </Card>
        </section>

        <section>
          <SectionLabel>{t("Phone permission")}</SectionLabel>
          <Card className="space-y-2 p-3">
            {opts.map((o) => (
              <button
                key={o.v}
                role="radio"
                aria-checked={s.location === o.v}
                onClick={() => a.setPerm({ location: o.v })}
                className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left text-[15px] font-semibold", s.location === o.v ? "border-teal bg-teal-wash" : "border-control")}
              >
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", s.location === o.v ? "border-teal bg-teal" : "border-control")}>
                  {s.location === o.v && <span className="size-2 rounded-full bg-white" />}
                </span>
                {t(o.t)}
                {o.v === "always" && <Badge tone="teal" className="ml-auto">{t("Recommended")}</Badge>}
              </button>
            ))}
          </Card>
        </section>

        {s.shiftOn ? (
          <Button variant="danger-outline" size="lg" className="w-full" onClick={() => a.openSheet({ name: "endShift" })}>
            {t("Go off duty & stop sharing")}
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "startShift" })}>
            {t("Go on duty")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Who({ icon, title, body, muted }: { icon: React.ReactNode; title: string; body: string; muted?: boolean }) {
  return (
    <div className="flex gap-3 p-4">
      <span className={cn("mt-0.5 [&_svg]:size-5", muted ? "text-muted-foreground" : "text-teal")}>{icon}</span>
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="text-[13px] text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
