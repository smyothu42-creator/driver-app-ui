import { Bell, CalendarOff, Car, CheckCircle2, ChevronRight, ChevronUp, Clock, CircleHelp, Download, Eye, EyeOff, Headphones, Languages, LogOut, MapPin, Navigation, RadioTower, RotateCcw } from "lucide-react";
import { liveRoute, needsKitchenRun, useApp, nextStop, useRoute, useT, type LocationPerm } from "../store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DISPATCH, DRIVER, KITCHEN, PAST, ROUTE_ISO, SETTINGS, KITCHEN_READY, fmtTime, fmtWindow, legBetween, runOf, type Stop } from "../data/route";
import type { Availability } from "../data/availability";
import { Badge, Button, Card, cn, IconChip, SectionLabel, SfkMark, StatusText, StopAvatar, Toggle, TopBar, WorkTags } from "../components/ui";
import { MapView, type Pin } from "../components/MapView";
import { DeliveryScene } from "../components/Illustrations";

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
        <span className="min-w-0 truncate text-[16px] font-semibold">
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
        <button onClick={() => setHidden(false)} className="absolute -top-12 left-1/2 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-card px-4 text-[14px] font-semibold text-teal-deep">
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
                  <span className="min-w-0 flex-1 truncate text-[18px] font-semibold leading-tight">{it.run === 1 ? "Kitchen pickup" : `Kitchen pickup ${it.run}`}</span>
                  <StatusText tone={done ? "done" : it.run === s.run ? "now" : "later"}>{done ? "Loaded" : it.run === s.run ? "Now" : "Later"}</StatusText>
                </div>
                <address className="mt-2 text-[15px] not-italic leading-snug text-muted-foreground">
                  <span className="block font-medium text-foreground">{KITCHEN.name}</span>
                  <span className="block">{KITCHEN.dock}</span>
                  <span className="block">{KITCHEN.addressLine1}</span>
                </address>
                <div className="nums mt-2 text-[15px] font-semibold text-teal-deep">
                  {done && loadedAt != null ? `Loaded ${fmtTime(loadedAt)}` : `Ready ${fmtTime(KITCHEN_READY[it.run] ?? KITCHEN.readyAt)}`}
                </div>
              </Card>
            );
          }
          const x = it.stop;
          const st = s.stops[x.id];
          return (
            <Card key={it.key} onClick={() => a.push({ name: "stop", id: x.id })} className={cn("flex w-[304px] shrink-0 snap-center flex-col p-4 transition-shadow", on && "ring-2 ring-teal-deep")}>
              <div className="flex items-start gap-2.5">
                {/* Company logo tile or the person's photo, so a company vs an individual reads at a glance. */}
                <StopAvatar stop={x} className="size-11 text-[14px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold leading-tight">{x.name}</span>
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
                {st.status === "delivered" ? `${x.kind === "pickup" ? "Collected" : "Delivered"} ${fmtTime(st.deliveredAt!)}` : `${fmtWindow(x.windowStart, x.windowEnd)} · ${x.miles} mi`}
              </div>
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
export function History() {
  const { s, a } = useApp();
  const done = useRoute().filter((x) => s.stops[x.id].status === "delivered");
  return (
    <div>
      <div data-dark-surface className="bg-teal-deep px-5 pb-5 pt-4 text-white">
        <p className="text-2xs font-semibold text-sidebar-muted">Last 30 days</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">History</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["98%", "On time"],
            ["212", "Stops"],
            ["4.9", "Rating"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-sidebar-active/60 px-3 py-3 text-center">
              <div className="nums text-2xl font-bold leading-none tracking-tight">{v}</div>
              <div className="mt-1.5 text-2xs font-semibold text-sidebar-muted">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-4 pb-6 pt-4">
        <section>
          <SectionLabel>Today</SectionLabel>
          {done.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-muted-foreground">Delivered stops and photos show here.</Card>
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
                      <span className="nums block text-sm font-semibold leading-tight">{fmtTime(at)}</span>
                      <ResultTag ok={onTime}>{onTime ? "On time" : `${at - x.windowEnd} min late`}</ResultTag>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </Card>
          )}
        </section>

        <section>
          <SectionLabel>Earlier</SectionLabel>
          <Card className="divide-y divide-border">
            {PAST.map((d) => {
              const ok = d.onTime === d.stops;
              return (
                <div key={d.date} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold leading-tight">{d.date}</div>
                    <div className="nums mt-0.5 text-[13px] text-muted-foreground">
                      {d.stops} stops · {d.meals} meals
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="nums block text-sm font-semibold leading-tight">
                      {d.onTime}/{d.stops}
                    </span>
                    <ResultTag ok={ok}>{ok ? "All on time" : `${d.stops - d.onTime} late`}</ResultTag>
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
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-14 place-items-center rounded-full bg-yellow text-lg font-bold text-teal-deep">{DRIVER.initials}</span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold tracking-tight">{DRIVER.name}</div>
            <div className="text-2xs text-muted-foreground">
              {DRIVER.type} driver · {DRIVER.phone}
            </div>
          </div>
        </Card>

        <section>
          <SectionLabel>{t("Ready")}</SectionLabel>
          <Card className="divide-y divide-border">
            {/* #8 / #78: one Ready (on duty) toggle. While on, dispatch sees the driver's live location. */}
            <div className="flex items-center gap-3 p-4">
              <IconChip tone={s.shiftOn ? "success" : "teal"}>
                <RadioTower />
              </IconChip>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.shiftOn ? t("Ready") : t("Not ready")}</div>
                <div className="text-2xs text-muted-foreground">{s.shiftOn ? `On duty since ${fmtTime(s.shiftStartedAt!)} · location on` : "Off duty · location off"}</div>
              </div>
              <Toggle on={s.shiftOn} label={t("Ready")} onChange={(v) => a.openSheet({ name: v ? "startShift" : "endShift" })} />
            </div>
            <Row icon={<MapPin />} title={t("Location sharing")} sub={s.shiftOn ? "Live with SFK dispatch" : "Paused · off duty"} onClick={() => a.push({ name: "tracking" })} />
          </Card>
        </section>

        <section>
          <SectionLabel>Work</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<Car />} title={t("Vehicle")} sub={`Default: ${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}${changed ? ` · ${changed} ${changed === 1 ? "delivery" : "deliveries"} in an SFK van` : ""}`} onClick={() => a.push({ name: "vehicle" })} />
            <Row icon={<CalendarOff />} title={t("Time off")} sub={availabilitySummary(s.availability)} onClick={() => a.push({ name: "availability" })} />
          </Card>
        </section>

        <section>
          <SectionLabel>Support</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<Bell />} title={t("Inbox")} sub={unread ? `${unread} unread from dispatch` : "All read"} onClick={() => a.push({ name: "inbox" })} />
            <Row icon={<Headphones />} title={t("Call dispatch")} sub={`${DISPATCH.name} · ${DISPATCH.phone}`} onClick={() => a.toast(`Calling ${DISPATCH.name}…`)} />
            <Row icon={<Languages />} title={t("Language")} sub={s.lang === "es" ? "Español" : "English"} onClick={() => a.openSheet({ name: "language" })} />
            <Row icon={<CircleHelp />} title="Driver handbook" sub="Food safety, hot/cold rules, escalation" />
            <Row
              icon={<Download />}
              title={`Version ${SETTINGS.appVersion}`}
              sub={s.update === "none" ? "Up to date" : "Update available"}
              onClick={s.update === "none" ? undefined : () => a.openSheet({ name: "update" })}
            />
          </Card>
        </section>

        <section>
          <SectionLabel>Prototype</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<RotateCcw />} title="Reset demo route" sub="Start the day again from kitchen pickup" onClick={a.resetDemo} />
            <Row icon={<LogOut />} title="Sign out" sub="Back to the sign-in screen" onClick={() => a.jump(() => ({ signedIn: false, shiftOn: false, stack: [{ name: "signin" }] }))} />
          </Card>
        </section>
      </div>
    </div>
  );
}

/** One-line summary of upcoming restrictions for the Me tab row. */
function availabilitySummary(av: Availability) {
  const upcoming = Object.entries(av).filter(([iso]) => iso >= ROUTE_ISO);
  const off = upcoming.filter(([, d]) => d.status === "unavailable").length;
  const hours = upcoming.filter(([, d]) => d.status === "custom").length;
  if (!off && !hours) return `None booked · ${SETTINGS.timeOffNoticeDays} days' notice`;
  return [off && `${off} ${off === 1 ? "day" : "days"} of time off`, hours && `${hours} with set hours`].filter(Boolean).join(" · ");
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
  const next = nextStop(s);
  const opts: { v: LocationPerm; t: string }[] = [
    { v: "always", t: "Always, while Ready" },
    { v: "while", t: "Only while app is open" },
  ];
  return (
    <div>
      <TopBar title="Location sharing" onBack={a.back} />
      <div className="space-y-5 px-4 py-4">
        <Card className="overflow-hidden">
          <div data-dark-surface className="flex items-center gap-3 bg-teal-deep p-4 text-white">
            <span className="relative grid size-10 place-items-center rounded-full bg-sidebar-active">
              {s.shiftOn && <span className="anim-pulse absolute size-10 rounded-full bg-[#5BD6A0]/40" />}
              <Navigation className="relative size-5 text-yellow" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.shiftOn ? "Ready · sharing live location" : "Not ready · not sharing"}</div>
              <div className="text-2xs text-sidebar-muted">{s.shiftOn ? "Updates every 15 s · battery saver on" : "Starts when you turn on Ready"}</div>
            </div>
          </div>
          <div className="p-4 text-[13px] text-muted-foreground">
            Location turns on with <b className="font-semibold text-foreground">Ready</b> and stops the moment you turn it off. SFK never tracks you off duty. Each delivery also logs where you were when you marked it delivered.
          </div>
        </Card>

        {/* Review: app times are for comparison only; payroll uses the separate clock-in system. */}
        <div className="flex gap-2.5 rounded-xl border border-border bg-muted p-3 text-[13px]">
          <Clock className="mt-0.5 size-4 shrink-0 text-teal" />
          <span>
            <b className="font-semibold">This isn't your clock-in.</b> Clock in and out for pay on the SFK time clock as usual. Times in this app are only used to compare against deliveries.
          </span>
        </div>

        <section>
          <SectionLabel>Who sees what</SectionLabel>
          <Card className="divide-y divide-border">
            <Who icon={<Eye />} title="SFK dispatch & admin" body="Your live position on the dispatch map, route progress and ETAs for every stop." />
            <Who
              icon={<Eye />}
              title="The customer you're heading to"
              body={next ? `Only while you're on the way to them. Right now: ${s.stops[next.id].status === "en_route" ? next.name : "nobody, you're not navigating yet"}.` : "Nobody, your route is done."}
            />
            <Who icon={<EyeOff />} title="Other customers" body="See an ETA and “Stop 3 of 4”, never your location." muted />
          </Card>
        </section>

        <section>
          <SectionLabel>Phone permission</SectionLabel>
          <Card className="space-y-2 p-3">
            {opts.map((o) => (
              <button
                key={o.v}
                role="radio"
                aria-checked={s.location === o.v}
                onClick={() => a.setPerm({ location: o.v })}
                className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold", s.location === o.v ? "border-teal bg-teal-wash" : "border-control")}
              >
                <span className={cn("grid size-5 place-items-center rounded-full border-2", s.location === o.v ? "border-teal bg-teal" : "border-control")}>
                  {s.location === o.v && <span className="size-2 rounded-full bg-white" />}
                </span>
                {o.t}
                {o.v === "always" && <Badge tone="teal" className="ml-auto">Recommended</Badge>}
              </button>
            ))}
          </Card>
        </section>

        {s.shiftOn && (
          <Button variant="danger-outline" size="lg" className="w-full" onClick={() => a.openSheet({ name: "endShift" })}>
            Turn off Ready & stop sharing
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
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[13px] text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
