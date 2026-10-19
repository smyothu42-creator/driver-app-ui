import { Fragment, type ReactNode } from "react";
import { Bell, Building2, CalendarClock, Camera, Car, Maximize2, MessageSquare, ChevronRight, ClipboardList, Clock, MapPin, Navigation, QrCode, Recycle, Route, ThermometerSun } from "lucide-react";
import { isOn, laterFor } from "../data/sprints";
import { foodSafety, isLoaded, liveRoute, myAssignment, needsKitchenRun, runStops, useApp, nextStop, useRoute, useT } from "../store";
import { KITCHEN, KITCHEN_READY, DRIVER, SETTINGS, fmtTime, fmtWindow, runOf, type Stop } from "../data/route";
import { Badge, Button, Card, cn, STATUS_META, StopAvatar, WorkTags, SfkMark } from "../components/ui";
import driverPhoto from "../assets/driver-photo.jpg";
import accessPhoto from "../assets/access-photo.jpg";
import { KitchenPickupScene } from "../components/Illustrations";

/**
 * Today: one clear "next step", then the route. (The Pick up → Deliver → Confirm track is hidden here for now.)
 * Detail like roles, crew, totes and hot/cold lives on the stop screen, not in this list.
 */
export function Today() {
  const { s, a } = useApp();
  const t = useT();
  const live = liveRoute(s);
  const delivered = live.filter((x) => s.stops[x.id].status === "delivered").length;
  const next = nextStop(s);
  // The requests nudge waits for the Schedule sprint (src/data/sprints.ts).
  const pending = laterFor("schedule") ? 0 : s.requests.filter((r) => r.status === "pending").length;
  const fromDispatch = s.inbox.filter((m) => m.from === "dispatch" && !m.read).length;

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      {/* Header: greeting; the duty card (with day progress) overlaps its lower edge. */}
      <div className="relative overflow-hidden bg-[#CFE8E8] px-5 pb-3 pt-1 text-teal-deep">
        {/* Street-scene art is hidden for now: <HeaderScene className="pointer-events-none absolute inset-0 h-full w-full" /> (components/Illustrations.tsx) */}
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{s.lang === "es" ? "Hola" : "Hi"} {DRIVER.first}</h1>
          </div>
          <div className="flex items-center gap-2">
          {/* #18: pending delivery requests, as a small calendar button with a count (opens Schedule). Kept out of the
              middle of the screen so the next step stays the first thing the driver sees. */}
          {pending > 0 && (
            <button onClick={() => a.push({ name: "requests" })} aria-label={`${pending} ${pending === 1 ? t("request needs your answer") : t("requests need your answer")}`} className="relative grid size-10 place-items-center rounded-full bg-white text-teal-deep">
              <CalendarClock className="size-[18px]" />
              <span className="nums absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{pending}</span>
            </button>
          )}
          {/* #6 Inbox with dispatch. */}
          <button onClick={() => a.push({ name: "inbox" })} aria-label={`${t("Inbox")}, ${fromDispatch} messages`} className="relative grid size-10 place-items-center rounded-full bg-white text-teal-deep">
            <Bell className="size-[18px]" />
            {fromDispatch > 0 && isOn("notifications") && <span className="nums absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{fromDispatch}</span>}
          </button>
          </div>
        </div>
      </div>

      {/* Ready = on duty (#8, #78): one status. While ready, dispatch sees the driver's live location. */}
      {/* The mint header continues behind the whole duty card (no half-cut). */}
      <div className="relative z-[1] bg-[#CFE8E8] px-4 pb-8">
        {/* One row: duty status on the left, day progress (count + bar) on the right. */}
        <div className="flex h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4">
          <button onClick={() => a.push({ name: "tracking" })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            {/* Driver photo with a status dot: green + pulse while on duty, grey when off. */}
            <span className="relative size-10 shrink-0">
              <img src={driverPhoto} alt={DRIVER.name} className="size-10 rounded-full object-cover" />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center" aria-hidden>
                {s.shiftOn && <span className="anim-pulse absolute size-4 rounded-full bg-success" />}
                <span className={cn("relative size-4 rounded-full border-[3px] border-card transition-colors duration-300", s.shiftOn ? "bg-success" : "bg-control")} />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold leading-tight">{s.shiftOn ? t("Ready") : t("Not ready")}</span>
              <span className="block truncate text-[13px] text-muted-foreground">{s.shiftOn ? t("On duty") : t("Off duty")}</span>
            </span>
          </button>
          <div className="w-[128px] shrink-0 text-right text-teal-deep">
            <p className="nums text-[15px] font-semibold leading-snug">
              {delivered === live.length && live.length > 0 ? t("All stops done") : `${delivered} of ${live.length} ${t("delivered")}`}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-teal-soft">
              <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${live.length ? (delivered / live.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Off duty: a "route is ready" panel, full width, tucked into the mint header and down to the tab bar (same as the other cards). */}
      {!s.shiftOn ? (
        <div className="relative z-[2] -mx-px -mt-4 flex w-[calc(100%+2px)] flex-1 flex-col items-center justify-center rounded-t-[28px] border border-b-0 border-border-strong bg-card px-6 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-teal-wash text-teal">
            <Route className="size-7" />
          </span>
          <h2 className="mt-4 text-[22px] font-bold leading-tight tracking-tight">{t("Your route is ready")}</h2>
          <p className="mt-1.5 max-w-[260px] text-[15px] leading-snug text-muted-foreground">{t("Go on duty to see your stops.")}</p>
          <button
            onClick={() => a.openSheet({ name: "startShift" })}
            className="hero-yellow mt-5 h-14 w-full max-w-[280px] rounded-full text-[17px] font-semibold text-teal-deep shadow-card transition active:scale-[0.98]"
          >
            {t("Go on duty")}
          </button>
        </div>
      ) : (
      // The next-stop card runs full width down to the tab bar and tucks 16px into the mint header, so the two touch.
      <div className={cn("relative z-[2] -mt-4 flex flex-1 flex-col space-y-5 px-4", s.pickupDone && !next && "pb-6")}>
        <section className={cn((!s.pickupDone || next) && "-mx-4 flex flex-1 flex-col")}>
          {/* "Your next step" heading hidden for now. */}
          {!s.pickupDone ? <PickupCard /> : next ? <NextStopCard stop={next} /> : <DoneCard />}
        </section>

        {/* Today's route moved to the Route tab (map + timeline together). */}
      </div>
      )}

    </div>
  );
}

/** Step 1 of the day: one kitchen pickup for the whole route. Scanning a packing slip opens that package to check (#9). */
function PickupCard() {
  const { s, a } = useApp();
  const t = useT();
  const route = runStops(s); // this kitchen pickup's packages
  const loaded = route.filter((x) => x.bags.every((b) => s.bagChecks[b.id])).length;
  const cell = (Icon: typeof Clock, label: string, value: ReactNode) => (
    <>
      <dt className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="nums mt-0.5 whitespace-nowrap text-[17px] font-semibold leading-tight text-foreground">{value}</dd>
    </>
  );
  return (
    // Full width down to the tab bar, like the next-stop card; the scan button sits at the bottom.
    <Card className="-mx-px flex !w-[calc(100%+2px)] flex-1 flex-col rounded-b-none rounded-t-[28px] border-b-0 border-border-strong px-5 pb-5 pt-5 shadow-none">
      <div className="text-[20px] font-semibold leading-tight tracking-tight">{s.run > 1 ? t("Back to the kitchen") : t("Pick up at the kitchen")}</div>
      {/* Where → when → progress. Plain label / value pairs on a hairline; "Loaded" counts from 0 and opens the package list. */}
      <dl className="mt-4 grid grid-cols-[1fr_1.3fr_1fr] gap-4 border-t border-border pt-4">
        <div className="min-w-0">{cell(MapPin, t("Dock"), KITCHEN.dock.split(" · ")[1] ?? KITCHEN.dock)}</div>
        <div className="min-w-0">{cell(Clock, t("Ready at"), fmtTime(KITCHEN_READY[s.run] ?? KITCHEN.readyAt))}</div>
        <button onClick={a.openLoad} disabled={!s.shiftOn} aria-label={`${loaded} of ${route.length} packages loaded, continue loading`} className="min-w-0 text-left">
          {cell(
            ClipboardList,
            t("Loaded"),
            <span className="inline-flex items-center gap-0.5">
              <span className={loaded === route.length ? "text-success" : undefined}>{loaded}</span>
              <span className="text-muted-foreground">/{route.length}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>,
          )}
        </button>
      </dl>
      {/* Fills the space above the button: what this step looks like, plus the one-line how-to. */}
      <div className="flex flex-1 flex-col items-center justify-center pb-6 text-center">
        <KitchenPickupScene className="w-full max-w-[300px]" />
        <p className="mt-3 max-w-[260px] text-[13px] leading-snug text-muted-foreground">{t("Scan each package, check what's inside, then load the van.")}</p>
      </div>
      <Button className="sticky bottom-5 w-full" size="lg" disabled={!s.shiftOn} onClick={() => a.push({ name: "scan" })}>
        <QrCode /> {t("Scan packing slip")}
      </Button>
    </Card>
  );
}


function NextStopCard({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[stop.id];
  const kitchenRun = needsKitchenRun(s, stop.id);
  const eta = s.clock + stop.driveMins;
  const late = eta > stop.windowEnd;
  const changed = s.changes[stop.id];
  const pickup = stop.kind === "pickup";

  const f = !kitchenRun && !pickup && isOn("kitchen") ? foodSafety(s, SETTINGS.foodSafetyMins, SETTINGS.foodSafetyWarnMins) : null;
  const here = st.status === "arrived";

  // Kept short: who + where, what kind of work, then one line of timing. The food-safety timer only shows when it needs attention.
  return (
    // Side borders sit 1px off-screen so the top stroke follows the whole corner curve (no tapering "glow").
    <Card className="-mx-px flex !w-[calc(100%+2px)] flex-1 flex-col rounded-b-none rounded-t-[28px] border-b-0 border-border-strong pb-2 shadow-none">
      <button onClick={() => a.push({ name: "stop", id: stop.id })} className="block w-full px-5 pb-3 pt-5 text-left">
        {/* Who, where and what kind of work, grouped in one box so it reads as the stop's identity. */}
        {/* The arrow sits on the card's top row: the whole card (both boxes) opens the stop. */}
        <div className="mb-2.5 flex items-center justify-between px-1">
          <span className="text-[15px] font-extrabold uppercase tracking-wide text-foreground">{t("Where to deliver")}</span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        {/* No box: the stop sits straight on the card, full width. */}
        <div className="pb-1 text-foreground">
          <div className="flex items-center gap-3">
            <StopAvatar stop={stop} className="size-11" />
            <span className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-tight tracking-tight">
              {stop.name}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            {stop.addressLine1}
            {stop.addressLine2 && ` · ${stop.addressLine2}`}
            <br />
            {stop.city}
          </p>
          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <WorkTags stop={stop} variant="plain" />
            {changed && <Badge tone="info">{t("New time")}</Badge>}
          </span>
        </div>
      </button>
      {/* Review Oct 14 2026: the instructions are visible before leaving, not only after arriving. */}
      {/* Parking, Get in, Delivery instructions: icon, bold label, full text; hairlines between.
          The access photo opens in a sheet from a small button, so the card stays short and the main button stays on screen. */}
      {!kitchenRun && (
        <div className="mb-5 mt-1 divide-y divide-black/[0.06] border-y border-border bg-card px-5 text-[13px] leading-[1.4] text-foreground/90">
          {(
            [
              // Individual customers: only their delivery instructions.
              stop.customerType !== "individual" && stop.parking ? (["park", t("Parking"), <Car className="size-[18px]" />, stop.parking, false] as const) : null,
              stop.customerType !== "individual" ? (["in", t("Get in"), <Building2 className="size-[16px]" />, stop.buildingNotes, stop.hasBuildingPhoto] as const) : null,
              ["drop", t("Delivery instructions"), <MessageSquare className="size-[15px]" />, stop.dropoffNotes, false] as const,
            ].filter(Boolean) as (readonly [string, string, ReactNode, string, boolean])[]
          ).map(([key, label, icon, text, photo]) => (
            <div key={key} className="flex items-start gap-2.5 py-3">
              <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center text-teal-deep/70">{icon}</span>
              <div className="min-w-0 flex-1">
                <button onClick={() => a.push({ name: "stop", id: stop.id })} className="block w-full text-left">
                  <span className="block text-[13px] font-bold text-foreground">{label}</span>
                  <span className="mt-0.5 block">{text}</span>
                </button>
                {photo && (
                  // Same small thumbnail as the stop screen; tap for the full-screen photo.
                  <button onClick={() => a.openSheet({ name: "photoFull", id: stop.id })} aria-label="View entrance photo full screen" className="relative mt-2 block w-36 overflow-hidden">
                    <img src={accessPhoto} alt="Building entrance" className="block aspect-[11/6] w-full object-cover" />
                    <span className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-full bg-black/55 text-white">
                      <Maximize2 className="size-3.5" />
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Timing + main button stick to the bottom (just above the tab bar), even when the card is taller than the screen. */}
      <div className="sticky bottom-0 z-10 mt-auto border-t border-border bg-card px-5 pb-3 pt-2.5">
        {/* Timing sits right above the action it's about. */}
      {/* One timing line: time left until the delivery window closes. Green while the drive fits, red when it won't. */}
      <div className="nums mb-2.5 px-1 text-[15px] font-semibold">
        {stop.windowEnd > s.clock ? (
          <>
            <span className="text-muted-foreground">{t("Deliver within")} </span>
            <span className={late && !here ? "text-danger" : "text-success"}>{stop.windowEnd - s.clock} min</span>
          </>
        ) : (
          <span className="text-danger">{t("Window passed")}</span>
        )}
      </div>
      {f && f.level !== "ok" && (
        <p className={cn("nums -mt-2 mb-4 flex items-center gap-1.5 px-1 text-[13px] font-semibold", f.level === "over" ? "text-danger" : "text-warning")}>
          <ThermometerSun className="size-4 shrink-0" />
          {f.level === "over" ? `Loaded ${f.mins} min ago · call dispatch` : `Food-safety limit in ${f.left} min`}
        </p>
      )}
        {kitchenRun ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "pickup", id: stop.id })}>
            <SfkMark className="size-5" /> {t("Back to kitchen to load")}
          </Button>
        ) : st.status === "arrived" && pickup ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "collect", id: stop.id })}>
            <Recycle /> {t("Collect reusables")}
          </Button>
        ) : st.status === "arrived" && isOn("dropoff") && stop.setup?.some((_, i) => !st.setupDone?.[i]) ? (
          // #11: setup first; the dialog unlocks the photo once every step is ticked.
          <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "setup", id: stop.id })}>
            <ClipboardList /> {t("Start setup")}
          </Button>
        ) : st.status === "arrived" ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id: stop.id })}>
            <Camera /> {t("Take delivery photo")}
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => a.startNav(stop.id)}>
            <Navigation /> {st.status === "en_route" ? t("Resume navigation") : t("Start navigation")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function DoneCard() {
  const { a } = useApp();
  const t = useT();
  return (
    <Card className="p-5 text-center">
      <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-success-bg text-2xl">🎉</div>
      <div className="font-semibold">{t("Route complete")}</div>
      <p className="text-[13px] text-muted-foreground">Return totes to the kitchen, then go off duty.</p>
      <Button variant="outline" className="mt-3" onClick={() => a.openSheet({ name: "endShift" })}>
        {t("End duty")}
      </Button>
    </Card>
  );
}

/** Today's route as a timeline: kitchen pickups and stops in order. Shown on the Route tab under the map. */
export function RouteTimeline() {
  const { s, a } = useApp();
  const t = useT();
  const route = useRoute(); // includes cancelled stops, shown struck through
  const next = nextStop(s);
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
                detail={kState === "done" && loadedAt != null ? `Loaded ${fmtTime(loadedAt)}` : run > 1 && kState === "todo" ? `Back to the kitchen · ready ${fmtTime(KITCHEN_READY[run])}` : `Ready ${fmtTime(KITCHEN_READY[run] ?? KITCHEN.readyAt)}`}
                onClick={kState === "current" && s.shiftOn ? a.openLoad : undefined}
                last={false}
              />
            )}
            <StopRow stop={x} current={isLoaded(s, x) && x.id === next?.id} last={i === route.length - 1} />
          </Fragment>
        );
      })}
    </ol>
  );
}

function StopRow({ stop, current, last }: { stop: Stop; current: boolean; last: boolean }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[stop.id];
  const done = st.status === "delivered";
  const cancelled = st.status === "cancelled";
  const eta = s.clock + stop.driveMins;
  const showEta = current && !needsKitchenRun(s, stop.id) && st.status !== "arrived";

  // One tag per row at most, picked by what the driver has to act on first.
  const tag = cancelled ? (
    <Note warn>{t("Cancelled")}</Note>
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
      detail={cancelled ? `Cancelled by dispatch ${fmtTime(st.cancelledAt!)}` : done ? `${stop.kind === "pickup" ? "Collected" : "Delivered"} ${fmtTime(st.deliveredAt!)}` : showEta ? `ETA ${fmtTime(eta)} · by ${fmtTime(stop.windowEnd)}` : fmtWindow(stop.windowStart, stop.windowEnd)}
      detailTone={showEta ? (eta > stop.windowEnd ? "late" : "ontime") : undefined}
      tag={
        cancelled || done ? tag : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <WorkTags stop={stop} variant="plain" />
            {tag}
          </span>
        )
      }
      onClick={() => a.push({ name: "stop", id: stop.id })}
      last={last}
      anchor={`route-${stop.id}`}
    />
  );
}


/**
 * One stop on the route, laid out like a day planner: time rail on the left (dotted progress, "Now" on the
 * current stop), then one soft card per stop with a large name and a single time line.
 * Finished stops fade back and read "Delivered"; address and other detail live on the stop screen.
 */
function TimelineItem({
  state, kind, railTime, title, detail, detailTone, tag, onClick, last, struck, anchor,
}: {
  state: "done" | "current" | "todo"; kind: "kitchen" | "stop"; railTime: number; title: string; detail: string; struck?: boolean;
  detailTone?: "ontime" | "late"; tag?: ReactNode; onClick?: () => void; last: boolean; anchor?: string;
}) {
  const Tag = onClick ? "button" : "div";
  const done = state === "done";
  const current = state === "current";
  const [clock, period] = fmtTime(railTime).split(" ");
  // Plain list row: time on the left, then name + one line of detail; hairline dividers, no colours or rails.
  // The current row is marked by a small "Now" word, not a coloured card.
  return (
    <li id={anchor} className={cn("scroll-mt-3", !last && "border-b border-border")}>
      <Tag onClick={onClick} className={cn("flex w-full items-start gap-3 py-3.5 text-left", onClick && "active:bg-muted/50")}>
        <span className={cn("nums w-12 shrink-0 pt-0.5 leading-tight", done ? "text-muted-foreground" : "text-foreground")}>
          {current ? (
            <span className="block text-[13px] font-bold text-teal">Now</span>
          ) : (
            <>
              <span className="block text-[13px] font-semibold">{clock}</span>
              <span className="block text-[10px] font-semibold text-muted-foreground">{period}</span>
            </>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[16px] font-semibold leading-tight", (done || kind === "kitchen") && "text-muted-foreground", struck && "line-through")}>{title}</span>
          <span className={cn("nums mt-1 block truncate text-[13px]", detailTone === "late" ? "text-danger" : "text-muted-foreground")}>{detail}</span>
          {tag && <span className="mt-1.5 flex">{tag}</span>}
        </span>
        {onClick && <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/60" />}
      </Tag>
    </li>
  );
}

/** Plain-text tag for the route list (no chip colours); problems stay red so they still stand out. */
function Note({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return <span className={cn("text-[13px] font-medium", warn ? "text-danger" : "text-muted-foreground")}>{children}</span>;
}
