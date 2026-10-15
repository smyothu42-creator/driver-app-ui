import { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useApp, useT } from "../store";
import { ROUTE_ISO, SETTINGS, fmtTime } from "../data/route";
import {
  DEFAULT_HOURS,
  TIME_OPTIONS,
  addDays,
  dayOf,
  fromISO,
  monthGrid,
  startOfWeek,
  toISO,
  type Availability,
  type DayAvailability,
  type DayStatus,
} from "../data/availability";
import { ActionBar, Badge, Button, Card, cn, SectionLabel, TopBar } from "../components/ui";

const TODAY = fromISO(ROUTE_ISO);
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
/**
 * #76: drivers book out of office, at least SETTINGS.timeOffNoticeDays ahead.
 * #16: working hours are set by dispatch (Schedule tab), so the driver no longer sets hours per day.
 * "custom" days saved before this change still render, read-only.
 */
const STATUS_OPTS: { v: DayStatus; label: string }[] = [
  { v: "available", label: "Working" },
  { v: "unavailable", label: "Time off" },
];

const isPast = (d: Date) => toISO(d) < ROUTE_ISO; // ISO strings sort chronologically
const FIRST_BOOKABLE = toISO(addDays(fromISO(ROUTE_ISO), SETTINGS.timeOffNoticeDays));
const isLocked = (d: Date) => toISO(d) < FIRST_BOOKABLE;
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** US-813: the driver marks days and hours they can work. Week view by default, month on toggle. */
export function AvailabilityScreen() {
  const { s, a } = useApp();
  const t = useT();
  // Edits stay in a local draft until Save, so dispatch never sees a half-finished week.
  const [draft, setDraft] = useState<Availability>(s.availability);
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(TODAY);
  const [selected, setSelected] = useState(ROUTE_ISO);

  const dirty = JSON.stringify(draft) !== JSON.stringify(s.availability);

  const setDay = (iso: string, day: DayAvailability) =>
    setDraft((prev) => {
      const next = { ...prev };
      // "Available" is the default, so drop the key instead of storing it: keeps the record sparse.
      if (day.status === "available") delete next[iso];
      else next[iso] = day;
      return next;
    });

  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const rangeLabel =
    view === "week"
      ? `${week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week[6].toLocaleDateString("en-US", week[0].getMonth() === week[6].getMonth() ? { day: "numeric" } : { month: "short", day: "numeric" })}`
      : anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const shift = (dir: 1 | -1) => {
    const next = view === "week" ? addDays(anchor, 7 * dir) : new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
    setAnchor(next);
    if (view === "month") setSelected(toISO(next.getMonth() === TODAY.getMonth() && next.getFullYear() === TODAY.getFullYear() ? TODAY : next));
  };
  const backDisabled = view === "week" ? week[0] <= startOfWeek(TODAY) : anchor.getFullYear() === TODAY.getFullYear() && anchor.getMonth() <= TODAY.getMonth();
  // Based on saved data, not the draft: hiding the banner mid-edit would shift the list under the driver's finger.
  const restricted = Object.keys(s.availability).filter((k) => k >= ROUTE_ISO).length;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t("Time off")} subtitle={`Book at least ${SETTINGS.timeOffNoticeDays} days ahead`} onBack={a.back} />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {restricted === 0 && (
          <div className="flex gap-2.5 rounded-xl border border-teal-soft bg-teal-wash p-3 text-[13px] text-teal-deep">
            <CalendarCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              <b className="font-semibold">No time off requested.</b> Mark days you need off from {fmtDay(fromISO(FIRST_BOOKABLE))}. Dispatch confirms each request.
            </span>
          </div>
        )}

        {/* View toggle */}
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                if (v === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
              }}
              className={cn("h-11 rounded-full text-sm font-semibold capitalize", view === v ? "bg-card text-teal-deep shadow-card" : "text-muted-foreground")}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Range navigation */}
        <div className="flex items-center justify-between">
          <button aria-label={`Previous ${view}`} disabled={backDisabled} onClick={() => shift(-1)} className="grid size-11 place-items-center rounded-full border border-control bg-card disabled:opacity-40">
            <ChevronLeft className="size-5" />
          </button>
          <span className="nums font-semibold">{rangeLabel}</span>
          <button aria-label={`Next ${view}`} onClick={() => shift(1)} className="grid size-11 place-items-center rounded-full border border-control bg-card">
            <ChevronRight className="size-5" />
          </button>
        </div>

        {view === "week" ? (
          <Card className="divide-y divide-border overflow-hidden">
            {week.map((d) => {
              const iso = toISO(d);
              return <WeekDayRow key={iso} date={d} day={dayOf(draft, iso)} onChange={(day) => setDay(iso, day)} />;
            })}
          </Card>
        ) : (
          <>
            <MonthView month={anchor} draft={draft} selected={selected} onSelect={setSelected} />
            <section>
              <SectionLabel>{fmtDay(fromISO(selected))}</SectionLabel>
              <Card className="p-3">
                {isLocked(fromISO(selected)) ? <LockedNote /> : <DayEditor day={dayOf(draft, selected)} onChange={(day) => setDay(selected, day)} />}
              </Card>
            </section>
          </>
        )}
      </div>

      <ActionBar>
        <Button size="lg" className="w-full" disabled={!dirty} onClick={() => a.saveAvailability(draft)}>
          {dirty ? "Request time off" : "Time off up to date"}
        </Button>
      </ActionBar>
    </div>
  );
}

function WeekDayRow({ date, day, onChange }: { date: Date; day: DayAvailability; onChange: (d: DayAvailability) => void }) {
  const past = isPast(date);
  const off = day.status === "unavailable";
  return (
    <div className={cn("space-y-2 p-3", off && "bg-muted/70", past && "opacity-50")}>
      <div className="flex items-center gap-2">
        <span className={cn("font-semibold", off && "text-muted-foreground line-through")}>{fmtDay(date)}</span>
        {toISO(date) === ROUTE_ISO && <Badge tone="teal">Today</Badge>}
        {off && <Badge tone={day.requested ? "warning" : "success"}>{day.requested ? "Requested" : "Approved"}</Badge>}
        {day.status === "custom" && (
          <span className="nums ml-auto text-2xs font-semibold text-teal">
            {fmtTime(day.start!)} – {fmtTime(day.end!)}
          </span>
        )}
      </div>
      {past ? <p className="text-2xs text-muted-foreground">Past days can't be changed</p> : isLocked(date) ? <LockedNote /> : <DayEditor day={day} onChange={onChange} />}
    </div>
  );
}

function MonthView({ month, draft, selected, onSelect }: { month: Date; draft: Availability; selected: string; onSelect: (iso: string) => void }) {
  return (
    <Card className="p-3">
      <div className="mb-1 grid grid-cols-7 text-center text-2xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(month.getFullYear(), month.getMonth()).map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toISO(d);
          const day = dayOf(draft, iso);
          const past = isPast(d);
          return (
            <button
              key={iso}
              disabled={past}
              data-locked={isLocked(d) || undefined}
              onClick={() => onSelect(iso)}
              aria-pressed={iso === selected}
              aria-label={`${fmtDay(d)}: ${day.status === "custom" ? `${fmtTime(day.start!)} to ${fmtTime(day.end!)}` : day.status}`}
              className={cn(
                "nums relative flex h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold",
                day.status === "unavailable" ? "bg-muted text-muted-foreground line-through" : "bg-card",
                iso === ROUTE_ISO && "text-teal",
                !past && isLocked(d) && "bg-muted/50 text-muted-foreground",
                iso === selected && "ring-2 ring-teal",
                past && "opacity-35",
              )}
            >
              {d.getDate()}
              {day.status === "custom" && <span className="absolute bottom-1 size-1.5 rounded-full bg-teal" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        <span>
          <b className="font-semibold text-foreground">12</b> Working
        </span>
        <span>
          <span className="rounded bg-muted px-1 line-through">12</span> Time off
        </span>
        <span className="flex items-center gap-1">
          <Lock className="size-3" /> Less than {SETTINGS.timeOffNoticeDays} days away
        </span>
      </div>
    </Card>
  );
}

/** Status segment + optional time window. Shared by week rows and the month view's day editor. */
function DayEditor({ day, onChange }: { day: DayAvailability; onChange: (d: DayAvailability) => void }) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" className="grid grid-cols-2 gap-1">
        {STATUS_OPTS.map((o) => (
          <button
            key={o.v}
            role="radio"
            aria-checked={day.status === o.v}
            // New time off starts as a request; picking the option that's already on changes nothing.
            onClick={() => day.status !== o.v && onChange(o.v === "custom" ? { status: "custom", start: day.start ?? DEFAULT_HOURS.start, end: day.end ?? DEFAULT_HOURS.end } : o.v === "unavailable" ? { status: "unavailable", requested: true } : { status: o.v })}
            className={cn(
              "h-11 rounded-xl border text-[13px] font-semibold",
              day.status === o.v ? (o.v === "unavailable" ? "border-foreground/30 bg-muted text-foreground" : "border-teal bg-teal-wash text-teal-deep") : "border-control bg-card text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {day.status === "custom" && <TimeWindowPicker start={day.start!} end={day.end!} onChange={(start, end) => onChange({ status: "custom", start, end })} />}
    </div>
  );
}

function TimeWindowPicker({ start, end, onChange }: { start: number; end: number; onChange: (start: number, end: number) => void }) {
  const select = "nums h-11 w-full rounded-xl border border-control bg-card px-3 text-sm font-semibold outline-none focus:border-teal focus:ring-2 focus:ring-teal/30";
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-2xs font-semibold text-muted-foreground">
        From
        <select
          className={cn(select, "mt-1")}
          value={start}
          // Moving the start past the end pushes the end out an hour so the window is never empty.
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v, end > v ? end : Math.min(v + 60, TIME_OPTIONS[TIME_OPTIONS.length - 1]));
          }}
        >
          {TIME_OPTIONS.slice(0, -1).map((t) => (
            <option key={t} value={t}>
              {fmtTime(t)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-2xs font-semibold text-muted-foreground">
        To
        <select className={cn(select, "mt-1")} value={end} onChange={(e) => onChange(start, Number(e.target.value))}>
          {TIME_OPTIONS.filter((t) => t > start).map((t) => (
            <option key={t} value={t}>
              {fmtTime(t)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function LockedNote() {
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Lock className="size-3.5 shrink-0" /> Less than {SETTINGS.timeOffNoticeDays} days away. Call dispatch to change it.
    </p>
  );
}
