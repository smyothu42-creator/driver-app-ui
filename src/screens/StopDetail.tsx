import { AlertTriangle, ClipboardList, Maximize2, Ban, BadgeCheck, Building2, Camera, Car, Check, CheckCircle2, Clock, Headphones, MessageSquare, Navigation, Phone, Recycle, Timer } from "lucide-react";
import { isOn } from "../data/sprints";
import { crewOn, findStop, isLoaded, myAssignment, needsKitchenRun, pickupDelivery, pickupsAt, useApp, useT, vehicleOf } from "../store";
import { VEHICLES, fmtTime, fmtWindow, windowStatus, type Contact, type Stop } from "../data/route";
import { Download } from "lucide-react";
import { ActionBar, Button, Card, cn, IconChip, RoleBadge, StopAvatar, TopBar, WorkTags, SfkMark } from "../components/ui";
import { PhotoThumb } from "./Proof";
import accessPhoto from "../assets/access-photo.jpg";
import { useState, type ReactNode } from "react";

export function StopDetail({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const [photoOpen, setPhotoOpen] = useState(false);
  const cancelled = st.status === "cancelled";
  const change = s.changes[id];
  const onSite = st.status === "arrived" || st.status === "delivered";
  const pickup = stop.kind === "pickup";
  const skipped = cancelled && st.skip?.status === "approved"; // a reusables pickup dispatch agreed to skip
  const vehicle = VEHICLES.find((v) => v.id === vehicleOf(s, id))!;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={`${pickup ? t("Reusables pickup") : t("Delivery")}${skipped ? " · skipped" : cancelled ? " · cancelled" : ""}`}
        onBack={a.back}
        tone="white"
      />

      <div className="flex flex-1 flex-col space-y-5 overflow-y-auto overflow-x-hidden">

        {/* Stop identity in one card: who + where, then when + work type. (Map removed Oct 15 2026; navigation has the map.) */}
        <div className="overflow-x-clip">
          {/* Stop identity as a full-width white panel (same white, stroke and shadow as the Home stop box), rounded at the bottom.
              Side borders sit 1px off-screen so only the bottom curve shows the stroke. */}
          <div className="-mx-px rounded-b-[28px] border border-t-0 border-border-strong bg-white px-[21px] text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="pb-4 pt-2">
              {/* Name with the delivery window at the end of the same line. */}
              {/* Profile picture with the two call buttons beside it (#14: one tap to the customer side or the SFK side). */}
              <div className="mb-3 flex items-center gap-3">
                <StopAvatar stop={stop} className="size-14 shrink-0 text-[17px]" />
                {/* The buttons share the space beside the picture (never overlap it on a narrow phone). */}
                {!cancelled && (
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2" data-flow="actions">
                    <Button variant="outline" size="md" className="min-w-0 gap-1 whitespace-nowrap px-2" onClick={() => a.openSheet({ name: "people", id, who: "customer" })}>
                      <Phone /> {t("Customer")}
                    </Button>
                    <Button variant="outline" size="md" className="min-w-0 gap-1 whitespace-nowrap px-2" onClick={() => a.openSheet({ name: "people", id, who: "sfk" })}>
                      <Headphones /> {t("SFK Team")}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <h1 className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight">{stop.name}</h1>
                <span className="nums flex shrink-0 items-center gap-1 text-[13px] font-semibold text-foreground/80">
                  <Clock className="size-3.5 self-center" />
                  {fmtWindow(stop.windowStart, stop.windowEnd)}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
                {stop.addressLine1}
                {stop.addressLine2 && ` · ${stop.addressLine2}`}
                <br />
                {stop.city}
              </p>
            </div>
            <div className="space-y-2 border-t border-border pb-5 pt-4">
              {/* Review Oct 14 2026: work type shown on every stop. */}
              <WorkTags stop={stop} variant="plain" />
            </div>
          </div>

        </div>

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

        {/* Reusables pickup: its window, where it's picked up, and any skip request (Oct 21 2026). */}
        {isOn("reusables") && pickup && <PickupStatus stop={stop} />}

        {isOn("team") && <TeamCard stopId={id} onSite={onSite} />}

        {/* #79: only shown when dispatch put this delivery in a different vehicle than the driver's default. */}
        {isOn("profile") && vehicle.owner === "sfk" && !cancelled && (
          <div className="mx-4 flex items-center gap-3 rounded-xl border border-teal-soft bg-teal-wash p-3 text-[13px] text-teal-deep">
            <Car className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="font-semibold">Use {vehicle.name}</b> · {vehicle.detail}
            </span>
            <span className="text-2xs font-semibold">Set by dispatch</span>
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

        {st.status === "delivered" && !pickup && isOn("dropoff") && <ProofCard stop={stop} onOpen={() => setPhotoOpen(true)} />}
        {st.status === "delivered" && !pickup && !isOn("dropoff") && (
          <div className="mx-4 flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
            <CheckCircle2 className="size-4" /> Delivered {fmtTime(st.deliveredAt!)}
          </div>
        )}
        {st.status === "delivered" && pickup && (
          <div className="mx-4 flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
            <CheckCircle2 className="size-4" /> Collected {fmtTime(st.deliveredAt!)} · {st.collectPhotos} {st.collectPhotos === 1 ? "photo" : "photos"}
          </div>
        )}

        {/* Review Oct 14 2026: instructions come first, before departure, on the way and on arrival.
            On arrival the list speaks for itself (numbered steps); setup is a checklist in a dialog from the bottom button. */}
        {!cancelled && st.status !== "delivered" && (
          // Full-width white panel that runs to the bottom, rounded at the top. Its side borders sit 1px off-screen so the
          // top stroke follows the whole curve instead of tapering into a faint "glow" at the corners.
          <section className="flex flex-1 scroll-mt-16 flex-col">
            <StopInstructions stop={stop} arrived={st.status === "arrived"} bleed />
          </section>
        )}


        {st.status === "delivered" && (
          // Same full-width panel as before delivery, running to the bottom of the screen.
          <section className="flex flex-1 scroll-mt-16 flex-col">
            <StopInstructions stop={stop} arrived={false} bleed />
          </section>
        )}

        {/* #2 site + backup contacts live in the "Customer" sheet (button at the top). */}

        {/* #53 / #83: what to collect, with the expected count and the packing list. */}
        {isOn("reusables") && pickup && stop.reusables && (
          <section className="px-4">
            <SectionTitle
              action={
                <button onClick={() => a.openSheet({ name: "packingList", id })} className="flex h-10 items-center gap-1.5 rounded-full border border-control bg-card px-3.5 text-[13px] font-semibold text-teal">
                  <Download className="size-4" /> Packing list
                </button>
              }
            >
              To collect
            </SectionTitle>
            <Card className="divide-y divide-border border-border-strong">
              {stop.reusables.map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">{x.label}</span>
                  <span className="nums text-[15px] font-bold">
                    {st.collected ? `${st.collected[x.id] ?? 0} / ` : ""}
                    {x.expected}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* #50: reusables collected along with this delivery, counted the same way as a pickup. */}
        {isOn("reusables") && !pickup && stop.reusables && !cancelled && (
          <section className="px-4">
            <SectionTitle>Also collect</SectionTitle>
            <Card className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-wash text-teal">
                <Recycle className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">{stop.returns}</span>
                <span className="nums block text-2xs font-semibold text-muted-foreground">
                  {st.collected ? `${stop.reusables.reduce((n, x) => n + (st.collected![x.id] ?? 0), 0)} of ${stop.reusables.reduce((n, x) => n + x.expected, 0)} collected` : `Expected ${stop.reusables.reduce((n, x) => n + x.expected, 0)}`}
                </span>
              </span>
              <Button size="sm" variant={st.collected ? "outline" : "teal"} disabled={!onSite} onClick={() => a.push({ name: "collect", id })}>
                {st.collected ? "Edit" : "Count"}
              </Button>
            </Card>
          </section>
        )}
        {/* Reusables pickups at this address ride along with this delivery: count them here while on site. */}
        {isOn("reusables") && !pickup && !cancelled && pickupsAt(s, stop).length > 0 && (
          <section className="px-4">
            <SectionTitle>Also pick up here</SectionTitle>
            <Card className="divide-y divide-border">
              {pickupsAt(s, stop).map((x) => {
                const n = (x.reusables ?? []).reduce((m, r) => m + r.expected, 0);
                const skip = s.stops[x.id].skip;
                return (
                  <div key={x.id} className="flex items-center gap-3 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-wash text-teal">
                      <Recycle className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">Reusables · {x.orderNo}</span>
                      <span className="nums block text-[13px] text-muted-foreground">
                        {n} items · window {fmtWindow(x.windowStart, x.windowEnd)}
                        {skip?.status === "pending" && " · skip requested"}
                      </span>
                    </span>
                    <Button size="sm" variant="teal" disabled={!onSite} onClick={() => a.push({ name: "collect", id: x.id })}>
                      Count
                    </Button>
                  </div>
                );
              })}
            </Card>
            <p className="mt-2 px-1 text-[13px] text-muted-foreground">Not collected here? It stays on your route as its own pickup.</p>
          </section>
        )}
        {/* Bottom breathing room when the instructions panel isn't the last, full-height block. */}
        {cancelled && <div className="h-1 shrink-0" aria-hidden />}
      </div>

      <StopActions stop={stop} />

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
function ProofCard({ stop, onOpen }: { stop: Stop; onOpen: () => void }) {
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
    <section className="px-4">
      <Card className="overflow-hidden border-border-strong">
        <div className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
            <BadgeCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="nums text-[17px] font-semibold leading-tight">Delivered {fmtTime(st.deliveredAt!)}</div>
            <div className={cn("text-[13px] font-semibold", onTime ? "text-success" : "text-warning")}>{onTime ? "On time" : `Delayed · ${st.deliveredAt! - stop.windowEnd} min late`}</div>
          </div>
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
        <Button size="lg" variant="outline" className="w-full" onClick={() => a.setTab("today")}>
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
        <Button size="lg" className="w-full" onClick={() => a.push({ name: "pickup", id: stop.id })}>
          <SfkMark className="size-5" /> Back to kitchen to load
        </Button>
      </ActionBar>
    );
  }
  if (!isLoaded(s, stop)) {
    return (
      <ActionBar>
        <Button size="lg" variant="outline" className="w-full" onClick={() => (s.shiftOn ? a.openLoad() : a.openSheet({ name: "startShift" }))}>
          {t("Load at kitchen first")}
        </Button>
      </ActionBar>
    );
  }
  if (st.status === "arrived" && stop.kind === "pickup") {
    return (
      <ActionBar>
        <Button size="lg" className="w-full" onClick={() => a.push({ name: "collect", id: stop.id })}>
          <Recycle /> {t("Collect reusables")}
        </Button>
        <SkipLink stop={stop} />
        {isOn("dropoff") && <ProblemLink id={stop.id} />}
      </ActionBar>
    );
  }
  // #11: a stop with setup steps opens the setup checklist first; its dialog unlocks the photo once every step is ticked.
  const setupLeft = isOn("dropoff") && stop.setup ? stop.setup.some((_, i) => !st.setupDone?.[i]) : false;
  if (st.status === "arrived" && setupLeft) {
    return (
      <ActionBar>
        <Button size="lg" className="w-full" onClick={() => a.openSheet({ name: "setup", id: stop.id })}>
          <ClipboardList /> {t("Start setup")}
        </Button>
        {isOn("dropoff") && <ProblemLink id={stop.id} />}
      </ActionBar>
    );
  }
  if (st.status === "arrived") {
    return (
      <ActionBar>
        <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id: stop.id })}>
          <Camera /> {t("Take delivery photo")}
        </Button>
      {isOn("dropoff") && <ProblemLink id={stop.id} />}
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
        <SkipLink stop={stop} />
      </ActionBar>
    );
  return (
    <ActionBar>
      <Button size="lg" className="w-full" onClick={() => a.startNav(stop.id)}>
        <Navigation /> {st.status === "en_route" ? t("Resume navigation") : t("Start navigation")}
      </Button>
      {st.status === "en_route" && (
        <Button size="md" variant="ghost" className="w-full" onClick={() => a.arrive(stop.id, stop.driveMins)}>
          {t("I've already arrived")}
        </Button>
      )}
      <SkipLink stop={stop} />
      {isOn("dropoff") && <ProblemLink id={stop.id} />}
    </ActionBar>
  );
}

/** Reusables pickup: "Ask dispatch to skip" until a request is sent. */
function SkipLink({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  if (!isOn("reusables") || stop.kind !== "pickup" || s.stops[stop.id].skip) return null;
  return (
    <button onClick={() => a.openSheet({ name: "skip", id: stop.id })} className="w-full py-1 text-center text-[15px] font-semibold text-teal">
      Ask dispatch to skip this pickup
    </button>
  );
}

/**
 * Reusables pickup status, under the header: the pickup window (open / closing / missed), whether it's picked up
 * during a delivery at the same address, and where a skip request stands.
 */
function PickupStatus({ stop }: { stop: Stop }) {
  const { s } = useApp();
  const st = s.stops[stop.id];
  const done = st.status === "delivered" || st.status === "cancelled";
  const w = windowStatus(stop, s.clock);
  const along = pickupDelivery(s, stop);
  const tone = w.state === "missed" ? "border-danger-border bg-danger-bg text-danger" : w.state === "closing" ? "border-warning-border bg-warning-bg text-warning" : "border-teal-soft bg-teal-wash text-teal-deep";
  return (
    <div className="mx-4 space-y-2">
      {!done && (
        <div className={cn("flex gap-3 rounded-2xl border p-3.5", tone)}>
          <Clock className="mt-0.5 size-5 shrink-0" />
          <span className="nums text-[15px]">
            <b className="font-semibold">Pickup window {fmtWindow(stop.windowStart, stop.windowEnd)}</b>
            <span className="block text-[13px]">{w.text}</span>
          </span>
        </div>
      )}
      {along && (
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-3.5">
          <Recycle className="mt-0.5 size-5 shrink-0 text-teal" />
          <span className="text-[15px]">
            <b className="font-semibold">Pick up during your delivery to {along.name}</b>
            <span className="block text-[13px] text-muted-foreground">Same address, stop {along.seq}. Count it there with the delivery.</span>
          </span>
        </div>
      )}
      {st.skip && (
        <div className={cn("flex gap-3 rounded-2xl border p-3.5", st.skip.status === "declined" ? "border-warning-border bg-warning-bg text-warning" : "border-border bg-muted")}>
          <Ban className="mt-0.5 size-5 shrink-0" />
          <span className="nums text-[15px]">
            <b className="font-semibold">
              {st.skip.status === "pending" ? "Skip requested · waiting for dispatch" : st.skip.status === "approved" ? `Skipped · approved by dispatch ${fmtTime(st.skip.decidedAt!)}` : "Dispatch needs this pickup today"}
            </b>
            <span className="block text-[13px] opacity-80">
              {st.skip.reason}
              {st.skip.status === "pending" && ". Keep it on your route until they reply."}
            </span>
          </span>
        </div>
      )}
    </div>
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
    <button onClick={() => a.openSheet({ name: "photoFull", id: stop.id })} aria-label="View entrance photo full screen" className={cn("relative block w-full overflow-hidden rounded-xl active:scale-[0.99]", className)}>
      <img src={accessPhoto} alt={`Entrance at ${stop.addressLine1}`} className="block aspect-[16/9] w-full object-cover" />
      <span className="absolute bottom-2 right-2 flex h-8 items-center gap-1 rounded-full bg-black/60 px-2.5 text-[13px] font-semibold text-white">
        <Maximize2 className="size-3.5" /> Full screen
      </span>
    </button>
  );
}

export function StopInstructions({ stop, arrived, bleed, plain }: { stop: Stop; arrived: boolean; bleed?: boolean; plain?: boolean }) {
  const t = useT();
  const pickup = stop.kind === "pickup";
  // Individual customers: just their delivery instructions (no parking / building access rows).
  const person = stop.customerType === "individual";
  const rows: { key: string; icon: ReactNode; label: string; body: ReactNode; note?: string; order?: boolean; flow?: string }[] = [];
  if (!person && stop.parking) rows.push({ key: "park", icon: <Car />, label: t("Parking"), body: stop.parking, flow: "address" });
  if (!person) rows.push({
    key: "access",
    icon: <Building2 />,
    label: "Get in",
    flow: stop.parking ? undefined : "address",
    body: (
      <>
        {stop.buildingNotes}
        {stop.hasBuildingPhoto && <EntrancePhoto stop={stop} className="mt-2" />}
      </>
    ),
  });
  rows.push({
    key: "drop",
    icon: <MessageSquare />,
    label: pickup ? "Find the items" : t("Delivery instructions"),
    body: stop.dropoffNotes,
    note: pickup ? undefined : `From ${stop.contact.name.split(" ")[0]}`,
    order: true,
    flow: "instructions",
  });
  // "Also collect" (reusables with a delivery) waits for the Reusable pickup sprint.
  if (isOn("reusables") && !pickup && stop.reusables) rows.push({ key: "collect", icon: <Recycle />, label: "Also collect", body: stop.returns });
  // The last step (photo) is the button at the bottom, so it isn't repeated here.

  // One quiet row per step: icon (or step number once arrived), a short label, then the text.
  // The order-only note keeps its yellow (review: yellow = this order only).
  return (
    <Card className={cn("overflow-hidden border-border-strong", bleed && "-mx-px !w-[calc(100%+2px)] flex-1 rounded-b-none rounded-t-[28px] border-b-0 pb-6 shadow-none", plain && "rounded-none border-x-0 border-b-0 border-t border-border shadow-none")}>
      <ol className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.key} data-flow={r.flow} className={cn("flex scroll-mt-16 gap-3 px-4 py-3.5", plain && "px-5", r.order && "bg-yellow-wash")}>
            {/* Minimal marker: the step number once arrived, otherwise a small icon. No filled circle. */}
            <span className="nums w-5 shrink-0 pt-px text-center text-[15px] font-bold leading-snug text-teal [&_svg]:mx-auto [&_svg]:mt-0.5 [&_svg]:size-4">
              {arrived ? i + 1 : r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold leading-snug text-foreground">{r.label}</span>
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

/** Section title in the Home style: bold capitals. Optional action on the right. */
function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** #21 problem flow, as a quiet red link under the main action (same as the kitchen load screens). */
function ProblemLink({ id }: { id: string }) {
  const { a } = useApp();
  const t = useT();
  return (
    <button onClick={() => a.push({ name: "problem", id })} className="w-full py-1 text-center text-[15px] font-semibold text-danger">
      {t("Report a problem")}
    </button>
  );
}
