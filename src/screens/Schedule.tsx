import { AlertTriangle, Ban, BellRing, CalendarCheck, CalendarDays, CalendarOff, CheckCircle2, ChevronRight, Clock, MessageSquare, UserCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp, useT } from "../store";
import { ROUTE_ISO, SETTINGS, fmtHours, fmtTime, weekdayOf, type DeliveryRequest, type OpenDay } from "../data/route";
import { addDays, fromISO, toISO } from "../data/availability";
import { ActionBar, Button, cn, RoleBadge, StatusText, TopBar, WorkTags } from "../components/ui";

/* ------------------------------------------------------------------
 * Schedule tab (Sprint 2 · Schedule & assignments, due Tue Oct 20 2026).
 * Same look as Home / Route / Stop: mint header with a summary card, white cards with the customer
 * picture, 18 px names, plain work tags and a one-word status with a dot.
 *   #18/#19  every assignment arrives as a request the driver accepts or declines (decline needs a reason)
 *            reminder every SETTINGS.requestReminderHours; dispatch flagged SETTINGS.requestFlagHours before
 *   #20      orders are visible before they're confirmed, multi-day orders are one request listing every day
 *   #17      upcoming deliveries with rough times, shown against the driver's open hours
 *   #16      open hours set by dispatch, read-only here
 *   #76      time off (out of office) at least SETTINGS.timeOffNoticeDays ahead, approved by dispatch
 *   #44/#70  "Usual route" placeholders hold the driver's recurring slot before the order comes in
 *   #31/#70  work dispatch cancels after it's accepted (placeholders too) stays struck through, with a push
 *   Oct 26   "Accept all" for the requests in the list, behind a sheet that checks the date range;
 *            work dispatch assigns outright (no Accept) arrives with a push and shows "New" until opened
 * ------------------------------------------------------------------ */

/** Hours from "now" in the prototype (Tue Oct 6, s.clock) to a request's delivery time. */
export function hoursUntil(r: DeliveryRequest, clock: number) {
  const days = Math.round((fromISO(r.dateISO).getTime() - fromISO(ROUTE_ISO).getTime()) / 86400000);
  return days * 24 + (r.time - clock) / 60;
}

/**
 * The answer deadline: SETTINGS.requestAnswerHours before the (first) delivery, as "Tue, 12 PM" (Oct 22 2026).
 * One wording for every request, so "under 2 days away" and "waiting for your answer" are no longer two phrasings of one state.
 */
export function respondBy(r: DeliveryRequest) {
  const at = fromISO(r.dateISO);
  at.setMinutes(r.time - SETTINGS.requestAnswerHours * 60);
  const day = at.toLocaleDateString("en-US", { weekday: "short" });
  return `${day}, ${fmtTime(at.getHours() * 60 + at.getMinutes()).replace(":00", "")}`;
}

/** Every day a request covers, as [iso, label] pairs. Multi-day orders list each day (#20). */
export const daysOf = (r: DeliveryRequest): [string, string][] => (r.days ? r.days.map((d, i) => [r.dayISOs?.[i] ?? r.dateISO, d]) : [[r.dateISO, r.dateLabel]]);

/** #17: is the rough time inside the open hours dispatch set for that weekday? */
export const inHours = (hours: OpenDay[], iso: string, time: number) => {
  const h = hours[weekdayOf(iso)];
  return !!h && time >= h.start && time <= h.end;
};

/** "Wed, Oct 7" from an ISO date. */
const shortDay = (iso: string) => fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Every day a set of requests covers (multi-day ones count each day), first to last, as ISO dates. */
export function daysCovered(rs: DeliveryRequest[]) {
  return [...new Set(rs.flatMap((r) => daysOf(r).map(([iso]) => iso)))].sort();
}

/** "Wed, Oct 7 – Wed, Oct 14", or one day on its own. */
export function rangeLabel(rs: DeliveryRequest[]) {
  const d = daysCovered(rs);
  return d.length === 0 ? "" : d.length === 1 ? shortDay(d[0]) : `${shortDay(d[0])} – ${shortDay(d[d.length - 1])}`;
}

const dayTitle = (iso: string, label: string) => (iso === toISO(addDays(fromISO(ROUTE_ISO), 1)) ? `Tomorrow · ${label}` : label);

export function ScheduleTab() {
  const { s, a } = useApp();
  const t = useT();
  const pending = s.requests.filter((r) => r.status === "pending").sort((x, y) => x.dateISO.localeCompare(y.dateISO) || x.time - y.time);
  // Same-day ones are already on today's route, so they don't repeat here.
  // Cancelled ones (#31 / #70) stay in place, struck through, so the driver sees the slot is free.
  const accepted = s.requests.filter((r) => (r.status === "accepted" || r.status === "cancelled") && !r.orderId);
  const timeOff = Object.entries(s.availability).filter(([iso, d]) => iso > ROUTE_ISO && d.status === "unavailable");

  // Coming up: accepted work on each of its days, and days off as an all-day row.
  const days: Record<string, { label: string; items: DeliveryRequest[] }> = {};
  const label = (iso: string) => fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  for (const r of accepted) for (const [iso, l] of daysOf(r)) (days[iso] ??= { label: l, items: [] }).items.push(r);
  for (const [iso] of timeOff) days[iso] ??= { label: label(iso), items: [] };
  const dayList = Object.entries(days).sort(([x], [y]) => x.localeCompare(y));
  // Oct 27 2026: two tabs, Your schedules (accepted work) first, then New requests. Opens on Your schedules; the coral
  // count on New requests says when something waits for an answer.
  const [view, setView] = useState<"requested" | "accepted">("accepted");
  const fresh = accepted.filter((r) => r.unseen).length; // assignments from dispatch not opened yet
  const TABS = [
    ["accepted", t("Your schedules"), fresh, "bg-teal"],
    ["requested", t("New requests"), pending.length, "bg-coral"],
  ] as const;

  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-[#CFE8E8]">
      {/* Mint header, like Home's greeting, with the open-hours dashboard (#16) where the duty card sits on Home.
          Oct 27 2026: Time off moved up here, beside the title, so the white panel starts with the list. */}
      <div className="bg-[#CFE8E8] px-4 pb-8 pt-1 text-teal-deep">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h1 className="px-1 text-2xl font-bold leading-tight tracking-tight">{t("Schedule")}</h1>
          <button onClick={() => a.push({ name: "availability" })} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3.5 text-[13px] font-semibold text-teal-deep active:scale-[0.98]">
            <CalendarOff className="size-4" />
            {t("Time off")}
          </button>
        </div>
        <OpenHoursCard hours={s.openHours} />
      </div>

      {/* White panel tucked 16px into the mint header with a rounded top, same as Home's next-stop card.
          Oct 27 2026 (review: "too messy"): Requested and Accepted are separate tabs. Requested: one card per request
          with its buttons. Accepted: a quiet calendar, no chip on plain accepted work (a chip only when something is
          different: New, Assigned, Usual route, Cancelled). */}
      <div className="relative z-[2] -mx-px -mt-4 w-[calc(100%+2px)] flex-1 space-y-4 rounded-t-[28px] border border-b-0 border-border-strong bg-white px-[17px] pb-8 pt-5">
        {/* Full-width segmented tabs, the panel's first thing. The coral count says how many need an answer. */}
        <div role="tablist" aria-label="Schedule" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {TABS.map(([v, label, n, tone]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("flex h-10 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold", view === v ? "bg-card text-teal-deep shadow-card" : "text-muted-foreground")}
            >
              {label}
              {n > 0 && <span className={cn("nums grid h-5 min-w-5 place-items-center rounded-full px-1 text-2xs font-bold text-white", tone)}>{n}</span>}
            </button>
          ))}
        </div>

        {view === "requested" ? (
          <section>
            {pending.length === 0 ? (
              <p className="flex items-center gap-2 px-1 text-[15px] text-muted-foreground">
                <CheckCircle2 className="size-5 shrink-0 text-success" /> All requests answered
              </p>
            ) : (
              <>
                <AcceptAllBar requests={pending} />
                <div className="space-y-2.5">
                  {pending.map((r) => (
                    <RequestRow key={r.id} r={r} />
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <section>
            {dayList.length === 0 ? (
              <p className="flex items-center gap-2 px-1 text-[15px] text-muted-foreground">
                <CheckCircle2 className="size-5 shrink-0 text-success" /> Nothing accepted yet
              </p>
            ) : (
              // Apple Calendar list, full width (no card): the day (17px, as asked Oct 27 2026), then one quiet line per booking.
              <div className="-mx-4">
                {dayList.map(([iso, d]) => {
                  const off = s.availability[iso]?.status === "unavailable" ? s.availability[iso] : null;
                  return (
                    <div key={iso}>
                      <div className="border-b border-border px-5 pb-2 pt-5 text-[17px] font-bold text-teal-deep">{dayTitle(iso, d.label)}</div>
                      {off && (
                        <div className="flex min-h-[52px] items-center gap-3 border-b border-border px-5">
                          <span className="w-[72px] shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">All day</span>
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-muted-foreground">Time off</span>
                          <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">{off.requested ? "Requested" : "Approved"}</span>
                        </div>
                      )}
                      {[...d.items]
                        .sort((x, y) => x.time - y.time)
                        .map((r) => (
                          <div key={`${iso}/${r.id}`} className="border-b border-border">
                            <UpcomingRow r={r} />
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/** #16 open hours, one line: today's hours. Tap for the whole week (bottom sheet). Read-only; dispatch sets them. */
function OpenHoursCard({ hours }: { hours: OpenDay[] }) {
  const { a } = useApp();
  const t = useT();
  const today = hours[weekdayOf(ROUTE_ISO)];
  return (
    <button onClick={() => a.openSheet({ name: "openHours" })} className="mt-3 flex h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left active:scale-[0.99]">
      <Clock className="size-5 shrink-0 text-teal" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-muted-foreground">{t("Your availability today")}</span>
        <span className="nums block text-[17px] font-semibold leading-tight text-foreground">{today ? fmtHours(today) : "Off"}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-teal" />
    </button>
  );
}

/**
 * #18 Requests only: what Home's request button opens. Same mint top + white panel as Schedule,
 * one day band per date, one row per request with Accept / Can't do it on it.
 */
export function RequestsScreen() {
  const { s, a } = useApp();
  const pending = s.requests.filter((r) => r.status === "pending").sort((x, y) => x.dateISO.localeCompare(y.dateISO) || x.time - y.time);
  return (
    <div className="flex h-full flex-col bg-[#CFE8E8]">
      <TopBar title="Requests" onBack={a.back} tone="hero" />
      <div className="flex-1 overflow-y-auto overflow-x-clip pt-2">
        <div className="relative -mx-px min-h-full w-[calc(100%+2px)] overflow-hidden rounded-t-[28px] border border-b-0 border-border-strong bg-white pb-8">
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-[15px] font-medium text-muted-foreground">
              <CheckCircle2 className="size-5 text-success" /> All requests answered
            </p>
          ) : (
            // Oct 27 2026: the same request cards as Schedule's "Needs your answer" (each card says its day and time).
            <div className="space-y-2.5 px-4 pt-4">
              <AcceptAllBar requests={pending} />
              {pending.map((r) => (
                <RequestRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Oct 26 2026: "Accept all" for the requests in the current list (drivers can have 15 stacked up for one week).
 * Only when there's more than one. It opens a sheet that spells out the date range and asks the driver to confirm it.
 */
function AcceptAllBar({ requests }: { requests: DeliveryRequest[] }) {
  const { a } = useApp();
  const t = useT();
  if (requests.length < 2) return null;
  return (
    // Oct 27 2026, minimal: how many to answer, and a plain text Accept all (no date range, icon or outline).
    // The sheet it opens still spells out the dates before anything is accepted.
    <div className="mb-2 flex min-h-11 items-center justify-between gap-3 px-1">
      <span className="nums text-[15px] text-muted-foreground">
        {requests.length} {t("to answer")}
      </span>
      <button onClick={() => a.openSheet({ name: "acceptAll", ids: requests.map((r) => r.id) })} className="-mr-1 flex h-11 items-center px-1 text-[15px] font-semibold text-teal">
        {t("Accept all")}
      </button>
    </div>
  );
}

/**
 * Accepted (or cancelled) row: the same one-line calendar row as a request, and the same interaction, a › to its
 * full page (Oct 22 2026: one way to open a row, not ⌄ here and › there). The page has the work, address and status.
 */
function UpcomingRow({ r }: { r: DeliveryRequest }) {
  const { a } = useApp();
  const t = useT();
  const cancelled = r.status === "cancelled";
  return (
    <button onClick={() => a.push({ name: "request", id: r.id })} className="flex min-h-[52px] w-full items-center gap-3 px-5 text-left">
      <span className="nums w-[72px] shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">{fmtTime(r.time)}</span>
      <span className={cn("min-w-0 flex-1 truncate py-3 text-[15px] font-semibold leading-tight", cancelled && "text-muted-foreground line-through")}>{r.name}</span>
      {/* The state in words (+ icon), not only the bar colour (accessibility, Oct 22 2026). */}
      {/* Same status chip as the stop rows and the request page (StatusText). */}
      {cancelled ? (
        <StatusText tone="off">{t("Cancelled")}</StatusText>
      ) : r.unseen ? (
        // Oct 26 2026: dispatch assigned it and the driver hasn't opened it yet.
        <StatusText tone="now">{t("New")}</StatusText>
      ) : r.assigned ? (
        <StatusText tone="done">{t("Assigned")}</StatusText>
      ) : r.placeholder ? (
        <StatusText tone="wait">{t("Usual route")}</StatusText>
      ) : null /* Oct 27 2026: plain accepted work needs no chip; it's what "Coming up" means. */}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * #18 request row. Answering is the driver's main job here, so Accept / Can't do it are always on the row
 * (review Oct 22 2026), not behind a tap. Tap the name for the full details.
 * Under 48 h and outside open hours are said in words under the name.
 */
function RequestRow({ r }: { r: DeliveryRequest }) {
  const { s, a } = useApp();
  const t = useT();
  const urgent = hoursUntil(r, s.clock) <= SETTINGS.requestFlagHours;
  const outside = daysOf(r).some(([iso]) => !inHours(s.openHours, iso, r.time));
  // Oct 27 2026: one calm card per request: who, when, the deadline (amber only when close), then Accept / Can't do it.
  return (
    <div className="rounded-2xl border border-border-strong bg-white p-4 shadow-card">
      <button onClick={() => a.push({ name: "request", id: r.id })} className="flex w-full items-start gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-snug">{r.name}</span>
          <span className="nums mt-0.5 block truncate text-[15px] text-foreground/80">
            {dayTitle(r.dateISO, r.dateLabel)} · {fmtTime(r.time)}
            {r.days && ` · ${r.days.length} days`}
          </span>
          <span className={cn("nums mt-1 flex items-center gap-1 text-[13px]", urgent || outside ? "font-semibold text-warning" : "text-muted-foreground")}>
            {(urgent || outside) && <AlertTriangle className="size-3.5 shrink-0" />}
            <span className="truncate">
              {t("Respond by")} {respondBy(r)}
              {outside && ` · ${t("Outside your availability")}`}
            </span>
          </span>
        </span>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="md" className="whitespace-nowrap" onClick={() => a.answerRequest(r.id, "accepted")}>
          {r.days ? `Accept ${r.days.length} days` : t("Accept")}
        </Button>
        <Button size="md" variant="outline" className="whitespace-nowrap" onClick={() => a.openSheet({ name: "decline", id: r.id })}>
          {t("Can't do it")}
        </Button>
      </div>
    </div>
  );
}

/** #18 / #20: one request with everything the driver needs to decide. Accept is the one primary action. */
export function RequestDetail({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const r = s.requests.find((x) => x.id === id)!;
  const pending = r.status === "pending";
  const urgent = pending && hoursUntil(r, s.clock) <= SETTINGS.requestFlagHours;
  const days = daysOf(r);
  // Oct 27 2026: reminders come as often as the driver picked in Me → Notifications.
  const nextReminder = r.remindedAt != null ? r.remindedAt + s.notifPrefs.reminderHours * 60 : null;
  // Opening a dispatch assignment is how the driver acknowledges it: it stops showing as New.
  useEffect(() => a.seeAssignment(id), [id, a]);

  const cancelled = r.status === "cancelled";
  // Oct 27 2026: same look as the stop page: flat white page, who and when at the top, a light divider, then quiet
  // icon rows (one per day, then the rough time). Dispatch sits top right, where Report is on a stop.
  const Row = ({ icon, label, right, children }: { icon: ReactNode; label: ReactNode; right?: ReactNode; children?: ReactNode }) => (
    <li className="flex gap-3 px-5 py-3.5">
      <span className="w-5 shrink-0 pt-0.5 text-teal [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[17px] font-bold leading-snug text-foreground">{label}</span>
          {right}
        </div>
        {children && <div className="mt-0.5 text-[15px] leading-snug text-foreground/80">{children}</div>}
      </div>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={r.placeholder ? "Usual route" : r.assigned ? "Assigned delivery" : r.orderId ? "Delivery for today" : pending ? "Delivery request" : "Delivery"}
        onBack={a.back}
        tone="white"
        right={
          // Oct 26 2026: opens the dispatch inbox (preset messages, custom message, Call), not a call straight away.
          // Oct 27 2026: labelled Message, with a message icon, since that's what it opens.
          <button onClick={() => a.push({ name: "inbox" })} aria-label="Message dispatch" className="mr-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-teal">
            <MessageSquare className="size-4" /> {t("Message")}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        <div className="px-5 pb-5 pt-3">
          <RequestStatus r={r} />
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">{r.name}</h1>
          <p className="nums mt-1 flex items-center gap-1.5 text-[17px] font-semibold text-teal-deep">
            <Clock className="size-4" />
            {r.days ? `${r.days.length} days` : dayTitle(r.dateISO, r.dateLabel)} · ~{fmtTime(r.time)}
          </p>
          <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
            {r.address}
            <br />
            {r.type} · {r.orderNo}
          </p>
          {r.status === "declined" && r.reason && <p className="mt-1.5 text-[15px] text-muted-foreground">You said: {r.reason}</p>}
          {(r.work.length > 0 || r.role) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <WorkTags work={r.work} variant="plain" />
              {r.role && (
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  Your role <RoleBadge role={r.role} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Anything that needs attention, under who and when (same place as a stop's dispatch changes). */}
        {(urgent || cancelled || r.assigned || r.placeholder) && (
          <div className="space-y-3 px-5 pb-5">
            {urgent && (
              <div className="flex gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4 text-warning">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <span className="text-[15px]">
                  <b className="font-bold">{t("Respond by")} {respondBy(r)}.</b>
                </span>
              </div>
            )}
            {cancelled && (
              <div className="flex gap-3 rounded-2xl border-2 border-danger-border bg-danger-bg p-4 text-danger">
                <Ban className="mt-0.5 size-5 shrink-0" />
                <span className="nums text-[15px]">
                  <b className="font-bold">Cancelled by dispatch at {fmtTime(r.cancelledAt!)}.</b> {r.placeholder ? "No order came in. That slot is free." : "It's off your schedule. Nothing to do."}
                </span>
              </div>
            )}
            {r.assigned && !cancelled && (
              <div className="flex gap-3 rounded-2xl bg-muted p-4 text-[15px] text-muted-foreground">
                <UserCheck className="mt-0.5 size-5 shrink-0 text-teal" />
                <span>
                  <b className="font-semibold text-foreground">Dispatch assigned this to you.</b> It's on your schedule; there's nothing to accept.
                </span>
              </div>
            )}
            {r.placeholder && !cancelled && (
              <p className="rounded-2xl bg-muted p-4 text-[15px] text-muted-foreground">
                Holds your usual slot here. When the order comes in, it fills this spot and keeps you on it. No order by the cutoff and it's cancelled; you'll get a message.
              </p>
            )}
          </div>
        )}

        {/* When: one quiet row per day, each checked against the open hours for that day, then the rough time. */}
        <ol className="divide-y divide-border border-t border-border/60 pb-2">
          {days.map(([iso, label]) => {
            const fits = inHours(s.openHours, iso, r.time);
            return (
              <Row key={iso} icon={<CalendarDays />} label={dayTitle(iso, label)} right={<span className="nums shrink-0 text-[15px] font-bold text-foreground">~{fmtTime(r.time)}</span>}>
                {/* Only flag a problem; a day inside your open hours needs no line. */}
                {!fits && (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Outside your availability · {fmtHours(s.openHours[weekdayOf(iso)])}
                  </span>
                )}
              </Row>
            );
          })}
          <Row icon={<Clock />} label="Rough time" right={r.days && <span className="truncate text-2xs text-muted-foreground">One answer for all {r.days.length} days</span>}>
            The exact window comes with your route on the day.
          </Row>
          {/* Oct 27 2026: not ready to answer? One tap for a reminder in an hour, by push. */}
          {pending && nextReminder != null && (
            <Row
              icon={<BellRing />}
              label="Reminder"
              right={
                nextReminder > s.clock + 60 && (
                  <button onClick={() => a.remindMeLater(id)} className="-my-2 flex h-11 shrink-0 items-center text-[15px] font-semibold text-teal">
                    Remind me in 1 h
                  </button>
                )
              }
            >
              <span className="nums">
                Sent {r.sentAt} · next {fmtTime(nextReminder)}
              </span>
            </Row>
          )}
        </ol>
      </div>

      {pending ? (
        <ActionBar>
          <Button size="lg" className="w-full" onClick={() => a.answerRequest(id, "accepted")}>
            <CalendarCheck /> {r.days ? `Accept all ${r.days.length} days` : t("Accept")}
          </Button>
          <Button size="md" variant="ghost" className="w-full" onClick={() => a.openSheet({ name: "decline", id })}>
            {t("Can't do it")}
          </Button>
        </ActionBar>
      ) : (
        // Oct 27 2026: no "Back to schedule" button; the top bar's back does that. Only the hint stays, for accepted work.
        r.status === "accepted" && (
          <ActionBar>
            <p className="whitespace-nowrap text-center text-[13px] text-muted-foreground">Can't make it? Tell dispatch so they can reassign it.</p>
          </ActionBar>
        )
      )}
    </div>
  );
}

/** Request status as a status word (same as stop rows), not a banner. */
function RequestStatus({ r }: { r: DeliveryRequest }) {
  const t = useT();
  if (r.status === "accepted") return <StatusText tone="done">{r.placeholder ? "Usual route" : r.assigned ? t("Assigned") : t("Accepted")}</StatusText>;
  if (r.status === "declined") return <StatusText tone="off">{t("Declined")}</StatusText>;
  if (r.status === "cancelled") return <StatusText tone="off">Cancelled</StatusText>;
  return <StatusText tone="wait">Requested</StatusText>;
}
