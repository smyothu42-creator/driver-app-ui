import { useEffect, useRef, useState, type RefObject } from "react";
import { CalendarOff, Check, ChevronLeft, ChevronRight, Hourglass } from "lucide-react";
import { useApp, useT } from "../store";
import { daysOf } from "./Schedule";
import { fmtTime, ROUTE_ISO, SETTINGS, type DeliveryRequest } from "../data/route";
import { addDays, dayOf, fromISO, monthGrid, startOfWeek, toISO, type Availability, type DayAvailability } from "../data/availability";
import { Button, cn, Sheet, StopAvatar, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #76 Time off (out of office). Same look as the Schedule tab: mint header with one info card,
 * then a white page with the pill switch and a full-width day list (date bands, a line between rows).
 * Tap a day → a sheet with that day's details and one button, "Request day off", which goes straight
 * to dispatch (no checkboxes, no send-all button). Then Requested → Approved.
 * Days that can't be requested (past, or inside SETTINGS.timeOffNoticeDays) are left out of Week and greyed out in Month. #16: hours are set by dispatch, not here.
 * ------------------------------------------------------------------ */

const TODAY = fromISO(ROUTE_ISO);
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const isPast = (d: Date) => toISO(d) < ROUTE_ISO; // ISO strings sort chronologically
const FIRST_BOOKABLE = toISO(addDays(fromISO(ROUTE_ISO), SETTINGS.timeOffNoticeDays));
const isLocked = (d: Date) => toISO(d) < FIRST_BOOKABLE;
const FIRST_WEEK = startOfWeek(fromISO(FIRST_BOOKABLE));
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function AvailabilityScreen() {
  const { s, a } = useApp();
  const t = useT();
  const [view, setView] = useState<"week" | "month">("week");
  // Week opens on the first week with a day you can request.
  const [anchor, setAnchor] = useState(fromISO(FIRST_BOOKABLE));
  const [open, setOpen] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Accepted deliveries per day, so the sheet says what happens to them.
  const jobs: Record<string, DeliveryRequest[]> = {};
  for (const r of s.requests) if (r.status === "accepted" && !r.placeholder) for (const [iso] of daysOf(r)) (jobs[iso] ??= []).push(r);

  const request = (iso: string) => {
    a.saveAvailability({ ...s.availability, [iso]: { status: "unavailable", requested: true } });
    setOpen(null);
  };

  const booked = Object.entries(s.availability).filter(([iso, d]) => iso >= ROUTE_ISO && d.status === "unavailable");
  const waiting = booked.filter(([, d]) => d.requested).length;

  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  // Week list: only days you can request, plus days already off (so their status still shows).
  const weekDays = week.filter((d) => !isPast(d) && (!isLocked(d) || dayOf(s.availability, toISO(d)).status === "unavailable"));
  const rangeLabel = `${week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week[6].toLocaleDateString("en-US", week[0].getMonth() === week[6].getMonth() ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
  const shift = (dir: 1 | -1) => setAnchor(addDays(anchor, 7 * dir));
  const backDisabled = week[0] <= FIRST_WEEK;

  return (
    <div className="relative flex h-full flex-col bg-white">
      <TopBar title={t("Time off")} onBack={a.back} tone="hero" />

      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto overflow-x-clip bg-[#CFE8E8]">
        {/* Mint header with one info card, like Open hours on Schedule. */}
        <div className="bg-[#CFE8E8] px-4 pb-8 pt-1">
          <div className="flex h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4">
            <CalendarOff className="size-5 shrink-0 text-teal" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-muted-foreground">Book at least {SETTINGS.timeOffNoticeDays} days ahead</span>
              <span className="nums block text-[17px] font-semibold leading-tight">
                {booked.length ? `${booked.length} ${booked.length === 1 ? "day" : "days"} off${waiting ? ` · ${waiting} waiting` : ""}` : `First day: ${fmtDay(fromISO(FIRST_BOOKABLE))}`}
              </span>
            </span>
          </div>
        </div>

        {/* White panel tucked 16px into the mint header with a rounded top, same as the Schedule tab. */}
        <div className="relative z-[2] -mx-px -mt-4 w-[calc(100%+2px)] flex-1 rounded-t-[28px] border border-b-0 border-border-strong bg-white px-[17px] pb-8 pt-5">
          {/* Same pill switch as the Schedule tabs. */}
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("h-11 rounded-full text-[14px] font-semibold capitalize", view === v ? "bg-card text-teal-deep shadow-card" : "text-muted-foreground")}
              >
                {v}
              </button>
            ))}
          </div>

          {view === "week" ? (
            <>
              {/* Week: round arrow buttons inside wide tap areas (64 × 48), at the edges. */}
              <div className="-mx-2 mt-3 flex items-center justify-between">
                <button aria-label={`Previous ${view}`} disabled={backDisabled} onClick={() => shift(-1)} className="group flex h-12 w-16 items-center justify-start pl-2 text-teal-deep disabled:opacity-30">
                  <span className="grid size-10 place-items-center rounded-full border border-border-strong bg-white group-active:bg-muted">
                    <ChevronLeft className="size-5" />
                  </span>
                </button>
                <span className="nums text-[15px] font-semibold">{rangeLabel}</span>
                <button aria-label={`Next ${view}`} onClick={() => shift(1)} className="group flex h-12 w-16 items-center justify-end pr-2 text-teal-deep">
                  <span className="grid size-10 place-items-center rounded-full border border-border-strong bg-white group-active:bg-muted">
                    <ChevronRight className="size-5" />
                  </span>
                </button>
              </div>
              <div className="-mx-4 mt-2 border-b border-border">
                {weekDays.map((d) => {
                  const iso = toISO(d);
                  return <DayRow key={iso} date={d} day={dayOf(s.availability, iso)} jobs={jobs[iso]?.length ?? 0} onOpen={() => setOpen(iso)} />;
                })}
              </div>
            </>
          ) : (
            <MonthScroll scrollRef={scrollRef} start={anchor} days={s.availability} jobs={jobs} onSelect={setOpen} />
          )}
        </div>
      </div>

      {open && <DaySheet date={fromISO(open)} day={dayOf(s.availability, open)} jobs={jobs[open] ?? []} onRequest={() => request(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One day: grey date band, then a white row you tap to open the day's sheet. Time off shows Requested / Approved on the right. */
function DayRow({ date, day, jobs, onOpen }: { date: Date; day: DayAvailability; jobs: number; onOpen: () => void }) {
  const iso = toISO(date);
  const off = day.status === "unavailable";
  return (
    <div>
      <div className="border-t border-border bg-muted/60 px-4 py-2 text-[13px] font-semibold text-muted-foreground">
        {iso === ROUTE_ISO ? `Today · ${fmtDay(date)}` : fmtDay(date)}
      </div>
      <button onClick={onOpen} className="flex min-h-14 w-full items-center gap-3 border-t border-border px-4 py-2 text-left active:bg-muted/60">
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[16px] font-semibold", off && "text-muted-foreground")}>{off ? "Time off" : "Available"}</span>
          {!off && jobs > 0 && <span className="block truncate text-[13px] text-muted-foreground">{jobs === 1 ? "1 delivery" : `${jobs} deliveries`}</span>}
        </span>
        {off ? <OffStatus approved={!day.requested} /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>
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

/** The day's details and one action: "Request day off" (only opened for days you can request, or days already off). */
function DaySheet({ date, day, jobs, onRequest, onClose }: { date: Date; day: DayAvailability; jobs: DeliveryRequest[]; onRequest: () => void; onClose: () => void }) {
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

      <div className="divide-y divide-border rounded-2xl border border-border-strong">
        {jobs.length === 0 ? (
          <p className="px-4 py-4 text-[16px] text-muted-foreground">No deliveries this day</p>
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
          <button onClick={() => setAll(true)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left text-[16px] font-semibold text-teal active:bg-muted/60">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-[14px] text-muted-foreground">+{sorted.length - 3}</span>
            {sorted.length - 3} more
          </button>
        )}
      </div>


      <div className="mt-5 space-y-2">
        {!off && (
          <Button size="lg" className="w-full" onClick={onRequest}>
            <CalendarOff /> Request day off
          </Button>
        )}
        <Button size="lg" variant="outline" className="w-full" onClick={onClose}>
          {off ? "Done" : "Cancel"}
        </Button>
      </div>
    </Sheet>
  );
}

const MONTHS_AHEAD = 6;

/**
 * Month view, like Apple Calendar: months stacked in one vertical scroll. A sticky header (month name,
 * arrows, weekday letters) follows the month at the top; the arrows scroll to the previous / next month.
 */
function MonthScroll({ scrollRef, start, days, jobs, onSelect }: { scrollRef: RefObject<HTMLDivElement | null>; start: Date; days: Availability; jobs: Record<string, DeliveryRequest[]>; onSelect: (iso: string) => void }) {
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1));
  const header = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);

  // Distance from the bottom of the sticky header to a month's top (≤ 0 once it has reached the header).
  const offset = (i: number) => (sections.current[i]?.getBoundingClientRect().top ?? 0) - (header.current?.getBoundingClientRect().bottom ?? 0);
  const goTo = (i: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollTop + offset(i), behavior });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      let i = 0;
      while (i + 1 < months.length && offset(i + 1) <= 1) i++;
      setCurrent(i);
    };
    // Open on the month the week view was showing.
    const startIdx = Math.max(0, (start.getFullYear() - TODAY.getFullYear()) * 12 + start.getMonth() - TODAY.getMonth());
    if (startIdx > 0) goTo(startIdx, "auto");
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = months[current];
  return (
    <div className="-mx-4">
      <div ref={header} className="sticky top-0 z-10 bg-white pt-3">
        <div className="flex items-center justify-between gap-3 px-5">
          <span className="text-[22px] font-bold leading-tight tracking-tight">
            {m.toLocaleDateString("en-US", { month: "long" })} <span className="font-medium text-muted-foreground">{m.getFullYear()}</span>
          </span>
          <span className="flex items-center gap-1">
            <button aria-label="Previous month" disabled={current === 0} onClick={() => goTo(current - 1)} className="grid size-11 place-items-center rounded-full text-teal-deep active:bg-muted disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <button aria-label="Next month" disabled={current === months.length - 1} onClick={() => goTo(current + 1)} className="grid size-11 place-items-center rounded-full text-teal-deep active:bg-muted disabled:opacity-30">
              <ChevronRight className="size-5" />
            </button>
          </span>
        </div>
        <div className="mt-1 grid grid-cols-7 border-b border-border px-2 pb-1.5 text-center text-[11px] font-semibold uppercase text-muted-foreground">
          {WEEK_LETTERS.map((w, i) => (
            <span key={i} className={cn(i >= 5 && "opacity-60")}>
              {w}
            </span>
          ))}
        </div>
      </div>
      {months.map((month, i) => (
        <section key={month.toISOString()} ref={(el) => { sections.current[i] = el; }}>
          <MonthGrid month={month} days={days} jobs={jobs} onSelect={onSelect} />
        </section>
      ))}
    </div>
  );
}

/**
 * One month, iPhone Calendar style: a big teal month heading, a hairline above every
 * week, tall cells with the date on top, today in a filled circle, weekends in grey. Days you can't request
 * are faded and can't be tapped. Under the date, one bar per item (two at most, then "+N"), like events:
 * green = a delivery; grey = time off (lighter while it's requested).
 */
function MonthGrid({ month, days, jobs, onSelect }: { month: Date; days: Availability; jobs: Record<string, DeliveryRequest[]>; onSelect: (iso: string) => void }) {
  const cells = monthGrid(month.getFullYear(), month.getMonth());
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <div className="pb-2">
      {/* Month heading: left-aligned with the header title, big and teal so each month stands out. */}
      <h3 className="px-5 pb-2 pt-5 text-[24px] font-bold leading-tight tracking-tight text-teal">{month.toLocaleDateString("en-US", { month: "long" })}</h3>
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
            const bars: string[] = off ? [day.requested ? "bg-border-strong" : "bg-control"] : (jobs[iso] ?? []).map(() => "bg-success");
            return (
              <button
                key={iso}
                disabled={disabled}
                onClick={() => onSelect(iso)}
                aria-label={`${fmtDay(d)}: ${off ? (day.requested ? "time off requested" : "time off") : "available"}${jobs[iso]?.length ? `, ${jobs[iso].length} deliveries` : ""}`}
                className="group flex h-[76px] min-w-0 flex-col items-center pt-1.5 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "nums grid size-8 place-items-center rounded-full text-[17px]",
                    today ? "bg-teal-deep font-semibold text-white" : disabled ? "text-muted-foreground/35" : cn("group-active:bg-muted", i >= 5 ? "text-muted-foreground" : "text-foreground"),
                  )}
                >
                  {d.getDate()}
                </span>
                <span className={cn("mt-1.5 flex w-full flex-col gap-[3px] px-1", disabled && "opacity-35")}>
                  {bars.slice(0, 2).map((c, k) => (
                    <span key={k} className={cn("h-[5px] w-full rounded-full", c)} />
                  ))}
                  {bars.length > 2 && <span className="nums text-center text-[10px] leading-3 text-muted-foreground">+{bars.length - 2}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
