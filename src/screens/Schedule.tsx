import { AlertTriangle, BellRing, CalendarDays, CalendarOff, CheckCircle2, ChevronRight, Clock, MapPin, Repeat, UtensilsCrossed, XCircle } from "lucide-react";
import { useApp, useT } from "../store";
import { OPEN_HOURS, ROUTE_ISO, SETTINGS, fmtTime, type DeliveryRequest } from "../data/route";
import { fromISO } from "../data/availability";
import { ActionBar, Badge, Button, Card, cn, IconChip, RoleBadge, SectionLabel, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Schedule tab: what's coming after today.
 *   #18/#19  every assignment arrives as a request the driver accepts or declines (decline needs a reason)
 *   #20      orders are visible before they're confirmed, multi-day orders list every day
 *   #17      upcoming deliveries with rough times, inside the driver's open hours
 *   #16      open hours set by dispatch, read-only here
 *   #76      time off (out of office) at least N days ahead
 *   #44/#70  "Usual route" placeholders hold the driver's recurring slot before the order comes in
 * ------------------------------------------------------------------ */

/** Hours from "now" in the prototype (Tue Oct 6, s.clock) to a request's delivery time. */
export function hoursUntil(r: DeliveryRequest, clock: number) {
  const days = Math.round((fromISO(r.dateISO).getTime() - fromISO(ROUTE_ISO).getTime()) / 86400000);
  return days * 24 + (r.time - clock) / 60;
}

export function ScheduleTab() {
  const { s, a } = useApp();
  const t = useT();
  const pending = s.requests.filter((r) => r.status === "pending").sort((x, y) => x.dateISO.localeCompare(y.dateISO));
  const accepted = s.requests.filter((r) => r.status === "accepted" && !r.orderId) // same-day ones are already on today's route.sort((x, y) => x.dateISO.localeCompare(y.dateISO) || x.time - y.time);
  const declined = s.requests.filter((r) => r.status === "declined");
  const byDay = accepted.reduce<Record<string, DeliveryRequest[]>>((m, r) => ((m[r.dateLabel] ??= []).push(r), m), {});
  const timeOff = Object.entries(s.availability).filter(([iso, d]) => iso >= ROUTE_ISO && d.status === "unavailable").length;

  return (
    <div>
      <TopBar title={t("Schedule")} subtitle="Requests, upcoming deliveries and your hours" />
      <div className="space-y-6 px-4 py-4">
        {/* Needs your answer: the only thing on this tab that asks for an action. */}
        <section>
          <SectionLabel action={pending.length > 0 && <Badge tone="coral">{pending.length}</Badge>}>{t("Needs your answer")}</SectionLabel>
          {pending.length === 0 ? (
            <Card className="flex items-center gap-3 p-4 text-[13px] text-muted-foreground">
              <CheckCircle2 className="size-5 text-success" /> All requests answered.
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <RequestCard key={r.id} r={r} />
              ))}
              <p className="flex items-center gap-1.5 px-1 text-2xs text-muted-foreground">
                <BellRing className="size-3.5 shrink-0" /> We remind you every {SETTINGS.requestReminderHours} h until you answer.
              </p>
            </div>
          )}
        </section>

        <section>
          <SectionLabel>{t("Coming up")}</SectionLabel>
          {Object.keys(byDay).length === 0 ? (
            <Card className="p-4 text-[13px] text-muted-foreground">Nothing confirmed yet.</Card>
          ) : (
            <div className="space-y-3">
              {Object.entries(byDay).map(([day, list]) => (
                <div key={day}>
                  <div className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">{day}</div>
                  <Card className="divide-y divide-border">
                    {list.map((r) => (
                      <button key={r.id} onClick={() => a.push({ name: "request", id: r.id })} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left">
                        <span className="nums w-16 shrink-0 text-[15px] font-bold">~{fmtTime(r.time).replace(" ", " ")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                          <span className="block truncate text-2xs text-muted-foreground">{r.placeholder ? "Usual route · order not in yet" : `${r.meals} meals · ${r.type}`}</span>
                        </span>
                        {r.placeholder ? (
                          <Badge tone="slate">
                            <Repeat /> Usual
                          </Badge>
                        ) : (
                          <Badge tone="success">
                            <CheckCircle2 /> {t("Accepted")}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          )}
          {declined.length > 0 && (
            <p className="mt-2 px-1 text-2xs text-muted-foreground">
              {declined.length} declined: {declined.map((r) => r.name).join(", ")}. Dispatch is reassigning {declined.length === 1 ? "it" : "them"}.
            </p>
          )}
        </section>

        <section>
          <SectionLabel action={<span className="text-2xs font-semibold text-muted-foreground">Set by dispatch</span>}>{t("Your open hours")}</SectionLabel>
          <Card className="divide-y divide-border">
            {OPEN_HOURS.map((h) => (
              <div key={h.day} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold">{h.day}</span>
                <span className={cn("nums", h.hours ? "font-medium" : "text-muted-foreground")}>{h.hours ?? "Off"}</span>
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-2xs text-muted-foreground">Open hours are when dispatch can send you work. They aren't a schedule: your deliveries are the ones under Coming up. To change your hours, call dispatch.</p>
        </section>

        <section>
          <Card onClick={() => a.push({ name: "availability" })} className="flex items-center gap-3 p-4">
            <IconChip>
              <CalendarOff />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t("Time off")}</span>
              <span className="block text-2xs text-muted-foreground">{timeOff ? `${timeOff} ${timeOff === 1 ? "day" : "days"} requested or approved` : `Request at least ${SETTINGS.timeOffNoticeDays} days ahead`}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Card>
        </section>
      </div>
    </div>
  );
}

/** One pending request: where, when, and how long until dispatch gets flagged. Tap to answer. */
function RequestCard({ r }: { r: DeliveryRequest }) {
  const { s, a } = useApp();
  const hrs = hoursUntil(r, s.clock);
  const urgent = hrs <= SETTINGS.requestFlagHours;
  return (
    <Card onClick={() => a.push({ name: "request", id: r.id })} className={cn("overflow-hidden", urgent && "ring-2 ring-warning-border")}>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-tight tracking-tight">{r.name}</div>
            <div className="nums mt-0.5 text-[13px] font-semibold text-teal-deep">
              {r.days ? `${r.days.length} days · ${r.days[0].replace(/^\w+, /, "")} – ${r.days.at(-1)!.replace(/^\w+, /, "")}` : r.dateLabel} · ~{fmtTime(r.time)}
            </div>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{r.meals} meals</Badge>
          {r.days && <Badge tone="info">Multi-day</Badge>}
          <RoleBadge role={r.role} />
        </div>
      </div>
      {urgent && (
        <div className="flex items-center gap-2 border-t border-warning-border bg-warning-bg px-4 py-2 text-[13px] font-semibold text-warning">
          <AlertTriangle className="size-4 shrink-0" /> Less than 48 h away · dispatch is waiting
        </div>
      )}
    </Card>
  );
}

/** #18: one request. Accept is the primary action; "Can't do it" opens a sheet that needs a reason. */
export function RequestDetail({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const r = s.requests.find((x) => x.id === id)!;
  const hrs = hoursUntil(r, s.clock);

  return (
    <div className="flex h-full flex-col">
      <TopBar title={r.placeholder ? "Usual route" : r.orderId ? "Delivery for today" : "Delivery request"} subtitle={`${r.orderNo} · sent ${r.sentAt}`} onBack={a.back} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{r.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="size-3.5" /> {r.address}
          </p>
        </div>

        <StatusLine r={r} />

        <Card className="grid grid-cols-2 divide-x divide-border">
          <div className="p-3.5">
            <div className="text-overline flex items-center gap-1">
              <Clock className="size-3" /> Rough time
            </div>
            <div className="nums mt-0.5 text-lg font-bold">~{fmtTime(r.time)}</div>
            <div className="text-2xs text-muted-foreground">{r.orderId ? "Delivery window start" : "Final time comes with the route"}</div>
          </div>
          <div className="p-3.5">
            <div className="text-overline flex items-center gap-1">
              <UtensilsCrossed className="size-3" /> Order
            </div>
            <div className="nums mt-0.5 text-lg font-bold">{r.placeholder ? "—" : `${r.meals} meals`}</div>
            <div className="text-2xs text-muted-foreground">{r.type}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-overline mb-2 flex items-center gap-1">
            <CalendarDays className="size-3" /> {r.days ? `${r.days.length} days, one request` : "Day"}
          </div>
          <ul className="space-y-1.5">
            {(r.days ?? [r.dateLabel]).map((d) => (
              <li key={d} className="nums flex items-center justify-between text-[15px] font-semibold">
                {d} <span className="text-[13px] font-medium text-muted-foreground">~{fmtTime(r.time)}</span>
              </li>
            ))}
          </ul>
          {r.role && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
              Your role <RoleBadge role={r.role} />
            </div>
          )}
        </Card>

        {r.placeholder && (
          <p className="rounded-xl bg-muted p-3 text-[13px] text-muted-foreground">
            This holds your usual slot for this address. When the real order comes in, it fills this spot and keeps you on it. No order by the cutoff and it's cancelled; you'll get a message.
          </p>
        )}
        {r.status === "pending" && hrs <= SETTINGS.requestFlagHours && (
          <div className="flex gap-2.5 rounded-xl border border-warning-border bg-warning-bg p-3 text-[13px] text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <b className="font-semibold">Less than 48 h away.</b> Dispatch has been flagged that you haven't answered.
            </span>
          </div>
        )}
      </div>

      {r.status === "pending" ? (
        <ActionBar>
          <Button size="lg" className="w-full" onClick={() => a.answerRequest(id, "accepted")}>
            <CheckCircle2 /> {t("Accept")}
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
          {r.status === "accepted" && <p className="text-center text-2xs text-muted-foreground">Can't make it anymore? Call dispatch so they can reassign it.</p>}
        </ActionBar>
      )}
    </div>
  );
}

function StatusLine({ r }: { r: DeliveryRequest }) {
  const t = useT();
  if (r.status === "accepted")
    return (
      <div className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
        <CheckCircle2 className="size-4" /> {r.placeholder ? "On your usual route" : `${t("Accepted")} · dispatch can see it`}
      </div>
    );
  if (r.status === "declined")
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-[13px] font-semibold text-muted-foreground">
        <XCircle className="size-4" /> {t("Declined")}: {r.reason}
      </div>
    );
  return (
    <div className="flex items-center gap-2 rounded-xl bg-yellow-wash px-3 py-2.5 text-[13px] font-semibold text-teal-deep">
      <Clock className="size-4" /> {t("Pending")} · dispatch is waiting for your answer
    </div>
  );
}
