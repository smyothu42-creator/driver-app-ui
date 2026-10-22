import { useEffect, useRef, useState, type RefObject } from "react";
import { CalendarOff, Check, Hourglass, X } from "lucide-react";
import { useApp, useT } from "../store";
import { daysOf } from "./Schedule";
import { fmtTime, ROUTE_ISO, SETTINGS, type DeliveryRequest } from "../data/route";
import { addDays, dayOf, fromISO, monthGrid, toISO, type Availability, type DayAvailability } from "../data/availability";
import { ActionBar, Button, cn, Sheet, StopAvatar, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #76 Time off (out of office). Same look as the Schedule tab: mint header with one info card,
 * then a white page with the month calendar only (review Oct 22 2026: the Week / Month switch and the
 * week list felt clunky). Tap a day to pick it; tap a second day to make it a range (a week's holiday is
 * two taps, not five). A bar at the bottom says what's picked and what it affects, with one button,
 * "Request N days off", which goes straight to dispatch. Then Requested → Approved. Tapping a day already
 * off opens its sheet with the status.
 * Days that can't be requested (past, or inside SETTINGS.timeOffNoticeDays) are greyed out. #16: hours are set by dispatch, not here.
 * ------------------------------------------------------------------ */

const TODAY = fromISO(ROUTE_ISO);
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const isPast = (d: Date) => toISO(d) < ROUTE_ISO; // ISO strings sort chronologically
const FIRST_BOOKABLE = toISO(addDays(fromISO(ROUTE_ISO), SETTINGS.timeOffNoticeDays));
const isLocked = (d: Date) => toISO(d) < FIRST_BOOKABLE;
const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function AvailabilityScreen() {
  const { s, a } = useApp();
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  // The days being picked: one day, or a range once a second day is tapped.
  const [pick, setPick] = useState<{ from: string; to: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Accepted deliveries per day, so the sheet says what happens to them.
  const jobs: Record<string, DeliveryRequest[]> = {};
  for (const r of s.requests) if (r.status === "accepted" && !r.placeholder) for (const [iso] of daysOf(r)) (jobs[iso] ??= []).push(r);

  // Days in the pick that can still be requested (days already off are skipped).
  const picked: string[] = [];
  if (pick) for (let d = fromISO(pick.from); toISO(d) <= pick.to; d = addDays(d, 1)) if (!isLocked(d) && dayOf(s.availability, toISO(d)).status !== "unavailable") picked.push(toISO(d));
  const pickedJobs = picked.flatMap((iso) => jobs[iso] ?? []);

  const select = (iso: string) => {
    if (dayOf(s.availability, iso).status === "unavailable") return setOpen(iso);
    // First tap picks a day; a second tap on another day makes a range; the same day again clears it.
    if (!pick || pick.from !== pick.to) return setPick({ from: iso, to: iso });
    if (iso === pick.from) return setPick(null);
    setPick(iso > pick.from ? { from: pick.from, to: iso } : { from: iso, to: pick.from });
  };

  const request = () => {
    a.saveAvailability({ ...s.availability, ...Object.fromEntries(picked.map((iso) => [iso, { status: "unavailable" as const, requested: true }])) });
    setPick(null);
  };

  const booked = Object.entries(s.availability).filter(([iso, d]) => iso >= ROUTE_ISO && d.status === "unavailable");
  const waiting = booked.filter(([, d]) => d.requested).length;

  return (
    <div className="relative flex h-full flex-col bg-white">
      <TopBar title={t("Time off")} onBack={a.back} tone="hero" />

      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto overflow-x-clip bg-[#CFE8E8]">
        {/* Mint header with one info card, like Open hours on Schedule. */}
        <div className="bg-[#CFE8E8] px-4 pb-8 pt-1">
          <div className="flex h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4">
            <CalendarOff className="size-5 shrink-0 text-teal" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-muted-foreground">Book at least {SETTINGS.timeOffNoticeDays} days ahead</span>
              <span className="nums block text-[17px] font-semibold leading-tight">
                {booked.length ? `${booked.length} ${booked.length === 1 ? "day" : "days"} off${waiting ? ` · ${waiting} waiting` : ""}` : `First day: ${fmtDay(fromISO(FIRST_BOOKABLE))}`}
              </span>
            </span>
          </div>
        </div>

        {/* White panel tucked 16px into the mint header with a rounded top, same as the Schedule tab. */}
        <div className="relative z-[2] -mx-px -mt-4 w-[calc(100%+2px)] flex-1 rounded-t-[28px] border border-b-0 border-border-strong bg-white px-[17px] pb-8 pt-2">
          {/* Month only; it opens on the first month with a day you can request. */}
          <MonthScroll scrollRef={scrollRef} start={fromISO(FIRST_BOOKABLE)} days={s.availability} jobs={jobs} pick={pick} onSelect={select} />
        </div>
      </div>

      {pick && (
        <ActionBar>
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="nums block text-[17px] font-semibold leading-tight">
                {pick.from === pick.to ? fmtDay(fromISO(pick.from)) : `${fmtShort(fromISO(pick.from))} – ${fmtShort(fromISO(pick.to))}`}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                {pickedJobs.length ? `${pickedJobs.length} ${pickedJobs.length === 1 ? "delivery" : "deliveries"}` : "No deliveries"}
                {pick.from === pick.to && " · tap another day for a range"}
              </span>
            </span>
            <button onClick={() => setPick(null)} aria-label="Clear" className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-muted">
              <X className="size-5" />
            </button>
          </div>
          <Button size="lg" className="w-full" disabled={!picked.length} onClick={request}>
            <CalendarOff /> Request {picked.length} {picked.length === 1 ? "day" : "days"} off
          </Button>
        </ActionBar>
      )}

      {open && <DaySheet date={fromISO(open)} day={dayOf(s.availability, open)} jobs={jobs[open] ?? []} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Grey hourglass + "Requested" while dispatch decides, green check + "Approved" after. */
function OffStatus({ approved }: { approved: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-[13px] font-semibold", approved ? "text-success" : "text-muted-foreground")}>
      {approved ? <Check className="size-4" strokeWidth={3} /> : <Hourglass className="size-3.5" />}
      {approved ? "Approved" : "Requested"}
    </span>
  );
}

/** A day already off: its status and what's on it. Days are requested from the bar, not here. */
function DaySheet({ date, day, jobs, onClose }: { date: Date; day: DayAvailability; jobs: DeliveryRequest[]; onClose: () => void }) {
  const off = day.status === "unavailable";
  // Three deliveries, then "+N more" to see the rest (like the "+N" on the month grid).
  const [all, setAll] = useState(false);
  const sorted = [...jobs].sort((x, y) => x.time - y.time);
  const shown = all ? sorted : sorted.slice(0, 3);
  return (
    <Sheet title={fmtDay(date)} onClose={onClose}>
      <div className="-mt-2 mb-4 flex items-center justify-between gap-3">
        <span className="text-[15px] text-muted-foreground">{off ? "Time off" : "Available"}</span>
        {off && <OffStatus approved={!day.requested} />}
      </div>
      {off && jobs.length > 0 && (
        <p className="-mt-2 mb-3 text-[13px] text-muted-foreground">{day.requested ? "Still yours until dispatch approves and reassigns them." : "Dispatch is reassigning these."}</p>
      )}

      <div className="divide-y divide-border rounded-2xl border border-border-strong">
        {jobs.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">No deliveries this day</p>
        ) : (
          shown.map((r) => (
            <div key={r.id} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
              <StopAvatar stop={r} className="size-11 text-[15px]" />
              <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{r.name}</span>
              <span className="nums shrink-0 text-[15px] font-medium text-muted-foreground">{fmtTime(r.time)}</span>
            </div>
          ))
        )}
        {sorted.length > 3 && !all && (
          <button onClick={() => setAll(true)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-teal active:bg-muted/60">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-[15px] text-muted-foreground">+{sorted.length - 3}</span>
            {sorted.length - 3} more
          </button>
        )}
      </div>


      <div className="mt-5 space-y-2">
        <Button size="lg" variant="outline" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}

const MONTHS_AHEAD = 6;

type DayPick = { from: string; to: string } | null;

/**
 * Month view, like Apple Calendar: months stacked in one vertical scroll. Each month has one teal title
 * ("November 2026") with the weekday letters under it, pinned at the top while you're in that month
 * (review Oct 22 2026: no separate header with arrows).
 */
function MonthScroll({ scrollRef, start, days, jobs, pick, onSelect }: { scrollRef: RefObject<HTMLDivElement | null>; start: Date; days: Availability; jobs: Record<string, DeliveryRequest[]>; pick: DayPick; onSelect: (iso: string) => void }) {
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1));
  const sections = useRef<(HTMLElement | null)[]>([]);

  // Open on the month with the first day you can request.
  useEffect(() => {
    const el = scrollRef.current;
    const startIdx = Math.max(0, (start.getFullYear() - TODAY.getFullYear()) * 12 + start.getMonth() - TODAY.getMonth());
    const section = sections.current[startIdx];
    if (el && section && startIdx > 0) el.scrollTop += section.getBoundingClientRect().top - el.getBoundingClientRect().top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="-mx-4">
      {months.map((month, i) => (
        <section key={month.toISOString()} ref={(el) => { sections.current[i] = el; }}>
          <MonthGrid month={month} days={days} jobs={jobs} pick={pick} onSelect={onSelect} />
        </section>
      ))}
    </div>
  );
}

/**
 * One month, iPhone Calendar style: a big teal month heading, a hairline above every
 * week, tall cells with the date on top, today in a filled circle, weekends in grey. Days you can't request
 * are faded and can't be tapped. Under the date, one bar per item (two at most, then "+N"), like events:
 * green = a delivery; on a day off every bar is grey (lighter while it's requested): the time off first, then that day's deliveries.
 */
function MonthGrid({ month, days, jobs, pick, onSelect }: { month: Date; days: Availability; jobs: Record<string, DeliveryRequest[]>; pick: DayPick; onSelect: (iso: string) => void }) {
  const cells = monthGrid(month.getFullYear(), month.getMonth());
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <div className="pb-2">
      {/* Month title and weekday letters, pinned while this month is on screen; the next month's pushes it up. */}
      <div className="sticky top-0 z-10 bg-white">
        <h3 className="px-5 pb-2 pt-4 text-2xl font-bold leading-tight tracking-tight text-teal">
          {month.toLocaleDateString("en-US", { month: "long" })} <span className="font-medium text-teal/60">{month.getFullYear()}</span>
        </h3>
        <div className="grid grid-cols-7 border-b border-border px-2 pb-1.5 text-center text-2xs font-semibold uppercase text-muted-foreground">
          {WEEK_LETTERS.map((w, k) => (
            <span key={k} className={cn(k >= 5 && "opacity-60")}>
              {w}
            </span>
          ))}
        </div>
      </div>
      {weeks.map((week, w) => (
        <div key={w} className="grid grid-cols-7 border-t border-border px-2">
          {week.map((d, i) => {
            if (!d) return <span key={i} className="h-[76px]" />;
            const iso = toISO(d);
            const day = dayOf(days, iso);
            const off = day.status === "unavailable";
            const past = isPast(d);
            const today = iso === ROUTE_ISO;
            // Can't request: past, or inside the notice window (unless it's already off, so its status can be seen).
            const disabled = past || (isLocked(d) && !off);
            // Picked: the ends get a filled circle, the days between a light band joining them.
            const inPick = !!pick && iso >= pick.from && iso <= pick.to;
            const end = !!pick && (iso === pick.from || iso === pick.to);
            // A day off still shows its deliveries, but every bar turns grey (lighter while it's requested).
            const grey = day.requested ? "bg-border-strong" : "bg-control";
            const bars: string[] = off ? [grey, ...(jobs[iso] ?? []).map(() => grey)] : (jobs[iso] ?? []).map(() => "bg-success");
            return (
              <button
                key={iso}
                disabled={disabled}
                onClick={() => onSelect(iso)}
                aria-label={`${fmtDay(d)}: ${off ? (day.requested ? "time off requested" : "time off") : "available"}${jobs[iso]?.length ? `, ${jobs[iso].length} deliveries` : ""}`}
                className="group flex h-[76px] min-w-0 flex-col items-center pt-1.5 disabled:cursor-not-allowed"
              >
                <span className="relative flex w-full justify-center">
                  {/* Range band, iOS style: it runs from the centre of the first circle to the centre of the last, so the
                      circles cap it. Where it breaks at the end of a week or month, its edge is rounded. */}
                  {inPick && pick!.from !== pick!.to && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 bg-coral-soft",
                        iso === pick!.from ? "left-1/2" : "left-0",
                        iso === pick!.to ? "right-1/2" : "right-0",
                        (i === 0 || d.getDate() === 1) && iso !== pick!.from && "rounded-l-full",
                        (i === 6 || addDays(d, 1).getMonth() !== d.getMonth()) && iso !== pick!.to && "rounded-r-full",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "nums relative grid size-8 place-items-center rounded-full text-[17px]",
                      end ? "bg-coral font-semibold text-white" : today ? "bg-teal-deep font-semibold text-white" : disabled ? "text-muted-foreground/35" : cn("group-active:bg-muted", i >= 5 ? "text-muted-foreground" : "text-foreground"),
                    )}
                  >
                    {d.getDate()}
                  </span>
                </span>
                <span className={cn("mt-1.5 flex w-full flex-col gap-[3px] px-1", disabled && "opacity-35")}>
                  {bars.slice(0, 2).map((c, k) => (
                    <span key={k} className={cn("h-[5px] w-full rounded-full", c)} />
                  ))}
                  {bars.length > 2 && <span className="nums text-center text-2xs leading-3 text-muted-foreground">+{bars.length - 2}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
