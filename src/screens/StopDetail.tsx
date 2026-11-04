import { PdfPages } from "../components/PdfView";
import { AlertTriangle, Info, ClipboardCheck, ClipboardList, Maximize2, Ban, BadgeCheck, Building2, Camera, Car, Check, CheckCircle2, Clock, FileText, MessageSquare, Navigation, Phone, ChevronRight, Recycle, Timer } from "lucide-react";
import { isOn } from "../data/sprints";
import { crewOn, findStop, isLoaded, myAssignment, needsKitchenRun, pickupDelivery, pickupsAt, useApp, useT, type Screen, type Sheet } from "../store";
import { DISPATCH, fmtTime, fmtWindow, windowStatus, workOf, type Contact, type Stop, type Work } from "../data/route";
import { dishOf, optionsOf, orderSize } from "./Pickup";
import { Download, Headphones, X } from "lucide-react";
import { type Icon, BowlFood as BowlFoodFill, Package as PackageFill, Recycle as RecycleFill, Truck as TruckFill } from "@phosphor-icons/react";
import { ActionBar, Button, Card, cn, IconChip, RoleBadge, SlideToConfirm, TopBar, WorkTags } from "../components/ui";
import { PhotoThumb } from "./Proof";
import accessPhoto from "../assets/access-photo.jpg";
import { Fragment, useRef, useState, type ReactNode } from "react";

type AppState = ReturnType<typeof useApp>["s"];

export function StopDetail({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const [photoOpen, setPhotoOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const cancelled = st.status === "cancelled";
  const change = s.changes[id];
  const onSite = st.status === "arrived" || st.status === "delivered";
  const pickup = stop.kind === "pickup";
  const skipped = cancelled && st.skip?.status === "approved"; // a reusables pickup dispatch agreed to skip
  const jobs = stopJobs(s, stop);
  // Nov 3 2026 (review: "clunky to know how to get to the drop-off and view items"): the whole stop is one scroll, the
  // stage track stuck at the top; tapping a stage scrolls to its card below instead of opening another screen.
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpTo = (key: string) => {
    const el = scrollRef.current;
    const card = el?.querySelector<HTMLElement>(`[data-stage="${key}"]`);
    if (!el) return;
    const top = key === "go" || !card ? 0 : el.scrollTop + card.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={`${pickup ? t("Reusables pickup") : t("Delivery")}${skipped ? " · skipped" : cancelled ? " · cancelled" : ""}`}
        onBack={a.back}
        tone="white"
        // #21: the problem flow, top right of the stop page (Oct 26 2026), away from the main actions at the bottom.
        right={
          isOn("dropoff") && !cancelled && st.status !== "delivered" ? (
            <ProblemLink id={id} />
          ) : st.status === "delivered" && !pickup && isOn("dropoff") ? (
            // Nov 4 2026: a done delivery's proof is one tap away top right (where Report was), shown as a dialog.
            <button onClick={() => setProofOpen(true)} className="mr-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-teal">
              <BadgeCheck className="size-4" /> Proof of delivery
            </button>
          ) : undefined
        }
      />

      {/* Nov 3 2026: the track sits above the scroll, so it never scrolls away. */}
      {jobs.length > 0 && (
        <div className="relative z-10 shrink-0 border-b border-border/60 bg-white px-5 pb-4 pt-3">
          <JobList id={stop.id} jobs={jobs} there={st.status === "arrived" || st.status === "delivered"} onStage={jumpTo} />
        </div>
      )}
      <div ref={scrollRef} className="flex flex-1 flex-col space-y-5 overflow-y-auto overflow-x-hidden">

        {/* Stop identity in one card: who + where, then when + work type. (Map removed Oct 15 2026; navigation has the map.) */}
        <div className="flex flex-1 flex-col overflow-x-clip">
          {/* Stop identity as a full-width white panel. Oct 26 2026: square, no stroke or shadow; it runs to the bottom
              bar so the page reads as one white sheet. */}
          <div className="flex-1 bg-white px-5 text-foreground">
            {/* Oct 26 2026 (review: "too complex, hard to focus"): one clear order. Who and when, where, what to do, then
                how to get in. No avatar, pill or grey box; order facts live on Order details. */}
            <div className="pb-5">
              <div className="h-3" />
              <h1 className="text-2xl font-bold leading-tight tracking-tight">{stop.name}</h1>
              <p className="nums mt-1 flex items-center gap-1.5 text-[17px] font-semibold text-teal-deep">
                <Clock className="size-4" />
                {fmtWindow(stop.windowStart, stop.windowEnd)}
                {stop.guestReadyTime && <span className="font-normal text-muted-foreground">· set up by {fmtTime(stop.guestReadyTime)}</span>}
              </p>
              <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
                {stop.addressLine1}
                {stop.addressLine2 && ` · ${stop.addressLine2}`}
                <br />
                {stop.city}
              </p>
              {/* Nov 4 2026: "Ask dispatch to skip" lives with the stop's name and address (was in the bottom bar /
                  under the reusables list), until a request is sent. */}
              {isOn("reusables") && pickup && !st.skip && st.status !== "delivered" && !cancelled && !pickupDelivery(s, stop) && (
                <Button size="sm" variant="outline" className="mt-3 h-10 gap-1.5 px-4 text-[15px]" onClick={() => a.openSheet({ name: "skip", id })}>
                  {/* Nov 4 2026: said the way a driver thinks of it: they can't do this pickup today, so they ask dispatch. */}
                  <Ban /> Can't pick up?
                </Button>
              )}
              {/* What to do here. Review Oct 14 2026: work type on every stop. */}
              {/* Oct 26 2026: the "Use SFK Van" note (#79) removed from the stop page; the van shows on Order details. */}
              {jobs.length === 0 && (
                <div className="mt-4">
                  <WorkTags stop={stop} variant="plain" />
                </div>
              )}
            </div>
            {/* Dispatch changes and problems sit with the stop, above the instructions. */}
            {(cancelled && !skipped) || (change && !cancelled) || st.officeOverride || st.issue ? (
              <div className="space-y-3 pb-4 [&>*]:!mx-0">
              {/* #15 / #31: cancellations and time changes from dispatch. */}
              {/* A skipped pickup says so in its own status box below, not as a cancellation. */}
              {cancelled && !skipped && (
                <div className="mx-4 flex gap-3 rounded-2xl border-2 border-danger-border bg-danger-bg p-4 text-danger">
                  <Ban className="mt-0.5 size-5 shrink-0" />
                  <span className="text-[15px]">
                    <b className="font-bold">Cancelled by dispatch at {fmtTime(st.cancelledAt!)}.</b>{" "}
                    {s.pickupDone ? "Don't deliver. Keep the food in the vehicle and bring it back to the kitchen." : "Don't load it. It's off your checklist."}
                  </span>
                </div>
              )}
              {change && !cancelled && (
                <div className="mx-4 flex gap-3 rounded-2xl border border-info-border bg-info-bg p-4 text-info">
                  <Clock className="mt-0.5 size-5 shrink-0" />
                  <span className="nums text-[15px]">
                    <b className="font-bold">New time: {fmtWindow(change.windowStart, change.windowEnd)}</b>
                    <span className="block text-[13px] line-through opacity-70">Was {fmtWindow(change.prevStart, change.prevEnd)}</span>
                  </span>
                </div>
              )}
              {st.officeOverride && (
                <div className="mx-4 flex gap-2.5 rounded-xl border border-border bg-muted p-3 text-[13px]">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-teal" />
                  <span>
                    <b className="font-semibold">Marked delivered at the SFK office</b> for a driver without the app.
                  </span>
                </div>
              )}
              {st.issue && (
                <div className="mx-4 flex gap-2.5 rounded-xl border border-danger-border bg-danger-bg p-3 text-[13px] text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <b className="font-semibold">{st.issue}.</b> {st.issuePhotos ? `${st.issuePhotos} ${st.issuePhotos === 1 ? "photo" : "photos"} sent. ` : ""}Dispatch can see this on the order.
                  </span>
                </div>
              )}
              </div>
            ) : null}
            {/* Oct 27 2026: one light divider above the instructions (the card's own top line), not two stacked. */}
            {/* Review Oct 14 2026: instructions come first, before departure, on the way and on arrival.
                Oct 26 2026: in the same white panel as the stop, just a divider above (no separate card). */}
            {!cancelled && <StopInstructions stop={stop} arrived={st.status === "arrived"} embedded />}
            {/* Nov 3 2026: what to drop off, set up and collect, in the track's order, on this same page. */}
            <StageCards stop={stop} />
          </div>

        </div>


        {/* Reusables pickup: its window, what to collect and any skip request now sit in the white page (PickupStage). */}

        {isOn("team") && <TeamCard stopId={id} onSite={onSite} />}

        {/* Nov 4 2026: the proof isn't on the page any more; it opens as a dialog from "Proof of delivery" top right. */}
        {st.status === "delivered" && !pickup && !isOn("dropoff") && (
          <div className="mx-4 flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
            <CheckCircle2 className="size-4" /> Delivered {fmtTime(st.deliveredAt!)}
          </div>
        )}
        {st.status === "delivered" && pickup && (
          <div className="mx-4 flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
            <CheckCircle2 className="size-4" /> {st.collectResult === "not_collected" ? `Not collected · ${fmtTime(st.deliveredAt!)}` : `Collected ${fmtTime(st.deliveredAt!)} · ${st.collectPhotos} ${st.collectPhotos === 1 ? "photo" : "photos"}`}
          </div>
        )}

        {/* #2 site + backup contacts live in the "Customer" sheet (button at the top). */}


        {/* Bottom breathing room when the instructions panel isn't the last, full-height block. */}
        {cancelled && <div className="h-1 shrink-0" aria-hidden />}
      </div>

      <StopActions stop={stop} />

      {proofOpen && (
        <div className="anim-fade absolute inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={() => setProofOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Proof of delivery" className="anim-alert max-h-[85%] w-full overflow-y-auto rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <ProofCard stop={stop} onOpen={() => setPhotoOpen(true)} onClose={() => setProofOpen(false)} />
          </div>
        </div>
      )}

      {photoOpen && (
        <div className="anim-fade absolute inset-0 z-50 flex flex-col bg-black" onClick={() => setPhotoOpen(false)}>
          <div className="relative mx-auto mt-14 aspect-[3/4] w-full max-w-[360px]">
            <PhotoThumb door={stop.customerType === "individual"} shot={0} />
          </div>
          <div className="flex-1" />
          <p className="p-4 pb-10 text-center text-[15px] text-white">Tap to close</p>
        </div>
      )}
    </div>
  );
}

/** US-814/815: the driver's role on this stop and who else is assigned. */
function TeamCard({ stopId, onSite }: { stopId: string; onSite: boolean }) {
  const { s, a } = useApp();
  const lead = myAssignment(s, stopId)?.role === "Lead Event Staff";
  const mine = myAssignment(s, stopId);
  const crew = crewOn(s, stopId);

  if (!mine)
    return (
      <div className="mx-4 flex gap-2.5 rounded-xl border border-warning-border bg-warning-bg p-3 text-[13px] text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          <b className="font-semibold">You're no longer on this stop.</b> Dispatch reassigned it. Call dispatch if that's unexpected.
        </span>
      </div>
    );
  // Legacy single-driver assignment with no role: nothing to add, so the screen looks exactly as before.
  if (!mine.role && crew.length === 0) return null;

  return (
    <div className="px-4">
      <Card className="divide-y divide-border border-border-strong">
        {mine.role && (
          <div className="flex items-center gap-3 p-4">
            <IconChip>
              <BadgeCheck />
            </IconChip>
            <div className="text-[15px]">
              Your role: <b className="font-semibold">{mine.role}</b>
            </div>
          </div>
        )}
        {crew.length > 0 && (
          <div className="p-4">
            <div className="text-overline mb-2">Also on this stop</div>
            <ul className="space-y-2">
              {crew.map((c) => (
                <li key={c.userId} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-soft text-2xs font-bold text-teal-deep">{c.staff.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c.staff.name}</span>
                    {lead && s.attendance[stopId]?.[c.userId] && (
                      <span className="nums block text-2xs text-muted-foreground">
                        In {fmtTime(s.attendance[stopId][c.userId].in!)}
                        {s.attendance[stopId][c.userId].out != null && ` · out ${fmtTime(s.attendance[stopId][c.userId].out!)}`}
                      </span>
                    )}
                  </span>
                  {/* #65 nice-to-have: the lead logs who was there and for how long. */}
                  {lead && onSite && s.attendance[stopId]?.[c.userId]?.out == null ? (
                    <Button size="sm" variant="outline" onClick={() => a.markStaff(stopId, c.userId)}>
                      {s.attendance[stopId]?.[c.userId]?.in != null ? "Mark out" : "Mark in"}
                    </Button>
                  ) : (
                    <RoleBadge role={c.role} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Oct 26 2026: messaging and calling sit together at the bottom, next to the main action (like the reference's
 * "Chat with support" + call). On the way, Google Maps is a round button here too.
 */
function HelpRow({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const enRoute = s.stops[stop.id].status === "en_route";
  // Oct 26 2026: quiet text links next to the main action (message, call, Google Maps on the way), so only one big button.
  // Nov 4 2026 (review: "should these be above the big orange one so they don't get accidentally hit?"): they sit above
  // the main button now, so the big button is the last thing by the thumb and the home bar, and a tap that lands
  // low never calls or messages someone by mistake.
  const link = "flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-semibold text-teal-deep";
  return (
    <div className="-mt-1 flex items-center justify-center gap-2">
      <button className={link} onClick={() => a.openSheet({ name: "people", id: stop.id, who: "all" })}>
        <Phone className="size-4" /> Call
      </button>
      <span aria-hidden className="h-4 w-px bg-border-strong" />
      <button className={link} onClick={() => a.push({ name: "inbox" })}>
        <MessageSquare className="size-4" /> Message
      </button>
      {enRoute && (
        <>
          <span aria-hidden className="h-4 w-px bg-border-strong" />
          <button className={link} onClick={() => a.startNav(stop.id)}>
            <Navigation className="size-4" /> Maps
          </button>
        </>
      )}
    </div>
  );
}

export function ContactRow({ c, tag }: { c: Contact; tag: string }) {
  const { a } = useApp();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-muted-foreground">{tag}</span>
        <span className="block truncate text-[15px] font-semibold">{c.name}</span>
        <span className="block truncate text-[15px] text-muted-foreground">{c.role}</span>
      </span>
      <button onClick={() => a.toast(`Calling ${c.name}…`)} aria-label={`Call ${c.name}`} className="grid size-12 shrink-0 place-items-center rounded-full bg-teal text-white active:scale-95">
        <Phone className="size-5" />
      </button>
    </div>
  );
}

/** What was logged at the drop (#4, #12, #13, #75). */
function ProofCard({ stop, onOpen, onClose }: { stop: Stop; onOpen: () => void; onClose?: () => void }) {
  const { s } = useApp();
  const st = s.stops[stop.id];
  const onTime = st.deliveredAt! <= stop.windowEnd;
  const door = stop.customerType === "individual";
  // Label / value rows on hairlines, like the rest of the app; status in words + colour, no chips.
  const rows: [string, ReactNode][] = [
    ["Handed off", st.handoff === "handed" ? `To ${st.receivedBy || "recipient"}` : "Left at drop-off"],
    ...(st.delayReason ? ([["Delay reason", st.delayReason]] as [string, ReactNode][]) : []),
    ...(st.notes ? ([["Note", `“${st.notes}”`]] as [string, ReactNode][]) : []),
    ...(!st.officeOverride
      ? ([
          [
            "Location",
            <span key="loc" className={st.deliveredAway ? "font-semibold text-warning" : undefined}>
              {st.deliveredAway ? "Away from the address · dispatch flagged" : "At the address"}
              <span className="nums block text-[13px] font-normal text-muted-foreground">
                {(stop.at[1] + (st.deliveredAway ? 0.006 : 0)).toFixed(5)}, {stop.at[0].toFixed(5)}
              </span>
            </span>,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(st.setupEndAt || st.serviceEndAt ? ([["Setup / service", `${st.setupEndAt ? fmtTime(st.setupEndAt) : "—"} / ${st.serviceEndAt ? fmtTime(st.serviceEndAt) : "—"}`]] as [string, ReactNode][]) : []),
  ];
  return (
    <section className={onClose ? undefined : "px-4"}>
      <Card className={cn("overflow-hidden border-border-strong", onClose && "rounded-3xl border-0 shadow-raised")}>
        <div className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
            <BadgeCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="nums text-[17px] font-semibold leading-tight">Delivered {fmtTime(st.deliveredAt!)}</div>
            <div className={cn("text-[13px] font-semibold", onTime ? "text-success" : "text-warning")}>{onTime ? "On time" : `Delayed · ${st.deliveredAt! - stop.windowEnd} min late`}</div>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground/70">
              <X className="size-5" />
            </button>
          )}
        </div>
        {!st.officeOverride && st.photos > 0 && (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {Array.from({ length: st.photos }).map((_, i) => (
              <button key={i} onClick={onOpen} aria-label={`View photo ${i + 1}`} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
                <PhotoThumb door={door} shot={i} />
              </button>
            ))}
          </div>
        )}
        <dl className="divide-y divide-border border-t border-border text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3">
              <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 flex-1 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

function StopActions({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[stop.id];

  if (st.status === "cancelled")
    return (
      <ActionBar>
        <Button size="lg" variant="outline" className="w-full" onClick={() => a.setTab("map")}>
          {t("Back to route")}
        </Button>
      </ActionBar>
    );
  // #12: setup + serve stops log setup end and service end after "Delivered", each one tap.
  if (isOn("dropoff") && st.status === "delivered" && stop.serve && !st.officeOverride && !st.serviceEndAt) {
    return (
      <ActionBar>
        {!st.setupEndAt ? (
          <Button size="lg" className="w-full" onClick={() => a.markSetupDone(stop.id)}>
            <Check /> {t("Mark setup done")}
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => a.endService(stop.id)}>
            <Timer /> {t("End service")}
          </Button>
        )}
        <p className="nums text-center text-2xs text-muted-foreground">
          {st.setupEndAt ? `Setup done ${fmtTime(st.setupEndAt)} · tap when guests are served and you leave` : `Delivered ${fmtTime(st.deliveredAt!)} · tap when the table is set`}
        </p>
      </ActionBar>
    );
  }
  // Delivered: nothing left to do here, so no bottom button.
  if (st.status === "delivered") return null;
  if (needsKitchenRun(s, stop.id)) {
    // Claimed after the main pickup (step 4): load it before driving to the customer.
    return (
      <ActionBar>
        {/* Nov 4 2026 (review: "don't need this page at all"): no separate "Load stop N" page; the driver picks the
            order up at the kitchen and slides here, which puts it in the vehicle and starts the drive. */}
        <SlideToConfirm label="Slide when it's loaded at the kitchen" onConfirm={() => a.confirmClaimPickup(stop.id)} />
      </ActionBar>
    );
  }
  if (!isLoaded(s, stop)) {
    return (
      <ActionBar>
        {/* Information, not an action: the kitchen load starts from the Route tab. */}
        <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
          <Info className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-[15px] leading-snug">
            <span className="font-bold">{t("Not loaded yet")}</span>
            <span className="block text-muted-foreground">{t("Load this order at the kitchen before you go.")}</span>
          </p>
        </div>
      </ActionBar>
    );
  }
  if (st.status === "arrived" && stop.kind === "pickup") {
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        {/* Nov 4 2026: the same Collect reusables sheet as on a delivery (was its own page). */}
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "collect", id: stop.id, at: stop.id })}>
          <Recycle /> {t("Collect reusables")}
        </Button>
      </ActionBar>
    );
  }
  // Nov 3 2026: first the drop-off (how it's left + the order list to show the receiver); then setup (if any), then the photo.
  const dropLeft = isOn("dropoff") && stop.bags.some((b) => !st.dropDone?.[b.id]);
  if (st.status === "arrived" && dropLeft) {
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "dropCheck", id: stop.id })}>
          <ClipboardCheck /> {t("Drop off order")}
        </Button>
      </ActionBar>
    );
  }
  // #11: a stop with setup steps opens the setup checklist first; its dialog unlocks the photo once every step is ticked.
  const setupLeft = isOn("dropoff") && stop.setup ? stop.setup.some((_, i) => !st.setupDone?.[i]) : false;
  if (st.status === "arrived" && setupLeft) {
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "setup", id: stop.id })}>
          <ClipboardList /> {t("Start setup")}
        </Button>
      </ActionBar>
    );
  }
  // Oct 26 2026: then reusables (a bottom sheet), then the delivery photo, then Proof of delivery.
  const toCollect = collectLeft(s, stop);
  if (st.status === "arrived" && toCollect.length > 0) {
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "collect", id: toCollect[0], at: stop.id })}>
          <Recycle /> {t("Collect reusables")}
        </Button>
      </ActionBar>
    );
  }
  if (st.status === "arrived") {
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id: stop.id })}>
          <Camera /> {t("Take delivery photo")}
        </Button>
      </ActionBar>
    );
  }
  // A pickup riding along with a delivery isn't driven to on its own: it's counted on that delivery's screen.
  const along = isOn("reusables") ? pickupDelivery(s, stop) : undefined;
  if (along)
    return (
      <ActionBar>
        <Button size="lg" className="w-full" onClick={() => a.jump((p) => ({ stack: [...p.stack.filter((x) => !(x.name === "stop" && x.id === stop.id)), { name: "stop" as const, id: along.id }] }))}>
          <Recycle /> Go to {along.name} delivery
        </Button>
      </ActionBar>
    );
  // Oct 26 2026: this page (not Home) is where the driver comes back from Google Maps, so it has the same
  // "Slide when you arrive" Home had, with Google Maps one tap away.
  if (st.status === "en_route")
    return (
      <ActionBar>
        <HelpRow stop={stop} />
        <SlideToConfirm label={t("Slide when you arrive")} tone="teal" onConfirm={() => a.arrive(stop.id, stop.driveMins)} />
      </ActionBar>
    );
  return (
    <ActionBar>
      <HelpRow stop={stop} />
      <Button size="lg" className="w-full" onClick={() => a.startNav(stop.id)}>
        <Navigation /> {t("Start navigation")}
      </Button>
    </ActionBar>
  );
}


/**
 * Reusables pickup, as one stage section of the white page (Nov 4 2026, review: "out of the theme and looks complex"):
 * the same band, big icon and title as Drop off / Set up, the window as the line under the title (amber when closing,
 * red when missed), the reusables as edge-to-edge rows, then the packing list and the skip link as quiet rows.
 * Riding along with a delivery or a skip request show as one plain note under the title.
 */
function PickupStage({ stop }: { stop: Stop }) {
  const { s } = useApp();
  const st = s.stops[stop.id];
  const done = st.status === "delivered" || st.status === "cancelled";
  const w = windowStatus(stop, s.clock);
  const along = pickupDelivery(s, stop);
  const items = stop.reusables ?? [];
  return (
    <StageCard
      stage="collect"
      icon={RecycleFill}
      title="Collect reusables"
      action={<PackingListButton id={stop.id} />}
      done={st.status === "delivered"}
      status={st.status === "delivered" ? "Done" : ""}
      sub={
        <span className={cn("nums", !done && w.state === "missed" ? "font-semibold text-danger" : !done && w.state === "closing" ? "font-semibold text-warning" : undefined)}>
          Pickup window {fmtWindow(stop.windowStart, stop.windowEnd)}
          {!done && w.state !== "upcoming" && ` · ${w.text}`}
        </span>
      }
    >
      {(along || st.skip) && (
        <p className={cn("my-3 pl-[80px] pr-5 text-[15px] leading-snug", st.skip?.status === "declined" ? "text-warning" : "text-muted-foreground")}>
          {st.skip ? (
            <>
              <b className="font-semibold text-foreground">
                {st.skip.status === "pending" ? "Skip requested · waiting for dispatch" : st.skip.status === "approved" ? `Skipped · approved by dispatch ${fmtTime(st.skip.decidedAt!)}` : "Dispatch needs this pickup today"}
              </b>
              {" · "}
              {st.skip.reason}
              {st.skip.status === "pending" && ". Keep it on your route until they reply."}
            </>
          ) : (
            <>
              <b className="font-semibold text-foreground">Pick up during your delivery to {along!.name}</b> · same address, stop {along!.seq}. Count it there with the delivery.
            </>
          )}
        </p>
      )}
      <ItemList>
        {items.map((x) => (
          <ItemRow key={x.id} on={st.status === "delivered"} count={x.expected} label={x.label} />
        ))}
      </ItemList>
      <div className="h-4" />
    </StageCard>
  );
}

/**
 * Review Oct 14 2026: the instructions in the order the driver needs them: park → get in → drop off
 * (→ set up → collect reusables). White rows are saved for the address; the yellow row is this order only.
 * Shown before departure, on the way (sheet from navigation) and on arrival, where a last "Finish" step
 * points at the button so the next action is never a guess.
 */
/** The building entrance photo, full width so it can be read at a glance (Oct 22 2026). Tap: full screen. */
export function EntrancePhoto({ stop, className }: { stop: Stop; className?: string }) {
  const { a } = useApp();
  return (
    // Oct 26 2026: a small preview so it doesn't push the instructions below off screen; tap for full screen.
    <button onClick={() => a.openSheet({ name: "photoFull", id: stop.id })} aria-label="View entrance photo full screen" className={cn("relative block w-44 overflow-hidden rounded-xl active:scale-[0.99]", className)}>
      <img src={accessPhoto} alt={`Entrance at ${stop.addressLine1}`} className="block aspect-[16/10] w-full object-cover" />
      <span className="absolute bottom-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
        <Maximize2 className="size-3.5" />
      </span>
    </button>
  );
}

/** Reusables still to collect at this delivery: its own, then any pickups riding along (Oct 26 2026). */
export const collectLeft = (s: AppState, stop: Stop) =>
  isOn("reusables") && stop.kind !== "pickup"
    ? [...(stop.reusables && !s.stops[stop.id].collectResult ? [stop.id] : []), ...pickupsAt(s, stop).filter((x) => s.stops[x.id].status !== "delivered").map((x) => x.id)]
    : [];

type Job = { key: string; title: string; work?: Work[]; detail?: string; meta?: string; checked?: boolean; done: boolean; action: string; open: Screen; sheet?: Sheet };

/**
 * Everything the driver does at this address, each with the screen that does it: the drop-off (Order details, the same
 * screen a packing-slip scan opens), the setup checklist when the order has one, then reusables with it and any
 * pickups riding along (Reusable pickup).
 * A reusables-only pickup has just its pickup.
 */
export function stopJobs(s: AppState, stop: Stop): Job[] {
  const st = s.stops[stop.id];
  const jobs: Job[] = [];
  if (st.status === "cancelled") return jobs;
  if (stop.kind === "pickup") {
    if (isOn("reusables")) jobs.push({ key: "collect", title: "Collect reusables", detail: itemsText(stop), done: st.status === "delivered", action: "Reusable pickup", open: { name: "collect", id: stop.id } });
    return jobs;
  }
  // Oct 26 2026: once arrived, the drop-off opens its item check (until every item is ticked).
  const dropLeft = isOn("dropoff") && stop.bags.some((b) => !st.dropDone?.[b.id]);
  jobs.push({ key: "drop", title: "Drop off order", work: workOf(stop).filter((w) => w !== "reusables"), detail: `${orderSize(stop)} · ${stop.orderType}`, checked: !dropLeft, done: st.status === "delivered", action: "Order details", open: { name: "package", id: stop.id }, sheet: st.status === "arrived" && dropLeft ? { name: "dropCheck", id: stop.id } : undefined });
  // Oct 26 2026: setup is its own step. Its checklist opens once arrived; before that the row shows the order.
  if (isOn("dropoff") && stop.setup) {
    const ticked = stop.setup.filter((_, i) => st.setupDone?.[i]).length;
    const arrived = st.status === "arrived";
    jobs.push({ key: "setup", title: "Set up", meta: ticked > 0 ? `${ticked} of ${stop.setup.length}` : `${stop.setup.length} steps`, done: ticked === stop.setup.length || !!st.setupEndAt, action: "Setup", open: { name: "package", id: stop.id }, sheet: arrived ? (dropLeft ? { name: "dropCheck", id: stop.id } : { name: "setup", id: stop.id }) : undefined });
  }
  if (isOn("reusables")) {
    // Once arrived, collecting opens the bottom sheet (part of the delivery steps), not the full screen.
    const here = st.status === "arrived";
    if (stop.reusables) jobs.push({ key: "collect", title: "Collect reusables", detail: itemsText(stop), done: !!st.collectResult, action: "Reusable pickup", open: { name: "collect", id: stop.id }, sheet: here ? { name: "collect", id: stop.id, at: stop.id } : undefined });
    for (const x of pickupsAt(s, stop)) jobs.push({ key: x.id, title: "Collect reusables", detail: `${itemsText(x)} · ${x.orderNo}`, done: s.stops[x.id].status === "delivered", action: "Reusable pickup", open: { name: "collect", id: x.id }, sheet: here ? { name: "collect", id: x.id, at: stop.id } : undefined });
  }
  return jobs;
}

/** "3 empty reusable totes, 2 tray lids": what a reusables job is, from its packing list. */
const itemsText = (stop: Stop) => (stop.reusables ?? []).map((x) => `${x.expected} ${x.label.toLowerCase().replace(/^empty |reusable /g, "")}`).join(", ");

/**
 * Oct 26 2026: what to do at this stop, one row per job, each with its own button (Order details / Reusable pickup),
 * the page's main buttons. More than one job is numbered under "N things to do here" in a teal box, so the reusables
 * pickup is very hard to miss. The buttons sit on the rows (no separate button row), which keeps Parking, Get in and
 * Delivery instructions on screen. Each job ticks off once it's done. Used on the stop page and Home.
 */
export function JobList({ id, jobs, footer, there, onStage }: { id: string; jobs: Job[]; footer?: ReactNode; there?: boolean; onStage?: (key: string) => void }) {
  const { a } = useApp();
  // Oct 26 2026 (review: drivers only glance): no box and no job rows, just the stop's stages as a trip-style track:
  // Go to place → Drop off → Set up → Collect. Tap a stage for its screen.
  const drop = jobs.find((j) => j.key === "drop");
  const setup = jobs.find((j) => j.key === "setup");
  const collectJobs = jobs.filter((j) => j !== drop && j !== setup);
  const go = (list: Job[]) => {
    const j = list.find((x) => !x.done) ?? list[0];
    if (j.sheet) a.openSheet(j.sheet);
    else a.push(j.open);
  };
  const stages = [
    { key: "go", label: "Go to place", icon: TruckFill, done: !!there, open: () => a.openSheet({ name: "maps", id }) },
    // Drop off is done once every item is ticked off (or the stop is delivered); set up once its checklist is.
    ...(drop ? [{ key: "drop", label: "Drop off", icon: PackageFill, done: !!drop.checked || drop.done, open: () => go([drop]) }] : []),
    ...(setup ? [{ key: "setup", label: "Set up", icon: BowlFoodFill, done: setup.done, open: () => go([setup]) }] : []),
    ...(collectJobs.length ? [{ key: "collect", label: "Collect", icon: RecycleFill, done: collectJobs.every((j) => j.done), open: () => go(collectJobs) }] : []),
  ];
  // Nov 3 2026: on the stop page a stage tap scrolls to its card on the same page instead of opening another screen.
  const track = onStage ? stages.map((x) => ({ ...x, open: () => onStage(x.key) })) : stages;
  return (
    <section>
      <StageTrack stages={track} />
      {footer && <div className="mt-4 overflow-hidden rounded-xl">{footer}</div>}
    </section>
  );
}

/** One step of a stage track: a solid (Phosphor) icon, a short label, done or not, and what tapping it opens. */
export type Stage = { key: string; label: string; icon: Icon; done: boolean; open?: () => void };

/**
 * Oct 26 2026: the trip-style progress bar (stop page, Proof of delivery, Kitchen pickup): a full-width thin line with
 * each stage's icon on it and its label below. The first not-done stage is "now".
 */
export function StageTrack({ stages }: { stages: Stage[] }) {
  const current = stages.findIndex((x) => !x.done);
  // Oct 26 2026: a thin trip line with each stage's small icon on it (van, box, reusables), the icon centred over its
  // label and short fact. The line fills teal up to the stage the driver is on now; that icon is dark teal, done ones
  // teal, the rest grey.
  return (
    <div>
      {/* The line runs the full width: first icon at the left edge, last at the right, the line touching each one. */}
      <div className="flex items-center">
        {stages.map((x, i) => (
          <Fragment key={x.key}>
            {i > 0 && <span className={cn("mx-1 h-0.5 flex-1", x.done || i === current ? "bg-teal" : "bg-border-strong")} />}
            <button onClick={x.open} aria-label={x.label} className="-m-3 shrink-0 p-3 active:opacity-70">
              {/* Solid (Phosphor "fill") icons, like a trip tracker; colour alone shows done / now / ahead. */}
              <x.icon className={cn("size-5", i === current ? "text-teal-deep" : x.done ? "text-teal" : "text-muted-foreground/60")} weight="fill" />
            </button>
          </Fragment>
        ))}
      </div>
      {/* Labels under the line: first at the left edge, last at the right, the ones between centred under their icons. */}
      <div className="relative -mb-4 mt-1.5 h-11 whitespace-nowrap text-[13px] leading-tight">
        {stages.map((x, i) => {
          const at = (i / (stages.length - 1)) * 100;
          return (
            <button
              key={x.key}
              onClick={x.open}
              style={i === 0 ? { left: 0 } : i === stages.length - 1 ? { right: 0 } : { left: `${at}%` }}
              className={cn("absolute top-0 flex h-11 items-start active:opacity-70", i > 0 && i < stages.length - 1 && "-translate-x-1/2", i === current ? "font-bold text-teal-deep" : "font-semibold text-muted-foreground")}
            >
              {x.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Nov 4 2026: on the stop page (embedded) a soft 8px grey band divides the address from the instructions below it.
export function StopInstructions({ stop, arrived, bleed, plain, embedded }: { stop: Stop; arrived: boolean; bleed?: boolean; plain?: boolean; embedded?: boolean }) {
  const t = useT();
  const { a } = useApp();
  const pickup = stop.kind === "pickup";
  // Individual customers: just their delivery instructions (no parking / building access rows).
  const person = stop.customerType === "individual";
  // Oct 27 2026: with a Delivery details PDF, parking, getting in and the delivery instructions are in it, so those
  // rows aren't repeated here.
  const pdf = !!stop.detailsPdf;
  const rows: { key: string; icon: ReactNode; label: string; body: ReactNode; note?: string; order?: boolean; flow?: string }[] = [];
  if (!pdf && !person && stop.parking) rows.push({ key: "park", icon: <Car />, label: t("Parking"), body: stop.parking, flow: "address" });
  // Oct 27 2026: a row with nothing to say isn't shown (no empty Get in or Delivery instructions).
  if (!pdf && !person && (stop.buildingNotes || stop.hasBuildingPhoto)) rows.push({
    key: "access",
    icon: <Building2 />,
    label: "Get in",
    flow: stop.parking ? undefined : "address",
    body: (
      <>
        {stop.buildingNotes}
        {/* Oct 26 2026: the big entrance photo only once arrived (when it's needed); before that, a link to it, so
            Parking, Get in and Delivery instructions all fit on screen. */}
        {stop.hasBuildingPhoto &&
          (arrived ? (
            <EntrancePhoto stop={stop} className="mt-2" />
          ) : (
            <button onClick={() => a.openSheet({ name: "photoFull", id: stop.id })} className="-my-2 flex min-h-11 items-center gap-1 text-[15px] font-semibold text-teal">
              <Camera className="size-4" /> Entrance photo <ChevronRight className="size-4" />
            </button>
          ))}
      </>
    ),
  });
  if (!pdf && stop.dropoffNotes) rows.push({
    key: "drop",
    icon: <MessageSquare />,
    label: pickup ? "Find the items" : t("Delivery instructions"),
    body: stop.dropoffNotes,
    order: true,
    flow: "instructions",
  });
  // "Also collect" (reusables with a delivery) waits for the Reusable pickup sprint. Oct 26 2026: only in the
  // instructions sheet from navigation; the stop page says it once at the top ("2 jobs") and once as Job 2's card.
  if (isOn("reusables") && !pickup && stop.reusables && plain) rows.push({ key: "collect", icon: <Recycle />, label: "Also collect", body: stop.returns });
  // The last step (photo) is the button at the bottom, so it isn't repeated here.

  // One quiet row per step: icon, a short label, then the text. Oct 26 2026: the icon stays after arriving (no step numbers).
  // Oct 26 2026: no yellow highlight on the order-only note; "From <name>" says it's for this order.
  return (
    <Card className={cn("overflow-hidden border-border-strong", bleed && "-mx-px !w-[calc(100%+2px)] flex-1 rounded-b-none rounded-t-[28px] border-b-0 pb-6 shadow-none", plain && "rounded-none border-x-0 border-b-0 border-t border-border shadow-none", embedded && "-mx-5 !w-[calc(100%+40px)] rounded-none border-x-0 border-b-0 border-t-8 border-muted bg-transparent pb-0 shadow-none")}>
      {/* Oct 27 2026: the full delivery details PDF SFK keeps for this address (parking, getting in, delivery
          instructions, with maps and diagrams), first in the list and one tap away, rather than copied line by line. */}
      {stop.detailsPdf && (
        // Oct 27 2026 (second look): a document card, like a file attachment, instead of a cropped page. A small
        // thumbnail of the whole page, the title, and chips for what's inside; tap opens the in-app viewer.
        // Nov 4 2026: the tint a little stronger (full teal wash, not 60%), so the card reads as a card.
        <div className={cn("px-4 py-3.5", rows.length > 0 && "border-b border-border", (plain || embedded) && "px-5")}>
          <button onClick={() => a.openSheet({ name: "pdf", id: stop.id })} className="block w-full rounded-[8px] border border-teal/25 bg-teal-wash p-3 text-left active:scale-[0.99]">
            <span className="flex items-center gap-3">
              <span className="relative block h-[76px] w-[58px] shrink-0 overflow-hidden rounded-md border border-border bg-white shadow-card">
                <PdfPages url={stop.detailsPdf} first />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-snug text-foreground">{t("Delivery details")}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                  <FileText className="size-3.5" /> PDF · {stop.name}
                </span>
              </span>
              <span className="flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-teal pl-4 pr-3 text-[15px] font-semibold text-white">
                {t("Open")} <ChevronRight className="size-4" />
              </span>
            </span>
            {/* What's in it, in one line of text, so the driver knows where to look before opening it. */}
            <span className="mt-2.5 block text-[15px] leading-snug text-foreground/80">{t("Parking, how to get in and delivery instructions")}</span>
          </button>
        </div>
      )}
      {/* Nov 4 2026: a hairline after the last row too, except on the stop page, where the grey Drop off band right
          below already closes the list. */}
      <ol className={cn("divide-y divide-border", !embedded && "border-b border-border")}>
        {rows.map((r) => (
          <li key={r.key} data-flow={r.flow} className={cn("flex scroll-mt-16 gap-3 px-4 py-3.5", plain && "px-5", embedded && "px-5")}>
            {/* Minimal marker: one icon size for every row, in line with the 17px label. No filled circle. */}
            <span className="w-5 shrink-0 pt-0.5 text-teal [&_svg]:size-5" aria-hidden>
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[17px] font-bold leading-snug text-foreground">{r.label}</span>
                {r.note && <span className="truncate text-2xs text-muted-foreground">{r.note}</span>}
              </div>
              <div className="mt-0.5 text-[15px] leading-snug text-foreground/80">{r.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * Nov 3 2026 (review: a driver won't think to tap "Drop off" to see what they're carrying): every stage of a delivery
 * as a card on the stop page, in the stage track's order: Drop off (the order and its items), Set up (its steps) and
 * Collect (the reusables). Read-only: the button at the bottom still does the next step; ticks made there show here.
 */
function StageCards({ stop }: { stop: Stop }) {
  const { s } = useApp();
  const st = s.stops[stop.id];
  if (stop.kind === "pickup") return isOn("reusables") && !(st.status === "cancelled" && st.skip?.status !== "approved") ? <div className="-mx-5"><PickupStage stop={stop} /></div> : null;
  if (st.status === "cancelled") return null;
  const there = st.status === "arrived" || st.status === "delivered";
  const delivered = st.status === "delivered";
  const putDown = st.dropDone ?? {};
  const put = stop.bags.filter((b) => putDown[b.id]).length;
  const total = stop.bags.length;
  const dropDone = delivered || (total > 0 && put === total);

  // Individual meals by dish ("9× Lemon chicken rice bowl"), most first; family style in the kitchen's groups.
  const byDish = stop.customerType !== "family";
  const dishes = Object.values(
    stop.bags.reduce<Record<string, { name: string; items: Stop["bags"] }>>((acc, b) => {
      (acc[dishOf(b)] ??= { name: dishOf(b), items: [] }).items.push(b);
      return acc;
    }, {}),
  ).sort((x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name));
  const groups = stop.bags.reduce<{ name?: string; items: Stop["bags"] }[]>((acc, b) => {
    const g = acc.find((x) => x.name === b.group);
    if (g) g.items.push(b);
    else acc.push({ name: b.group, items: [b] });
    return acc;
  }, []);
  const isPut = (items: Stop["bags"]) => delivered || (there && items.every((b) => putDown[b.id]));

  const steps = isOn("dropoff") ? stop.setup ?? [] : [];
  const stepsDone = steps.filter((_, i) => st.setupDone?.[i]).length;
  const setupDone = steps.length > 0 && (stepsDone === steps.length || !!st.setupEndAt);

  const collect = isOn("reusables") ? [...(stop.reusables ? [stop] : []), ...pickupsAt(s, stop)] : [];
  const collected = (x: Stop) => (x.id === stop.id ? !!st.collectResult : s.stops[x.id].status === "delivered");

  return (
    <div className="-mx-5">
      {total > 0 && (
        <StageCard
          stage="drop"
          icon={PackageFill}
          title="Drop off"
          done={dropDone}
          status={dropDone ? "Done" : ""}
          // Nov 4 2026: no hot / cold chip and no order line in this header (removed on review).
        >
          <ItemList>
            {byDish
              ? dishes.map((d) => {
                  const options = d.items.filter((b) => optionsOf(b)).map((b) => `${optionsOf(b)} (${b.label.split(" ")[0]})`);
                  return (
                    <ItemRow key={d.name} on={isPut(d.items)} count={d.items.length} label={d.name}>
                      {options.length > 0 && <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{options.join(", ")}</span>}
                    </ItemRow>
                  );
                })
              : groups.map((g, gi) => (
                  <Fragment key={g.name ?? gi}>
                    {g.name && <li className="bg-muted/40 px-5 py-2 text-[15px] font-semibold text-muted-foreground">{g.name}</li>}
                    {g.items.map((b) => (
                      <ItemRow key={b.id} on={isPut([b])} label={b.label}>
                        {b.detail && <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{b.detail}</span>}
                      </ItemRow>
                    ))}
                  </Fragment>
                ))}
          </ItemList>
        </StageCard>
      )}

      {steps.length > 0 && (
        <StageCard stage="setup" icon={BowlFoodFill} title="Set up" done={setupDone} status={setupDone ? "Done" : stepsDone > 0 ? `${stepsDone} of ${steps.length}` : stop.guestReadyTime ? `Done by ${fmtTime(stop.guestReadyTime)}` : ""}>
          <ItemList>
            {steps.map((step, i) => (
              <ItemRow key={step} on={!!st.setupDone?.[i] || !!st.setupEndAt} count={i + 1} numbered label={step} />
            ))}
          </ItemList>
        </StageCard>
      )}

      {collect.length > 0 && (
        <StageCard stage="collect" icon={RecycleFill} title="Collect reusables" done={collect.every(collected)} status={collect.every(collected) ? "Done" : ""}>
          <div className="space-y-3">
            {collect.map((x) => (
              <div key={x.id}>
                {/* A pickup riding along says which order it's from. */}
                {(x.id !== stop.id || x.fromOrder) && (
                  // Nov 4 2026: highlighted a little: darker text, the order number in bold teal.
                  <p className="nums mb-2 mt-3 pl-[80px] pr-5 text-[15px] text-foreground/80">
                    From order <b className="font-semibold text-teal-deep">{x.fromOrder?.orderNo ?? x.orderNo}</b>
                    {x.fromOrder ? ` · ${x.fromOrder.date}` : ""}
                  </p>
                )}
                <ItemList>
                  {(x.reusables ?? []).map((r) => (
                    <ItemRow key={r.id} on={collected(x)} count={r.expected} label={r.label} />
                  ))}
                </ItemList>
              </div>
            ))}
            {/* Nov 4 2026: this note is written by dispatch, so it reads as a comment from them: the dispatch headset
                in the count column, then a speech bubble with who wrote it, like a message in the Inbox. */}
            {stop.returns && (
              <div className="flex items-start gap-3 pb-4 pr-5 pl-5">
                <span className="grid w-12 shrink-0 place-items-center">
                  <span className="grid size-9 place-items-center rounded-full bg-teal-wash text-teal-deep">
                    <Headphones className="size-[18px]" />
                  </span>
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-teal-deep">Dispatch · {DISPATCH.name}</p>
                  <p className="mt-0.5 text-[15px] leading-snug text-foreground">{stop.returns}</p>
                </div>
              </div>
            )}
          </div>
        </StageCard>
      )}
    </div>
  );
}

/**
 * One stage: the track's icon, a title (with an optional line under it), and where it stands (in words, with a tick
 * once done). Nov 4 2026 (review: "still out of theme and look floating"): no boxed cards inside the page any more.
 * Each stage is a section of the page, and its rows run edge to edge with hairlines, like the route list.
 */
/** Nov 4 2026: the reusables packing slip as a small download-only button, for the right of a section header. */
export function PackingListButton({ id }: { id: string }) {
  const { a } = useApp();
  return (
    <button onClick={() => a.openSheet({ name: "packingList", id })} aria-label="Download packing list" title="Packing list" className="grid size-11 shrink-0 place-items-center rounded-full border border-border-strong bg-white text-teal-deep active:bg-teal-wash">
      <Download className="size-5" />
    </button>
  );
}

export function StageCard({ stage, icon: I, title, status, done, sub, tag, action, children }: { stage: string; icon: Icon; title: string; status: string; done: boolean; sub?: ReactNode; tag?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    // Nov 4 2026: each stage's header (icon, title, status and the line under it) sits on a soft grey band, like the
    // day headers on Schedule; its rows follow on white.
    <section data-stage={stage}>
      <div className="bg-muted/70 px-5 py-3.5">
        {/* Nov 4 2026: the icon is centred on the title and the line under it together (both lines sit beside it). */}
        <div className="flex items-center gap-3">
          {/* Every stage icon sits in the same 48px tile, so box, bowl and recycle read as one set. White on the band. */}
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]", done ? "bg-success-bg text-success" : "bg-white text-teal-deep")}>
            <I weight="fill" className="size-[28px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <h2 className="min-w-0 truncate text-[20px] font-semibold leading-snug tracking-tight">{title}</h2>
                {tag}
              </span>
              {/* Nov 4 2026: no "✓ Done" in the header; the green tile and the ticked rows already say it. */}
              {!done && status && <span className="nums shrink-0 text-[15px] text-muted-foreground">{status}</span>}
            </span>
            {sub && <span className="mt-0.5 block text-[15px] text-muted-foreground">{sub}</span>}
          </span>
          {/* Nov 4 2026: an optional small action on the right of the header (e.g. download the packing list). */}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ItemList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border border-y border-border bg-card">{children}</ul>;
}

/**
 * A read-only line: the count (or step number), then the item; green with a tick once done.
 * Nov 4 2026: calmer: the count is 15px semibold teal (not a big bold number), a step number sits in a small soft
 * circle, the item is medium weight, and options are plain grey.
 */
export function ItemRow({ on, count, numbered, label, children }: { on: boolean; count?: number; numbered?: boolean; label: string; children?: ReactNode }) {
  return (
    <li className={cn("flex min-h-[60px] items-center gap-3 px-5 py-3.5 transition-colors", on && "bg-success-bg")}>
      {count != null &&
        (numbered ? (
          // Nov 4 2026: the number / count column is as wide as the stage icon tile (48px), so every row's text starts
          // exactly under the section title.
          <span className="grid w-12 shrink-0 place-items-center">
            {/* Nov 4 2026: a finished step's number turns into a solid green tick, so done steps read at a glance. */}
            <span className={cn("nums grid size-7 place-items-center rounded-full text-[15px] font-semibold", on ? "bg-success text-white" : "bg-teal-wash text-teal-deep")}>{on ? <Check className="size-4" strokeWidth={3} /> : count}</span>
          </span>
        ) : (
          <span className={cn("nums w-12 shrink-0 text-center text-[17px] font-semibold", on ? "text-muted-foreground" : "text-teal-deep")}>{count}×</span>
        ))}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[17px] font-medium leading-snug", on && "text-foreground/60")}>{label}</span>
        {children}
      </span>
      {/* Done items (counts) get the same solid green tick on the right; numbered steps already show it on the left. */}
      {on && !numbered && (
        <span aria-label="Done" className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
    </li>
  );
}


/** #21 problem flow, as a quiet red link under the main action (same as the kitchen load screens). */
function ProblemLink({ id }: { id: string }) {
  const { a } = useApp();
  const t = useT();
  return (
    // Oct 26 2026: a small red link with an icon, in the top bar's right corner.
    <button onClick={() => a.push({ name: "problem", id })} className="mr-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-danger">
      <AlertTriangle className="size-4" /> {t("Report")}
    </button>
  );
}
