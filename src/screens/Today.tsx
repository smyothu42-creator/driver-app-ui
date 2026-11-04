import { Fragment, type ReactNode } from "react";
import { CalendarClock, Check, ChevronRight, ClipboardList, Clock, FileText, MessageSquare, Navigation, ScanLine } from "lucide-react";
import { isOn, laterFor } from "../data/sprints";
import { type State, atKitchen, toKitchenNow, isLoaded, liveRoute, slipsToday, myAssignment, needsKitchenRun, runStops, useApp, nextStop, pickupDelivery, pickupsAt, useRoute, useT } from "../store";
import { KITCHEN, KITCHEN_READY, DRIVER, driveBetween, fmtTime, fmtWindow, runOf, windowStatus, workOf, type Stop } from "../data/route";
import { ActionBar, Button, cn, SlideToConfirm, STATUS_META, StopAvatar, TopBar, WorkTags, SfkMark } from "../components/ui";
import { checkedCount, orderSize } from "./Pickup";
import driverPhoto from "../assets/driver-photo.jpg";
import { StageTrack } from "./StopDetail";
import { type Icon, Clock as Clock3Fill, IdentificationBadge, MapPin as MapPinFill, Package as PackageFill, QrCode, Truck as TruckFill } from "@phosphor-icons/react";

/**
 * Today: one clear "next step", then the route. (The Pick up → Deliver → Confirm track is hidden here for now.)
 * Detail like roles, crew, totes and hot/cold lives on the stop screen, not in this list.
 */
/**
 * Oct 26 2026: Home is gone; the Route tab is the first screen. What Home's top had lives here, under the Route
 * header: the duty status (#8, #78; tap for location sharing) with the day's progress, and one button for the next
 * step: go on duty, load at the kitchen, or open the next stop (the stop's page is where the work happens).
 */
export function DutyCard() {
  const { s, a } = useApp();
  const t = useT();
  const live = liveRoute(s);
  const delivered = live.filter((x) => s.stops[x.id].status === "delivered").length;
  // At the kitchen, count orders loaded on this pickup instead of deliveries. One word for it everywhere: "loaded".
  const atKitchen = s.shiftOn && !s.pickupDone;
  const slips = runStops(s);
  const loadedN = slips.filter((x) => checkedCount(s, x) === x.bags.length).length;
  const [count, of] = atKitchen ? [loadedN, slips.length] : [delivered, live.length];
  const next = nextStop(s);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      {/* One row: duty status on the left, day progress (count + bar) on the right. */}
      <div className="flex items-center gap-3 px-1">
        {/* Nov 4 2026: tapping the driver opens their profile (Me), not the Location sharing page. */}
        <button onClick={() => a.setTab("me")} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
          {/* Driver photo with a status dot: green + pulse while on duty, grey when off. */}
          <span className="relative size-9 shrink-0">
            <img src={s.profilePhoto ?? driverPhoto} alt={DRIVER.name} className="size-9 rounded-full object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center" aria-hidden>
              {s.shiftOn && <span className="anim-pulse absolute size-4 rounded-full bg-success" />}
              <span className={cn("relative size-4 rounded-full border-[3px] border-card transition-colors duration-300", s.shiftOn ? "bg-success" : "bg-control")} />
            </span>
          </span>
          <span className="min-w-0">
            {/* Nov 4 2026: the driver's name on top, duty status under it (location is shared only while on duty). */}
            <span className="block truncate text-[17px] font-semibold leading-tight">{DRIVER.name}</span>
            <span className={cn("block truncate text-[13px]", s.shiftOn ? "font-semibold text-success" : "text-muted-foreground")}>{s.shiftOn ? t("On duty") : t("Off duty")}</span>
          </span>
        </button>
        {/* Sized to the text, so the progress bar is exactly as wide as the label above it. */}
        <div className="shrink-0 text-right text-teal-deep">
          <p className="nums whitespace-nowrap text-[15px] font-semibold leading-snug">
            {atKitchen ? `${loadedN} of ${slips.length} ${t("loaded")}` : delivered === live.length && live.length > 0 ? t("All stops done") : `${delivered} of ${live.length} ${t("delivered")}`}
          </p>
          {/* Oct 26 2026: one continuous bar (not a segment per stop). */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-teal-soft" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={count}>
            <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${(count / Math.max(1, of)) * 100}%` }} />
          </div>
        </div>
      </div>
      {/* The next step, one button. Nov 4 2026: all three (Go on duty, Kitchen pickup, Next) are the same 48px / 17px. */}
      {!s.shiftOn ? (
        <button onClick={() => a.openSheet({ name: "startShift" })} className="btn-yellow mt-3 h-12 w-full rounded-full text-[17px] font-bold text-teal-deep transition active:scale-[0.98]">
          {t("Go on duty")}
        </button>
      ) : !s.pickupDone ? (
        <Button size="md" className="mt-3 h-12 w-full gap-1.5 text-[17px]" onClick={() => a.push({ name: "kitchen" })}>
          <SfkMark className="size-5" /> {t("Kitchen pickup")} <ChevronRight />
        </Button>
      ) : next ? (
        <Button size="md" className="mt-3 h-12 w-full min-w-0 gap-1.5 text-[17px]" onClick={() => a.push({ name: "stop", id: next.id })}>
          <span className="truncate">
            {needsKitchenRun(s, next.id) ? t("Back to kitchen to load") : `${t("Next")}: ${next.name}`}
          </span>
          <ChevronRight className="shrink-0" />
        </Button>
      ) : (
        // Nov 4 2026: every stop done: see what's next on Schedule, or end the duty (goes off duty, then opens Me).
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="md" variant="outline" className="h-12 min-w-0 px-3 text-[17px]" onClick={() => a.setTab("schedule")}>
            {t("Schedule")}
          </Button>
          {/* Ends the duty straight away (location sharing stops), then shows the profile. */}
          <Button size="md" className="h-12 min-w-0 px-3 text-[17px]" onClick={() => (a.endShift(), a.setTab("me"))}>
            {t("End duty")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Requests and Inbox, two icons in one white pill. Oct 26 2026: moved from Home's header to the Route tab's. */
export function HeaderActions() {
  const { s, a } = useApp();
  const t = useT();
  // The requests button waits for the Schedule sprint (src/data/sprints.ts).
  const requests = !laterFor("schedule");
  const pending = requests ? s.requests.filter((r) => r.status === "pending").length : 0;
  const fromDispatch = s.inbox.filter((m) => m.from === "dispatch" && !m.read).length;
  return (
    <>
    {/* Requests (#18) and Inbox (#6) in one white pill, like an iOS toolbar group (Oct 22 2026; on the Route tab since Oct 26): two icons, a hairline
        between them, each keeping its own count. Oct 26 2026: the requests half stays put with nothing waiting, it just loses its count. */}
    {/* Nov 4 2026: a little bigger (48px tall, 22px icons) so both are easier to see and tap. */}
    <div className="flex h-12 items-center rounded-full bg-white text-teal-deep">
      {requests && (
        <>
          <button onClick={() => a.push({ name: "requests" })} aria-label={pending ? `${pending} ${pending === 1 ? t("request needs your answer") : t("requests need your answer")}` : t("Requests")} className="relative grid h-12 w-[52px] place-items-center rounded-l-full active:bg-muted">
            <CalendarClock className="size-[22px]" />
            {pending > 0 && <span className="nums absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{pending}</span>}
          </button>
          <span aria-hidden className="h-6 w-px bg-border-strong" />
        </>
      )}
      <button onClick={() => a.push({ name: "inbox" })} aria-label={`${t("Inbox")}, ${fromDispatch} messages`} className={cn("relative grid h-12 w-[52px] place-items-center active:bg-muted", requests ? "rounded-r-full" : "rounded-full")}>
        <MessageSquare className="size-[22px]" />
        {fromDispatch > 0 && isOn("notifications") && <span className="nums absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{fromDispatch}</span>}
      </button>
    </div>
    </>
  );
}

/** A kitchen pickup's section head, styled like the stop page's stages: grey band above, big icon, title, status. */
function PickupSection({ icon: I, title, status, sub, first }: { icon: Icon; title: string; status: string; sub?: string; first?: boolean }) {
  return (
    // Nov 4 2026: on a soft grey band, like the stop page's stage headers and Schedule's day headers.
    <div className={cn("-mx-5 bg-muted/70 px-5 py-3.5", first && "mt-7")}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-white text-teal-deep shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <I weight="fill" className="size-[28px]" />
        </span>
        {/* The icon is centred on the title and the line under it together. */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-[20px] font-semibold leading-snug tracking-tight">{title}</h2>
            <span className="nums shrink-0 text-[15px] text-muted-foreground">{status}</span>
          </span>
          {sub && <span className="nums mt-0.5 block text-[15px] text-muted-foreground">{sub}</span>}
        </span>
      </div>
    </div>
  );
}

function KitchenAvatar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-[14px] bg-teal-deep text-yellow", className)}>
      <SfkMark className="size-1/2" />
    </span>
  );
}

/**
 * Oct 26 2026: the same trip-style progress bar as the stop page: on duty (or back at the kitchen, for a later
 * pickup) → scan every slip → load every item → start the route. On the kitchen screen and each order's load screen.
 */
export function kitchenStages(s: State, t: (k: string) => string) {
  const route = runStops(s);
  const scannedAll = route.every((x) => s.scanned[x.id]);
  const loadedAll = route.every((x) => checkedCount(s, x) === x.bags.length);
  return [
    s.run > 1
      ? { key: "go", label: t("Go to kitchen"), icon: MapPinFill, done: atKitchen(s) }
      : { key: "duty", label: t("On duty"), icon: IdentificationBadge, done: s.shiftOn },
    { key: "scan", label: t("Scan slips"), icon: QrCode, done: scannedAll },
    { key: "load", label: t("Load"), icon: PackageFill, done: loadedAll },
    { key: "start", label: t("Start route"), icon: TruckFill, done: s.pickupDone },
  ];
}

/**
 * Kitchen pickup (was Home's kitchen card, Oct 26 2026: its own screen now that Home is gone). Opened from the duty
 * card's button and the kitchen row on Route: when it's ready, the driver instructions PDF, this pickup's orders with
 * their load status (tap one for what's in it), later pickups, and the one action at the bottom.
 */
export function KitchenScreen() {
  const { s, a } = useApp();
  const t = useT();
  const route = runStops(s); // this kitchen pickup's orders
  const readyIn = (KITCHEN_READY[s.run] ?? KITCHEN.readyAt) - s.clock; // minutes until the kitchen has this pickup ready
  // Later kitchen pickups today, grouped by run: shown under this one so the driver sees what's coming.
  const laterSlips = slipsToday(s).filter((x) => runOf(x) > s.run);
  const laterRuns = [...new Set(laterSlips.map(runOf))].sort((x, y) => x - y);
  const stages = kitchenStages(s, t);
  return (
    <div className="flex h-full flex-col bg-card">
      <TopBar title={`${t("Kitchen pickup")}${s.run > 1 ? ` ${s.run}` : ""}`} onBack={a.back} tone="white" />
      {/* Nov 4 2026 (review: "more spacing and clean this page"): the kitchen gets its full name on its own line, the
          ready time and the instructions sit in one soft card, and each pickup is a titled, rounded list with room
          around it instead of grey full-width bands. */}
      {/* Nov 4 2026: the track stays put above the scroll, like the stop page's, so it never scrolls away. */}
      <div className="relative z-10 shrink-0 border-b border-border/60 bg-white px-5 pb-4 pt-2">
        <StageTrack stages={stages} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-6">
        <div className="flex items-start gap-3.5">
          <KitchenAvatar className="size-12" />
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block text-xl font-semibold leading-tight tracking-tight">{KITCHEN.name}</span>
            <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
              {KITCHEN.addressLine1}, {KITCHEN.city}
            </span>
          </span>
        </div>

        <div className="mt-5 divide-y divide-border rounded-2xl bg-muted/70">
          {/* A countdown ("Dispatch ready in 12 min"), not a clock time; "Dispatch ready · Now" once it's time. */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Clock className="size-5 shrink-0 text-teal" aria-hidden />
            <span className="flex-1 text-[15px] text-muted-foreground">{readyIn > 0 ? t("Dispatch ready in") : t("Dispatch ready")}</span>
            <span className="nums whitespace-nowrap text-[17px] font-semibold text-foreground">{readyIn > 0 ? `${readyIn} min` : t("Now")}</span>
          </div>
          {/* Superfine has no dock; drivers park and walk up. Superfine's static PDF says how to reach the suite. */}
          <a href={KITCHEN.instructionsUrl} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center gap-3 px-4 text-[15px] font-semibold text-teal-deep active:bg-black/5">
            <FileText className="size-5 shrink-0 text-teal" aria-hidden />
            <span className="flex-1">{t("Driver instructions")}</span>
            <ChevronRight className="size-4 text-muted-foreground/60" />
          </a>
        </div>

        {/* What's waiting at the kitchen: one row per order. Tap for what's in it (same screen as scanning its slip). */}
        {/* Nov 4 2026 (review: "out of theme too"): each pickup is a page section like the stop page's stages: the grey
            band above, a big icon, title and status, then its orders as edge-to-edge rows with hairlines (no boxed card). */}
        <PickupSection first icon={PackageFill} title={`${route.length} ${route.length === 1 ? t("order to pick up") : t("orders to pick up")}`} status={`${route.filter((x) => checkedCount(s, x) === x.bags.length).length} of ${route.length} ${t("loaded")}`} />
        <ul className="-mx-5 divide-y divide-border border-y border-border bg-white">
          {route.map((x) => {
            const done = checkedCount(s, x);
            const all = done === x.bags.length;
            return (
              <li key={x.id}>
                <button onClick={() => a.push({ name: "package", id: x.id })} disabled={!s.shiftOn} className="flex min-h-[68px] w-full items-center gap-3 px-5 py-3 text-left active:bg-muted/60">
                  <StopAvatar stop={x} square className="size-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">{x.name}</span>
                    <span className="nums mt-0.5 block truncate text-[15px] text-muted-foreground">{orderSize(x)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("nums flex items-center gap-1 text-[15px] font-medium", all ? "font-semibold text-success" : s.scanned[x.id] ? "font-semibold text-teal-deep" : "text-muted-foreground")}>
                      {all ? (
                        <>
                          <Check className="size-4" strokeWidth={3} /> {t("Loaded")}
                        </>
                      ) : s.scanned[x.id] ? (
                        `${done}/${x.bags.length}`
                      ) : (
                        t("Not loaded")
                      )}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground/60" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Next kitchen pickups: same list, showing when it's ready instead of a scan status. */}
        {laterRuns.map((r) => {
          const rows = laterSlips.filter((x) => runOf(x) === r);
          const ready = fmtTime(KITCHEN_READY[r] ?? KITCHEN.readyAt);
          return (
            <Fragment key={r}>
              <PickupSection icon={Clock3Fill} title={`${t("Kitchen pickup")} ${r}`} status="" sub={`${t("Dispatch ready")} ${ready}`} />
              <ul className="-mx-5 divide-y divide-border border-y border-border bg-white">
                {rows.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => a.openSheet({ name: "laterPickup", id: x.id })} className="flex min-h-[68px] w-full items-center gap-3 px-5 py-3 text-left active:bg-muted/60">
                      <StopAvatar stop={x} square className="size-12 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold">{x.name}</span>
                        <span className="nums mt-0.5 block truncate text-[15px] text-muted-foreground">{orderSize(x)}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  </li>
                ))}
              </ul>
            </Fragment>
          );
        })}
      </div>
      {/* The pickup's one action: directions back to the kitchen for a later pickup, scan a slip until every order is
          loaded, then slide to start the route. Off duty, go on duty first. */}
      <ActionBar>
        {!s.shiftOn ? (
          <button onClick={() => a.openSheet({ name: "startShift" })} className="btn-yellow h-14 w-full rounded-full text-[17px] font-bold text-teal-deep transition active:scale-[0.98]">
            {t("Go on duty")}
          </button>
        ) : !atKitchen(s) && toKitchenNow(s) ? (
          // Nov 3 2026: back from Google Maps on the way to the kitchen: slide on arrival (like a stop), Maps one tap away.
          <>
            {/* Nov 4 2026: Maps above the slider (like the stop page's Call / Message), so the slider is the last thing. */}
            <button onClick={a.navKitchen} className="-mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-[15px] font-semibold text-teal-deep">
              <Navigation className="size-4" /> Maps
            </button>
            <SlideToConfirm label={t("Slide when you arrive")} tone="teal" onConfirm={() => a.arriveKitchen()} />
          </>
        ) : !atKitchen(s) ? (
          <Button size="lg" className="w-full" onClick={a.navKitchen}>
            <Navigation /> {t("Navigate to the kitchen")}
          </Button>
        ) : route.every((x) => checkedCount(s, x) === x.bags.length) ? (
          <SlideToConfirm label="All orders loaded" onConfirm={a.confirmPickup} />
        ) : (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "scan" })}>
            <ScanLine /> {t("Scan packing slip")}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}




/** Today's route as a timeline: kitchen pickups and stops in order. Shown on the Route tab under the map. */
export function RouteTimeline() {
  const { s, a } = useApp();
  const t = useT();
  const route = useRoute(); // includes cancelled stops, shown struck through
  const next = nextStop(s);
  // Planned legs (Oct 21 2026): each stop from the stop before it, or from the kitchen when it starts a pickup.
  const live = route.filter((x) => s.stops[x.id].status !== "cancelled");
  const driveTo = (x: Stop) => {
    const prev = live[live.indexOf(x) - 1];
    const fromKitchen = !prev || s.loaded[x.id] === "kitchen-run" || needsKitchenRun(s, x.id) || (x.kind !== "pickup" && runOf(prev) !== runOf(x));
    return driveBetween(fromKitchen ? "k" : prev.id, x.id).mins;
  };
  return (
    <ol>
      {/* A kitchen pickup row before each run's first delivery: a route can go back to the kitchen once run 1 is delivered. */}
      {route.map((x, i) => {
        const startsRun = x.kind !== "pickup" && (i === 0 || runOf(route[i - 1]) !== runOf(x) || route[i - 1].kind === "pickup");
        const run = runOf(x);
        const loadedAt = s.runLoadedAt[run];
        const kState = run < s.run || (run === s.run && s.pickupDone) ? "done" : run === s.run ? "current" : "todo";
        return (
          <Fragment key={x.id}>
            {startsRun && (
              <TimelineItem
                state={kState}
                kind="kitchen"
                railTime={kState === "done" && loadedAt != null ? loadedAt : (KITCHEN_READY[run] ?? KITCHEN.readyAt)}
                title={run === 1 ? t("Kitchen pickup") : `${t("Kitchen pickup")} ${run}`}
                detail={(() => {
                  if (kState === "done" && loadedAt != null) return `Loaded ${fmtTime(loadedAt)}`;
                  // Later pickups: the drive back from the last stop before it, on the time line like a stop's (Nov 4 2026).
                  const before = live[live.indexOf(x) - 1];
                  return `Dispatch ready ${fmtTime(KITCHEN_READY[run] ?? KITCHEN.readyAt)}${before ? ` · ${driveBetween(before.id, "k").mins} min drive` : ""}`;
                })()}
                avatar={<KitchenAvatar className="size-9" />}
                tag={(() => {
                  const n = route.filter((y) => y.kind !== "pickup" && runOf(y) === run && s.stops[y.id].status !== "cancelled").length;
                  return (
                    <span className="nums inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                      <ClipboardList className="size-3.5 text-teal" strokeWidth={2.2} />
                      {n} {n === 1 ? t("order") : t("orders")}
                    </span>
                  );
                })()}
                onClick={kState === "current" ? () => a.push({ name: "kitchen" }) : undefined}
                first={i === 0}
                last={false}
              />
            )}
            <StopRow stop={x} current={isLoaded(s, x) && x.id === next?.id} first={i === 0 && !startsRun} last={i === route.length - 1} drive={driveTo(x)} />
          </Fragment>
        );
      })}
    </ol>
  );
}

function StopRow({ stop, current, first, last, drive }: { stop: Stop; current: boolean; first?: boolean; last: boolean; drive: number }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[stop.id];
  const done = st.status === "delivered";
  const cancelled = st.status === "cancelled";
  const eta = s.clock + stop.driveMins;
  const showEta = current && !needsKitchenRun(s, stop.id) && st.status !== "arrived";
  const pickup = stop.kind === "pickup";
  const skipped = cancelled && st.skip?.status === "approved";
  // Reusables pickup at the same address as a delivery still to do: picked up during that delivery.
  const along = isOn("reusables") ? pickupDelivery(s, stop) : undefined;
  const rideAlong = isOn("reusables") && !pickup && !cancelled && !done ? pickupsAt(s, stop) : [];
  const w = pickup && !done && !cancelled ? windowStatus(stop, s.clock) : null;

  // One tag per row at most, picked by what the driver has to act on first.
  const tag = skipped ? (
    <Note>Skipped</Note>
  ) : cancelled ? (
    <Note warn>{t("Cancelled")}</Note>
  ) : st.skip?.status === "pending" ? (
    <Note>Skip requested</Note>
  ) : w && !along && w.state !== "upcoming" ? (
    <Note warn={w.state === "missed"} tone={w.state === "closing" ? "warning" : w.state === "open" ? "teal" : undefined}>
      {w.text}
    </Note>
  ) : st.issue ? (
    <Note warn>Issue</Note>
  ) : done ? null : isOn("team") && !myAssignment(s, stop.id) ? (
    <Note>Reassigned</Note>
  ) : needsKitchenRun(s, stop.id) ? (
    <Note>Load at kitchen</Note>
  ) : st.status !== "queued" ? (
    <Note>{STATUS_META[st.status].label}</Note>
  ) : s.changes[stop.id] ? (
    <Note>
      {t("New time")} · {fmtWindow(stop.windowStart, stop.windowEnd)}
    </Note>
  ) : isOn("schedule") && s.claims[stop.id] ? (
    <Note>Claimed</Note>
  ) : isOn("dropoff") && stop.guestReadyTime ? (
    <Note>Setup by {fmtTime(stop.guestReadyTime)}</Note>
  ) : null;

  return (
    <TimelineItem
      state={done || cancelled ? "done" : current ? "current" : "todo"}
      kind="stop"
      railTime={done ? st.deliveredAt! : stop.windowStart}
      title={stop.name}
      struck={cancelled}
      detail={
        skipped
          ? `Skipped · approved by dispatch ${fmtTime(st.skip!.decidedAt!)}`
          : cancelled
            ? `Cancelled by dispatch ${fmtTime(st.cancelledAt!)}`
            : done
              ? `${pickup ? "Collected" : "Delivered"} ${fmtTime(st.deliveredAt!)}`
              : along
                ? `With your delivery to ${along.name}`
                : showEta
                  ? `ETA ${fmtTime(eta)} · by ${fmtTime(stop.windowEnd)}`
                  : pickup
                    ? `Pickup window ${fmtWindow(stop.windowStart, stop.windowEnd)}`
                    : // Nov 4 2026: the drive time joins the window line instead of a line of its own.
                      `${fmtWindow(stop.windowStart, stop.windowEnd)}${along ? "" : ` · ${drive} min drive`}`
      }
      detailTone={showEta ? (eta > stop.windowEnd ? "late" : "ontime") : undefined}
      tag={
        cancelled || done ? tag : (
          // Nov 4 2026 (review: "too many things to focus"): one quiet line, hot / cold / collect as short tinted chips, and the one note (e.g. "Setup by") follows them.
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* A reusables pickup at the same address shows as the same "Reusables" work tag (Oct 22 2026), not a link-like note. */}
            <WorkTags work={rideAlong.length > 0 && !workOf(stop).includes("reusables") ? [...workOf(stop), "reusables"] : workOf(stop)} variant="plain" short chips="compact" className="!gap-x-1.5" />
            {tag}
          </span>
        )
      }
      onClick={() => a.push({ name: "stop", id: stop.id })}
      first={first}
      last={last}
      anchor={`route-${stop.id}`}
      avatar={<StopAvatar stop={stop} square className="size-9" />}
      alert={!!st.issue && !done && !cancelled}
    />
  );
}


/**
 * Route list in the app's list style (Oct 21 2026): kitchen pickups and stops are the same white rows: time on
 * the left, the timeline rail, a profile picture (the kitchen's or the customer's), name, one time line and plain tags.
 * Rail (Oct 22 2026): one continuous line through every row with a node per row, so it reads as a timeline:
 * ✓ in a green circle when done (not colour alone), a teal ringed dot for now, an empty circle to do, ! for a problem.
 * The line is green up to the current step, grey after it. The current row has a soft teal wash.
 */
function TimelineItem({
  state, title, detail, detailTone, tag, onClick, first, last, struck, anchor, avatar, alert,
}: {
  state: "done" | "current" | "todo"; kind: "kitchen" | "stop"; railTime: number; title: string; detail: string; struck?: boolean;
  detailTone?: "ontime" | "late"; tag?: ReactNode; onClick?: () => void; first?: boolean; last: boolean; anchor?: string; avatar?: ReactNode; alert?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  const done = state === "done";
  const current = state === "current";

  return (
    <li id={anchor} className={cn("scroll-mt-3", !last && "border-b border-border")}>
      <Tag onClick={onClick} className={cn("flex w-full items-stretch gap-3 px-4 py-3.5 text-left", current && "bg-teal-wash/70", onClick && "active:bg-muted/50")}>
        {/* Nov 4 2026 (review: "too many things to focus"): no time column on the left. It only repeated the time the row
            already shows (window, ready or delivered time), and the row gets the width back. "Now" moved into the row. */}
        {/* Nov 4 2026: the logo / picture leads the row, in front of the timeline. */}
        {avatar && <span className={cn("flex shrink-0 self-start", done && "opacity-60")}>{avatar}</span>}
        {/* Rail: reaches through the row's padding (and the hairline under it) so the segments join into one line.
            Nov 4 2026: the dot is centred on the 36px logo beside it (row padding 14 + 18 = 32px down). */}
        <span aria-hidden className="relative -my-3.5 w-6 shrink-0">
          {!first && <span className={cn("absolute left-1/2 top-0 h-[32px] w-0.5 -translate-x-1/2", done || current ? "bg-success" : "bg-border-strong")} />}
          {!last && <span className={cn("absolute -bottom-px left-1/2 top-[32px] w-0.5 -translate-x-1/2", done ? "bg-success" : "bg-border-strong")} />}
          <span
            className={cn(
              "absolute left-1/2 top-[20px] grid size-6 -translate-x-1/2 place-items-center rounded-full",
              alert ? "bg-danger text-white" : done ? "bg-success text-white" : current ? "border-2 border-teal bg-white" : "border-2 border-border-strong bg-white",
            )}
          >
            {alert ? <span className="text-[13px] font-extrabold leading-none">!</span> : done ? <Check className="size-3.5" strokeWidth={3} /> : current && <span className="size-2.5 rounded-full bg-teal" />}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          {/* Nov 4 2026: a bigger name and a slightly heavier time line, so each row reads at a glance. */}
          <span className={cn("block truncate text-[17px] font-semibold leading-tight", done && "text-muted-foreground", struck && "line-through")}>{title}</span>
          <span className={cn("nums mt-1 block truncate text-[13px] font-medium", detailTone === "late" ? "text-danger" : "text-muted-foreground")}>
            {current && <b className="font-bold text-teal">Now · </b>}
            {detail}
          </span>
          {/* Nov 4 2026: every row keeps room for the work chips plus one note line (e.g. "Setup by"), so all rows are
              the same height whether or not they have a note. */}
          <span className="mt-1 flex min-h-[44px] items-start">{tag}</span>
        </span>
        {onClick && <ChevronRight className="mt-1 size-4 shrink-0 self-start text-muted-foreground/60" />}
      </Tag>
    </li>
  );
}

/** Plain-text tag for the route list (no chip colours); problems stay red so they still stand out. */
function Note({ children, warn, tone }: { children: ReactNode; warn?: boolean; tone?: "teal" | "warning" }) {
  return <span className={cn("nums text-[13px] font-medium", warn ? "text-danger" : tone === "teal" ? "text-teal-deep" : tone === "warning" ? "font-semibold text-warning" : "text-muted-foreground")}>{children}</span>;
}
