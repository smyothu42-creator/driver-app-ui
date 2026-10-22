import { Fragment, type ReactNode } from "react";
import { Bell, Building2, CalendarClock, CalendarDays, Camera, Car, Check, Headphones, MessageSquare, ChevronRight, ClipboardList, Clock, MapPin, Navigation, Package, Phone, Recycle, Route, ScanLine, ThermometerSun } from "lucide-react";
import { isOn, laterFor } from "../data/sprints";
import { foodSafety, isLoaded, legStart, liveRoute, myAssignment, needsKitchenRun, runStops, useApp, nextStop, pickupDelivery, pickupsAt, slipsToday, useRoute, useT } from "../store";
import { DISPATCH, KITCHEN, KITCHEN_READY, DRIVER, SETTINGS, driveBetween, fmtTime, fmtWindow, runOf, windowStatus, workOf, type Stop } from "../data/route";
import { Badge, Button, Card, cn, SegmentBar, SlideToConfirm, STATUS_META, StopAvatar, WorkTags, SfkMark } from "../components/ui";
import { checkedCount, orderSize } from "./Pickup";
import driverPhoto from "../assets/driver-photo.jpg";
import { EntrancePhoto } from "./StopDetail";

/**
 * Today: one clear "next step", then the route. (The Pick up → Deliver → Confirm track is hidden here for now.)
 * Detail like roles, crew, totes and hot/cold lives on the stop screen, not in this list.
 */
export function Today() {
  const { s, a } = useApp();
  const t = useT();
  const live = liveRoute(s);
  const delivered = live.filter((x) => s.stops[x.id].status === "delivered").length;
  // Oct 22 2026: at the kitchen, the duty card counts orders loaded on this pickup instead of deliveries
  // (so the kitchen card no longer needs its own tile). One word for it everywhere: "loaded".
  const atKitchen = s.shiftOn && !s.pickupDone;
  const slips = runStops(s);
  const loadedN = slips.filter((x) => checkedCount(s, x) === x.bags.length).length;
  const [count, of] = atKitchen ? [loadedN, slips.length] : [delivered, live.length];
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
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{s.lang === "es" ? "Hola" : "Hi"} {DRIVER.first}</h1>
          </div>
          {/* Requests (#18) and Inbox (#6) in one white pill, like an iOS toolbar group (Oct 22 2026): two icons, a hairline
              between them, each keeping its own count. The requests half only shows while some wait for an answer. */}
          <div className="flex h-10 items-center rounded-full bg-white text-teal-deep">
            {pending > 0 && (
              <>
                <button onClick={() => a.push({ name: "requests" })} aria-label={`${pending} ${pending === 1 ? t("request needs your answer") : t("requests need your answer")}`} className="relative grid h-10 w-11 place-items-center rounded-l-full active:bg-muted">
                  <CalendarClock className="size-[18px]" />
                  <span className="nums absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{pending}</span>
                </button>
                <span aria-hidden className="h-5 w-px bg-border-strong" />
              </>
            )}
            <button onClick={() => a.push({ name: "inbox" })} aria-label={`${t("Inbox")}, ${fromDispatch} messages`} className={cn("relative grid h-10 w-11 place-items-center active:bg-muted", pending > 0 ? "rounded-r-full" : "rounded-full")}>
              <Bell className="size-[18px]" />
              {fromDispatch > 0 && isOn("notifications") && <span className="nums absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{fromDispatch}</span>}
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
          {/* Sized to the text, so the progress bar is exactly as wide as the label above it. */}
          <div className="shrink-0 text-right text-teal-deep">
            <p className="nums whitespace-nowrap text-[15px] font-semibold leading-snug">
              {atKitchen ? `${loadedN} of ${slips.length} ${t("loaded")}` : delivered === live.length && live.length > 0 ? t("All stops done") : `${delivered} of ${live.length} ${t("delivered")}`}
            </p>
            <SegmentBar done={count} total={of} className="mt-1.5" />
          </div>
        </div>
      </div>

      {/* Off duty: a "route is ready" panel, full width, tucked into the mint header and down to the tab bar (same as the other cards). */}
      {!s.shiftOn ? (
        <div className="relative z-[2] -mx-px -mt-4 flex w-[calc(100%+2px)] flex-1 flex-col items-center justify-center rounded-t-[28px] border border-b-0 border-border-strong bg-card px-6 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-teal-wash text-teal">
            <Route className="size-7" />
          </span>
          <h2 className="mt-4 text-xl font-bold leading-tight tracking-tight">{t("Your route is ready")}</h2>
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
      <div className="relative z-[2] -mt-4 flex flex-1 flex-col space-y-5 px-4">
        <section className="-mx-4 flex flex-1 flex-col">
          {/* "Your next step" heading hidden for now. */}
          {!s.pickupDone ? <PickupCard /> : next ? <NextStopCard stop={next} /> : <DoneCard />}
        </section>

        {/* Today's route moved to the Route tab (map + timeline together). */}
      </div>
      )}

    </div>
  );
}

/** The first sentence of a note, for a one-line preview while driving ("Check in at lobby security with your SFK badge."). */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0];

/**
 * The kitchen's picture: the SFK mark on a dark teal tile, the same square as the client monograms (Oct 22 2026).
 * A photo at this size read as decoration; the mark says "Superfine Kitchen" at a glance. Same tile as the Route map card.
 */
function KitchenAvatar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-[14px] bg-teal-deep text-yellow", className)}>
      <SfkMark className="size-1/2" />
    </span>
  );
}

/**
 * Step 1 of the day: the kitchen pickup. Lists what the driver is picking up (Oct 20 2026): each order with its type,
 * size and hot / cold, opening the same order screen a scan opens. The button scans any of today's slips (#9).
 */
function PickupCard() {
  const { s, a } = useApp();
  const t = useT();
  const route = runStops(s); // this kitchen pickup's orders
  const readyIn = (KITCHEN_READY[s.run] ?? KITCHEN.readyAt) - s.clock; // minutes until the kitchen has this pickup ready
  // Later kitchen pickups today, grouped by run: shown under this one so the driver sees what's coming.
  const laterSlips = slipsToday(s).filter((x) => runOf(x) > s.run);
  const laterRuns = [...new Set(laterSlips.map(runOf))].sort((x, y) => x - y);
  return (
    // Full width down to the tab bar, like the next-stop card; the scan button sits at the bottom.
    <Card className="-mx-px flex !w-[calc(100%+2px)] flex-1 flex-col rounded-b-none rounded-t-[28px] border-b-0 border-border-strong px-5 pb-5 pt-5 shadow-none">
      {/* Same layout as "Where to deliver": label, who + where, then icon rows. */}
      <div className="flex items-center gap-3">
        <KitchenAvatar className="size-11" />
        <span className="min-w-0 flex-1 truncate text-xl font-semibold leading-tight tracking-tight">{KITCHEN.name}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
        {KITCHEN.addressLine1} · {KITCHEN.dock.split(" · ")[1] ?? KITCHEN.dock}
        <br />
        {KITCHEN.city}
      </p>
      {/* Where → when → progress: label / value pairs in a white box with a soft teal outline and a very faint shadow. */}
      {/* Two halves, each centred, with a hairline between them. */}
      <dl className="mb-5 mt-4 grid grid-cols-2 divide-x divide-border rounded-2xl border border-teal/25 bg-card py-4 shadow-[0_1px_6px_rgba(0,64,69,0.05)]">
        {(
          [
            ["dock", MapPin, t("Dock"), KITCHEN.dock.split(" · ")[1] ?? KITCHEN.dock],
            // Oct 22 2026: a countdown ("Ready in 12 min"), not a clock time; "Food ready · Now" once it's time.
            ["ready", Clock, readyIn > 0 ? t("Ready in") : t("Food ready"), readyIn > 0 ? `${readyIn} min` : t("Now")],
          ] as const
        ).map(([key, Icon, label, value]) => (
          <div key={key} className="min-w-0 px-3 text-center">
            <dt className="flex items-center justify-center gap-1 text-[14px] font-medium text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="nums mt-1 whitespace-nowrap text-[20px] font-semibold leading-tight text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {/* What's waiting at the kitchen: one row per order. Tap for what's in it (same screen as scanning its slip). */}
      {/* Schedule-style list: a grey title band, then white rows with hairlines, edge to edge. */}
      <div className="-mx-5 border-b border-border bg-muted/60 px-5 py-2 text-[13px] font-semibold text-muted-foreground">
        {route.length} {route.length === 1 ? t("order to pick up") : t("orders to pick up")}
      </div>
      <ul className="-mx-5 divide-y divide-border border-b border-border bg-white">
        {route.map((x) => {
          const done = checkedCount(s, x);
          const all = done === x.bags.length;
          return (
            <li key={x.id}>
              <button onClick={() => a.push({ name: "package", id: x.id })} disabled={!s.shiftOn} className="flex min-h-[64px] w-full items-center gap-3 px-5 py-2.5 text-left active:bg-muted/60">
                <StopAvatar stop={x} square className="size-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {x.name}
                  </span>
                  <span className="nums block truncate text-[13px] text-muted-foreground">
                    {orderSize(x)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "nums flex items-center gap-1 text-[13px] font-medium",
                      all ? "font-semibold text-success" : s.scanned[x.id] ? "font-semibold text-teal-deep" : "text-muted-foreground",
                    )}
                  >
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
      {/* Next kitchen pickups: same list as this pickup, showing when it's ready instead of a scan status. */}
      {laterRuns.map((r) => {
        const rows = laterSlips.filter((x) => runOf(x) === r);
        const ready = fmtTime(KITCHEN_READY[r] ?? KITCHEN.readyAt);
        return (
          <Fragment key={r}>
            <div className="nums -mx-5 border-b border-border bg-muted/60 px-5 py-2 text-[13px] font-semibold text-muted-foreground">
              {/* Oct 22 2026: named like the Route screen ("Kitchen pickup 2"), so it never reads as a pickup from the customer below it. */}
              {t("Kitchen pickup")} {r} · {ready} · {rows.length} {rows.length === 1 ? t("order") : t("orders")}
            </div>
            <ul className="-mx-5 divide-y divide-border border-b border-border bg-white">
              {rows.map((x) => (
                <li key={x.id}>
                  <button onClick={() => a.openSheet({ name: "laterPickup", id: x.id })} className="flex min-h-[64px] w-full items-center gap-3 px-5 py-2.5 text-left active:bg-muted/60">
                    <StopAvatar stop={x} square className="size-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {x.name}
                      </span>
                      <span className="nums block truncate text-[13px] text-muted-foreground">{orderSize(x)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="nums flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                        <Clock className="size-3.5" /> {ready}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground/60" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Fragment>
        );
      })}
      {/* Back to the kitchen for a later pickup: directions hand off to Google Maps, like any stop. Gone once a slip is scanned. */}
      {/* At the kitchen (Oct 22 2026): the pickup's one action pinned at the bottom, like the next-stop card.
          Scan a slip (any of today's; it opens that order) until every order is loaded, then slide to start the route. */}
      {s.shiftOn && (
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-auto rounded-t-[24px] border-t border-border-strong bg-card px-5 pb-3 pt-3 shadow-[0_-4px_14px_rgba(0,64,69,0.06)]">
          {s.run > 1 && !route.some((x) => s.scanned[x.id]) ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                a.toast("Opening Google Maps…");
                a.push({ name: "navigate", id: "k" });
              }}
            >
              <Navigation /> {t("Navigate to the kitchen")}
            </Button>
          ) : route.every((x) => checkedCount(s, x) === x.bags.length) ? (
            <SlideToConfirm label="Loaded · start route" onConfirm={a.confirmPickup} />
          ) : (
            <Button size="lg" className="w-full" onClick={() => a.push({ name: "scan" })}>
              <ScanLine /> {t("Scan packing slip")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function NextStopCard({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[stop.id];
  const kitchenRun = needsKitchenRun(s, stop.id);
  const drive = driveBetween(legStart(s, stop), stop.id);
  const eta = s.clock + drive.mins;
  const late = eta > stop.windowEnd;
  const changed = s.changes[stop.id];
  const pickup = stop.kind === "pickup";

  const f = SETTINGS.showFoodSafety && !kitchenRun && !pickup && isOn("kitchen") ? foodSafety(s, SETTINGS.foodSafetyMins, SETTINGS.foodSafetyWarnMins) : null;
  const here = st.status === "arrived";

  // Oct 20 2026: no details button. Everything the driver needs for this stop is on this card, in one scroll:
  // who + where, call buttons, how to get in and drop off, then the order itself. Timing + the one action stay pinned.
  return (
    // Side borders sit 1px off-screen so the top stroke follows the whole corner curve (no tapering "glow").
    <Card className="-mx-px flex !w-[calc(100%+2px)] flex-1 flex-col rounded-b-none rounded-t-[28px] border-b-0 border-border-strong pb-2 shadow-none">
      <div className="w-full px-5 pb-3 pt-5 text-left">
        {/* No box: the stop sits straight on the card, full width. */}
        <div className="pb-1 text-foreground">
          <div className="flex items-center gap-3">
            <StopAvatar stop={stop} className="size-11" />
            <span className="min-w-0 flex-1 truncate text-2xl font-bold leading-tight tracking-tight">
              {stop.name}
            </span>
          </div>
          <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
            {stop.addressLine1}
            {stop.addressLine2 && ` · ${stop.addressLine2}`}
            <br />
            {stop.city}
          </p>
          {/* Tags as chips with a soft background: work type, window, and reusables notes. */}
          <span className="mt-3 flex flex-wrap items-center gap-1.5">
            <WorkTags stop={stop} />
            <span className="nums inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-2xs font-semibold text-foreground/80">
              <Clock className="size-3.5 text-teal" strokeWidth={2.2} />
              {fmtWindow(stop.windowStart, stop.windowEnd)}
              {stop.guestReadyTime && ` · set up by ${fmtTime(stop.guestReadyTime)}`}
            </span>
            {/* Reusables pickup: where its window stands (open / closing / missed). */}
            {pickup && isOn("reusables") && (() => {
              const w = windowStatus(stop, s.clock);
              return (
                <span className={cn("nums inline-flex h-6 items-center rounded-full px-2 text-2xs font-semibold", w.state === "missed" ? "bg-danger-bg text-danger" : w.state === "closing" ? "bg-warning-bg text-warning" : "bg-teal-wash text-teal-deep")}>
                  {w.text}
                </span>
              );
            })()}
            {/* A reusables pickup at this address rides along with this delivery. */}
            {!pickup && isOn("reusables") && pickupsAt(s, stop).length > 0 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-teal-soft px-2 text-2xs font-semibold text-teal-deep">
                <Recycle className="size-3.5" strokeWidth={2.2} /> {t("Also pick up reusables")}
              </span>
            )}
            {changed && <Badge tone="info">{t("New time")}</Badge>}
          </span>
          {/* #14: one tap to the customer side or the SFK side, same as the stop screen. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="md" className="gap-1.5" onClick={() => a.openSheet({ name: "people", id: stop.id, who: "customer" })}>
              <Phone /> {t("Customer")}
            </Button>
            <Button variant="outline" size="md" className="gap-1.5" onClick={() => a.openSheet({ name: "people", id: stop.id, who: "sfk" })}>
              <Headphones /> {t("SFK Team")}
            </Button>
          </div>
        </div>
      </div>
      {/* Review Oct 14 2026: the instructions are visible before leaving, not only after arriving. */}
      {/* Parking, Get in, Delivery instructions: icon, bold label, full text; hairlines between.
          Get in is only a one-line preview while driving (too long to read in the car, Oct 22 2026); the full steps and the
          big entrance photo show at the top on arrival. */}
      {/* Arrived (the geofence, in production): Get in is the first thing on the card, big photo and full steps. */}
      {!kitchenRun && here && stop.customerType !== "individual" && (
        <div className="mx-5 mb-3 mt-1 rounded-2xl border border-teal/25 bg-teal-wash/50 p-4">
          <span className="flex items-center gap-2 text-[17px] font-bold text-teal-deep">
            <Building2 className="size-5" /> {t("Get in")}
          </span>
          {stop.hasBuildingPhoto && <EntrancePhoto stop={stop} className="mt-3" />}
          <p className="mt-3 text-[17px] leading-snug text-foreground">{stop.buildingNotes}</p>
        </div>
      )}
      {!kitchenRun && (
        <div className="mb-5 mt-1 divide-y divide-black/[0.06] border-y border-border bg-card px-5 text-[15px] leading-snug text-foreground/80">
          {(
            [
              // Individual customers: only their delivery instructions.
              stop.customerType !== "individual" && stop.parking ? (["park", t("Parking"), <Car className="size-[22px]" />, stop.parking, false] as const) : null,
              // Get in: on the way, one short line (tap for the full note and photo); on arrival it moves up into its own block.
              stop.customerType !== "individual" && !here
                ? ([
                    "in",
                    t("Get in"),
                    <Building2 className="size-[20px]" />,
                    <button onClick={() => a.openSheet({ name: "photo", id: stop.id })} className="block w-full text-left">
                      <span className="block truncate">{firstSentence(stop.buildingNotes)}</span>
                      <span className="mt-0.5 block text-[13px] font-medium text-teal">{t("Full steps when you arrive")} ›</span>
                    </button>,
                    false,
                  ] as const)
                : null,
              ["drop", t("Delivery instructions"), <MessageSquare className="size-[19px]" />, stop.dropoffNotes, false] as const,
              !pickup ? (["order", t("Order"), <Package className="size-[20px]" />, `${stop.orderNo} · ${stop.orderType} · ${orderSize(stop)} · ${stop.packaging}`, false] as const) : null,
              isOn("dropoff") && stop.setup ? (["setup", t("Setup on arrival"), <ClipboardList className="size-[20px]" />, (
                    <ol className="space-y-0.5">
                      {stop.setup.map((x, i) => (
                        // Hanging indent: a wrapped line lines up with the step text, not the number.
                        <li key={i} className="flex gap-1.5">
                          <span className="nums shrink-0">{i + 1}.</span>
                          <span className="min-w-0">{x}</span>
                        </li>
                      ))}
                    </ol>
                  ), false] as const) : null,
            ].filter(Boolean) as (readonly [string, string, ReactNode, ReactNode, boolean])[]
          ).map(([key, label, icon, text, photo]) => (
            <div key={key} className="flex items-start gap-3 py-3.5">
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center text-teal-deep/70">{icon}</span>
              <div className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug text-foreground">{label}</span>
                <div className="mt-0.5 whitespace-pre-line">{text}</div>
                {photo && <EntrancePhoto stop={stop} className="mt-2" />}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Timing + main button stick to the bottom (just above the tab bar), even when the card is taller than the screen. */}
      {/* Pinned bottom box: a clear top stroke and a soft lift so it reads as its own panel over the scrolling card. */}
      <div className="sticky bottom-0 z-10 mt-auto rounded-t-[24px] border-t border-border-strong bg-card px-5 pb-3 pt-3 shadow-[0_-4px_14px_rgba(0,64,69,0.06)]">
        {/* Timing sits right above the action it's about. */}
      {/* One timing line: time left until the delivery window closes. Green while the drive fits, red when it won't. */}
      <div className="nums mb-2.5 px-1 text-[15px] font-semibold">
        {stop.windowEnd > s.clock ? (
          <>
            <span className="text-muted-foreground">{t("Deliver within")} </span>
            <span className={late && !here ? "text-danger" : "text-success"}>{stop.windowEnd - s.clock} min</span>
            {/* Estimated drive from where the driver is (the kitchen or the last stop). */}
            {!here && !kitchenRun && (
              <span className="text-muted-foreground">
                {" "}
                · <Car className="mb-0.5 inline size-4" aria-hidden /> {drive.mins} min drive
              </span>
            )}
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
        ) : st.status === "en_route" ? (
          // Driving with Google Maps: back in the app, the driver slides here once they've arrived.
          <>
            <SlideToConfirm
              label={t("Slide when you arrive")}
              tone="teal"
              onConfirm={() => {
                a.arrive(stop.id, stop.driveMins);
                // Stay on Home: its card switches to the next step (setup, delivery photo or collect reusables).
                a.jump(() => ({ stack: [{ name: "tabs" }], tab: "today" }));
              }}
            />
            <button onClick={() => a.startNav(stop.id)} className="mt-1.5 flex w-full items-center justify-center gap-1.5 py-1.5 text-[15px] font-semibold text-teal">
              <Navigation className="size-4" /> {t("Back to Google Maps")}
            </button>
          </>
        ) : (
          <Button size="lg" className="w-full" onClick={() => a.startNav(stop.id)}>
            <Navigation /> {t("Start navigation")}
          </Button>
        )}
        {/* #21: the problem flow, one tap from Home, once the driver has arrived (not before or while driving). */}
        {!kitchenRun && here && isOn("dropoff") && (
          <button onClick={() => a.push({ name: "problem", id: stop.id })} className="mt-1.5 w-full py-1.5 text-center text-[15px] font-semibold text-danger">
            {t("Something wrong? Report a problem")}
          </button>
        )}
      </div>
    </Card>
  );
}

function DoneCard() {
  const { a } = useApp();
  const t = useT();
  return (
    // Full width down to the tab bar, like the pickup and next-stop cards; content centred in the space.
    <Card className="-mx-px flex !w-[calc(100%+2px)] flex-1 flex-col justify-center rounded-b-none rounded-t-[28px] border-b-0 border-border-strong px-5 py-10 text-center shadow-none">
      <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-success-bg text-2xl">🎉</div>
      <div className="font-semibold">{t("Route complete")}</div>
      <p className="text-[13px] text-muted-foreground">Return totes to the kitchen, then go off duty.</p>
      {/* Call dispatch and End duty side by side, same size. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="w-full" onClick={() => a.toast(`Calling ${DISPATCH.name}…`)}>
          <Headphones /> {t("Call dispatch")}
        </Button>
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "endShift" })}>
          {t("End duty")}
        </Button>
      </div>
      {/* SFK feedback: from here, a look at tomorrow (the Schedule tab lists it first). */}
      <Button variant="ghost" size="md" className="mt-2 w-full" onClick={() => a.setTab("schedule")}>
        <CalendarDays /> {t("Tomorrow's schedule")}
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
                detail={kState === "done" && loadedAt != null ? `Loaded ${fmtTime(loadedAt)}` : `${KITCHEN.dock.split(" · ")[1] ?? KITCHEN.dock} · ready ${fmtTime(KITCHEN_READY[run] ?? KITCHEN.readyAt)}`}
                avatar={<KitchenAvatar className="size-9" />}
                tag={(() => {
                  const n = route.filter((y) => y.kind !== "pickup" && runOf(y) === run && s.stops[y.id].status !== "cancelled").length;
                  // Later pickups: the drive back from the last stop before it.
                  const before = live[live.indexOf(x) - 1];
                  return (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="nums inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                        <ClipboardList className="size-3.5 text-teal" strokeWidth={2.2} />
                        {n} {n === 1 ? t("order") : t("orders")}
                      </span>
                      {before && kState !== "done" && <DriveTag mins={driveBetween(before.id, "k").mins} />}
                    </span>
                  );
                })()}
                onClick={kState === "current" && s.shiftOn ? a.openLoad : undefined}
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

/** Estimated drive into a row, in the same plain style as the hot / cold tags. */
function DriveTag({ mins }: { mins: number }) {
  return (
    <span className="nums inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
      <Car className="size-3.5 text-teal" strokeWidth={2.2} />
      {mins} min drive
    </span>
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
                    : fmtWindow(stop.windowStart, stop.windowEnd)
      }
      detailTone={showEta ? (eta > stop.windowEnd ? "late" : "ontime") : undefined}
      tag={
        cancelled || done ? tag : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* `contents`: hot / cold / reusables flow in the same line as the drive time, so tags fill at most two lines. */}
            {/* A reusables pickup at the same address shows as the same "Reusables" work tag (Oct 22 2026), not a link-like note. */}
            <WorkTags work={rideAlong.length > 0 && !workOf(stop).includes("reusables") ? [...workOf(stop), "reusables"] : workOf(stop)} variant="plain" short className="!contents" />
            {!along && <DriveTag mins={drive} />}
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
  state, railTime, title, detail, detailTone, tag, onClick, first, last, struck, anchor, avatar, alert,
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
        <span className="nums w-[68px] shrink-0 whitespace-nowrap pt-0.5 text-[13px] font-medium leading-tight">
          {current ? <span className="font-bold text-teal">Now</span> : <span className="text-muted-foreground">{fmtTime(railTime)}</span>}
        </span>
        {/* Rail: reaches through the row's padding (and the hairline under it) so the segments join into one line. */}
        <span aria-hidden className="relative -my-3.5 w-6 shrink-0">
          {!first && <span className={cn("absolute left-1/2 top-0 h-[26px] w-0.5 -translate-x-1/2", done || current ? "bg-success" : "bg-border-strong")} />}
          {!last && <span className={cn("absolute -bottom-px left-1/2 top-[26px] w-0.5 -translate-x-1/2", done ? "bg-success" : "bg-border-strong")} />}
          <span
            className={cn(
              "absolute left-1/2 top-[14px] grid size-6 -translate-x-1/2 place-items-center rounded-full",
              alert ? "bg-danger text-white" : done ? "bg-success text-white" : current ? "border-2 border-teal bg-white" : "border-2 border-border-strong bg-white",
            )}
          >
            {alert ? <span className="text-[13px] font-extrabold leading-none">!</span> : done ? <Check className="size-3.5" strokeWidth={3} /> : current && <span className="size-2.5 rounded-full bg-teal" />}
          </span>
        </span>
        {avatar && <span className={cn("shrink-0", done && "opacity-60")}>{avatar}</span>}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px] font-semibold leading-tight", done && "text-muted-foreground", struck && "line-through")}>{title}</span>
          <span className={cn("nums mt-1 block truncate text-[13px]", detailTone === "late" ? "text-danger" : "text-muted-foreground")}>{detail}</span>
          {/* Every row keeps room for two tag lines (empty if nothing to say), so all rows are the same height. */}
          <span className="mt-1.5 flex min-h-[46px] items-start">{tag}</span>
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
