import { AlertTriangle, Ban, BellRing, CalendarCheck, CalendarDays, CalendarOff, CheckCircle2, ChevronRight, Clock, Headphones } from "lucide-react";
import { useState } from "react";
import { useApp, useT } from "../store";
import { DISPATCH, ROUTE_ISO, SETTINGS, fmtHours, fmtTime, weekdayOf, type DeliveryRequest, type OpenDay } from "../data/route";
import { addDays, fromISO, toISO } from "../data/availability";
import { ActionBar, Button, Card, cn, RoleBadge, StatusText, StopAvatar, TopBar, WorkTags } from "../components/ui";

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

const dayTitle = (iso: string, label: string) => (iso === toISO(addDays(fromISO(ROUTE_ISO), 1)) ? `Tomorrow · ${label}` : label);

export function ScheduleTab() {
  const { s, a } = useApp();
  const t = useT();
  const pending = s.requests.filter((r) => r.status === "pending").sort((x, y) => x.dateISO.localeCompare(y.dateISO));
  // Same-day ones are already on today's route, so they don't repeat here.
  // Cancelled ones (#31 / #70) stay in place, struck through, so the driver sees the slot is free.
  const accepted = s.requests.filter((r) => (r.status === "accepted" || r.status === "cancelled") && !r.orderId);
  const timeOff = Object.entries(s.availability).filter(([iso, d]) => iso > ROUTE_ISO && d.status === "unavailable");

  // Calendar days for a tab. Requests sit on their first day (a multi-day one says "3 days");
  // accepted work shows on each of its days; days off show as an all-day row.
  type Item = { kind: "answer" | "upcoming"; r: DeliveryRequest };
  const buildDays = (withPending: boolean, withAccepted: boolean) => {
    const days: Record<string, { label: string; items: Item[] }> = {};
    const label = (iso: string) => fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (withPending) for (const r of pending) (days[r.dateISO] ??= { label: r.dateLabel, items: [] }).items.push({ kind: "answer", r });
    if (withAccepted) {
      for (const r of accepted) for (const [iso, l] of daysOf(r)) (days[iso] ??= { label: l, items: [] }).items.push({ kind: "upcoming", r });
      for (const [iso] of timeOff) days[iso] ??= { label: label(iso), items: [] };
    }
    return Object.entries(days).sort(([x], [y]) => x.localeCompare(y));
  };
  // Opens on All, so everything is in one place; the coral count on "Requested" says what needs doing.
  // Oct 22 2026: "Coming up" dropped (All already shows it), and the filter shrank to two small chips.
  const [view, setView] = useState<"all" | "answer">("all");
  const dayList = buildDays(true, view === "all");
  const TABS = [
    ["all", "All", 0],
    ["answer", "Requested", pending.length],
  ] as const;

  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-[#CFE8E8]">
      {/* Mint header, like Home's greeting, with the open-hours dashboard (#16) where the duty card sits on Home. */}
      <div className="bg-[#CFE8E8] px-4 pb-8 pt-1 text-teal-deep">
        <div className="flex min-h-10 items-center">
          <h1 className="px-1 text-2xl font-bold leading-tight tracking-tight">{t("Schedule")}</h1>
        </div>
        <OpenHoursCard hours={s.openHours} />
      </div>

      {/* White panel tucked 16px into the mint header with a rounded top, same as Home's next-stop card. */}
      <div className="relative z-[2] -mx-px -mt-4 w-[calc(100%+2px)] flex-1 space-y-7 rounded-t-[28px] border border-b-0 border-border-strong bg-white px-[17px] pb-8 pt-5">
        <section>
          {/* Small segmented tab (same switch look as before, at chip size): secondary to the list, so it doesn't compete with Accept.
              Time off sits opposite it, same height. 20px below, matching the panel's top padding. */}
          <div className="mb-5 flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Schedule" className="inline-flex h-10 items-center gap-0.5 rounded-full bg-muted p-1">
              {TABS.map(([v, label, n]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn("flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold", view === v ? "bg-card text-teal-deep shadow-card" : "text-muted-foreground")}
                >
                  {label}
                  {n > 0 && <span className="nums grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-2xs font-bold text-white">{n}</span>}
                </button>
              ))}
            </div>
            <button onClick={() => a.push({ name: "availability" })} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-control bg-card px-3.5 text-[13px] font-semibold text-teal-deep active:scale-[0.98]">
              <CalendarOff className="size-4" />
              {t("Time off")}
            </button>
          </div>

          {dayList.length === 0 ? (
            <Card className="flex items-center gap-3 p-4 text-[15px] font-medium text-muted-foreground">
              <CheckCircle2 className="size-5 shrink-0 text-success" /> {view === "answer" ? "All requests answered" : "Nothing scheduled yet"}
            </Card>
          ) : (
            // Apple Calendar list, full width (no card): a day heading (with that day's open hours), then one line per item.
            // Rows keep their 16px side padding; hairlines run edge to edge.
            <div className="-mx-4 border-b border-border bg-white">
              {dayList.map(([iso, d], gi) => {
                const off = view === "all" && s.availability[iso]?.status === "unavailable" ? s.availability[iso] : null;
                return (
                  <div key={iso}>
                    {/* Day heading on a light surface band. Open hours live in the box at the top. */}
                    <div className={cn("bg-muted/60 px-4 py-2 text-[13px] font-semibold text-muted-foreground", gi > 0 && "border-t border-border")}>{dayTitle(iso, d.label)}</div>
                    {off && (
                      <div className="flex min-h-14 items-center gap-3 border-t border-border px-4">
                        <span className="w-[72px] shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">All day</span>
                        <span className="h-7 w-1 shrink-0 rounded-full bg-border-strong" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-muted-foreground">Time off</span>
                        <span className={cn("shrink-0 text-[13px] font-semibold", off.requested ? "text-muted-foreground" : "text-success")}>{off.requested ? "Requested" : "Approved"}</span>
                      </div>
                    )}
                    {d.items
                      .sort((x, y) => x.r.time - y.r.time)
                      .map(({ kind, r }) => {
                        const key = `${iso}/${r.id}`;
                        return (
                          <div key={key} className="border-t border-border">
                            {kind === "answer" ? <RequestRow r={r} /> : <UpcomingRow r={r} />}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </section>


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
            <div className="border-b border-border">
              {pending.map((r, i) => (
                <div key={r.id}>
                  {(i === 0 || pending[i - 1].dateISO !== r.dateISO) && (
                    // The first band runs up into the rounded top, so there's no white strip above it.
                    <div className={cn("bg-muted/60 px-4 pb-2 text-[13px] font-semibold text-muted-foreground", i === 0 ? "pt-4" : "border-t border-border pt-2")}>{dayTitle(r.dateISO, r.dateLabel)}</div>
                  )}
                  <div className="border-t border-border">
                    <RequestRow r={r} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
    <button onClick={() => a.push({ name: "request", id: r.id })} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
      <span className="nums w-[72px] shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">{fmtTime(r.time)}</span>
      <span className={cn("h-7 w-1 shrink-0 rounded-full", cancelled ? "bg-border-strong" : r.placeholder ? "bg-yellow-deep" : "bg-success")} aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate py-3 text-[15px] font-semibold leading-tight", cancelled && "text-muted-foreground line-through")}>{r.name}</span>
      {/* The state in words (+ icon), not only the bar colour (accessibility, Oct 22 2026). */}
      {/* Same status chip as the stop rows and the request page (StatusText). */}
      {cancelled ? (
        <StatusText tone="off">{t("Cancelled")}</StatusText>
      ) : r.placeholder ? (
        <StatusText tone="wait">{t("Usual route")}</StatusText>
      ) : (
        <StatusText tone="done">{t("Accepted")}</StatusText>
      )}
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
  // One line: the deadline, always; amber with a warning icon when it's close. "Outside your availability" only when it applies.
  return (
    <div className="bg-yellow-wash/40 px-4 pb-3 pt-1">
      <button onClick={() => a.push({ name: "request", id: r.id })} className="flex min-h-[52px] w-full items-center gap-3 text-left">
        <span className="nums w-[72px] shrink-0 whitespace-nowrap text-[15px] font-medium text-muted-foreground">{fmtTime(r.time)}</span>
        {/* Not answered yet: yellow bar (accepted is green). */}
        <span className="h-7 w-1 shrink-0 rounded-full bg-yellow-deep" aria-hidden />
        <span className="min-w-0 flex-1 py-1.5 leading-tight">
          <span className="block truncate text-[15px] font-semibold">{r.name}</span>
          <span className={cn("nums mt-0.5 flex items-center gap-1 text-[13px]", urgent || outside ? "font-medium text-warning" : "text-muted-foreground")}>
            {(urgent || outside) && <AlertTriangle className="size-3.5 shrink-0" />}
            <span className="truncate">
              {t("Respond by")} {respondBy(r)}
              {outside && ` · ${t("Outside your availability")}`}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {/* Compact (Oct 22 2026): two small buttons sized to their labels, lined up under the name, so a few requests
          don't push the list down. 36 px tall, 14 px labels, no icon so "Accept 3 days" fits on one line. */}
      <div className="ml-[100px] mt-1.5 flex flex-wrap gap-2.5">
        <Button size="sm" className="!h-9 whitespace-nowrap px-4 !text-[14px]" onClick={() => a.answerRequest(r.id, "accepted")}>
          {r.days ? `Accept ${r.days.length} days` : t("Accept")}
        </Button>
        <Button size="sm" variant="outline" className="!h-9 whitespace-nowrap px-4 !text-[14px]" onClick={() => a.openSheet({ name: "decline", id: r.id })}>
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
  const nextReminder = r.remindedAt != null ? r.remindedAt + SETTINGS.requestReminderHours * 60 : null;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={r.placeholder ? "Usual route" : r.orderId ? "Delivery for today" : pending ? "Delivery request" : "Delivery"} onBack={a.back} tone="white" />

      <div className="flex flex-1 flex-col space-y-5 overflow-y-auto overflow-x-hidden">
        {/* Identity panel: same white, rounded-bottom panel as the stop screen. */}
        <div className="overflow-x-clip">
          <div className="-mx-px rounded-b-[28px] border border-t-0 border-border-strong bg-white px-[21px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="pb-4 pt-2">
              <div className="mb-3 flex items-center gap-3">
                <StopAvatar stop={r} className="size-14 text-[17px]" />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <RequestStatus r={r} />
                  <Button variant="outline" size="md" className="shrink-0 gap-1.5 px-3.5" onClick={() => a.toast(`Calling ${DISPATCH.name}…`)}>
                    <Headphones /> {t("Dispatch")}
                  </Button>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <h1 className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight">{r.name}</h1>
                <span className="nums flex shrink-0 items-center gap-1 text-[13px] font-semibold text-foreground/80">
                  <Clock className="size-3.5 self-center" />~{fmtTime(r.time)}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
                {r.address}
                <br />
                {r.type} · {r.orderNo}
              </p>
              {r.status === "declined" && r.reason && <p className="mt-1.5 text-[13px] text-muted-foreground">You said: {r.reason}</p>}
            </div>
            {(r.work.length > 0 || r.role) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pb-5 pt-4">
                <WorkTags work={r.work} variant="plain" />
                {r.role && (
                  <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    Your role <RoleBadge role={r.role} />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {urgent && (
          <div className="mx-4 flex gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4 text-warning">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span className="text-[15px]">
              <b className="font-bold">{t("Respond by")} {respondBy(r)}.</b>
            </span>
          </div>
        )}

        {r.status === "cancelled" && (
          <div className="mx-4 flex gap-3 rounded-2xl border-2 border-danger-border bg-danger-bg p-4 text-danger">
            <Ban className="mt-0.5 size-5 shrink-0" />
            <span className="nums text-[15px]">
              <b className="font-bold">Cancelled by dispatch at {fmtTime(r.cancelledAt!)}.</b> {r.placeholder ? "No order came in. That slot is free." : "It's off your schedule. Nothing to do."}
            </span>
          </div>
        )}

        {r.placeholder && r.status !== "cancelled" && (
          <p className="mx-4 rounded-2xl bg-muted p-4 text-[15px] text-muted-foreground">
            Holds your usual slot here. When the order comes in, it fills this spot and keeps you on it. No order by the cutoff and it's cancelled; you'll get a message.
          </p>
        )}

        {pending && nextReminder != null && (
          <p className="nums mx-4 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <BellRing className="size-3.5 shrink-0" /> Sent {r.sentAt} · next reminder {fmtTime(nextReminder)}
          </p>
        )}

        {/* When: same full-width panel and quiet rows as the stop details page, running to the bottom.
            Every day, with its rough time checked against the open hours for that day. */}
        <section className="flex flex-1 flex-col">
          <Card className="-mx-px !w-[calc(100%+2px)] flex-1 overflow-hidden rounded-b-none rounded-t-[28px] border-b-0 border-border-strong pb-6 shadow-none">
            <ol className="divide-y divide-border">
              {days.map(([iso, label]) => {
                const fits = inHours(s.openHours, iso, r.time);
                return (
                  <li key={iso} className="flex gap-3 px-4 py-3.5">
                    <span className="w-5 shrink-0 pt-px text-teal [&_svg]:mx-auto [&_svg]:mt-0.5 [&_svg]:size-4">
                      <CalendarDays />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold leading-snug text-foreground">{dayTitle(iso, label)}</span>
                        <span className="nums shrink-0 text-[15px] font-bold leading-snug text-foreground">~{fmtTime(r.time)}</span>
                      </div>
                      {/* Only flag a problem; a day inside your open hours needs no line. */}
                      {!fits && (
                        <div className="mt-0.5 flex items-center gap-1 text-[15px] leading-snug text-warning">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          Outside your availability · {fmtHours(s.openHours[weekdayOf(iso)])}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              <li className="flex gap-3 px-4 py-3.5">
                <span className="w-5 shrink-0 pt-px text-teal [&_svg]:mx-auto [&_svg]:mt-0.5 [&_svg]:size-4">
                  <Clock />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold leading-snug text-foreground">Rough time</span>
                    {r.days && <span className="truncate text-2xs text-muted-foreground">One answer for all {r.days.length} days</span>}
                  </div>
                  <div className="mt-0.5 text-[15px] leading-snug text-foreground/80">The exact window comes with your route on the day.</div>
                </div>
              </li>
            </ol>
          </Card>
        </section>
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
        <ActionBar>
          <Button size="lg" variant="outline" className="w-full" onClick={a.back}>
            Back to schedule
          </Button>
          {r.status === "accepted" && <p className="whitespace-nowrap text-center text-[13px] text-muted-foreground">Can't make it? Call dispatch to reassign it.</p>}
        </ActionBar>
      )}
    </div>
  );
}

/** Request status as a status word (same as stop rows), not a banner. */
function RequestStatus({ r }: { r: DeliveryRequest }) {
  const t = useT();
  if (r.status === "accepted") return <StatusText tone="done">{r.placeholder ? "Usual route" : t("Accepted")}</StatusText>;
  if (r.status === "declined") return <StatusText tone="off">{t("Declined")}</StatusText>;
  if (r.status === "cancelled") return <StatusText tone="off">Cancelled</StatusText>;
  return <StatusText tone="wait">Requested</StatusText>;
}
