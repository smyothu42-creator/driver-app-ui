import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, Check, ChevronLeft, ChevronRight, Clock, Headphones, Inbox, LayoutList, MessageSquare, Minimize2, Phone, RotateCcw, Search, UserX, Users, X } from "lucide-react";
import { routeOf, useApp } from "../store";
import { DISPATCH, DRIVER, OPEN_POOL, ROUTE_DATE, SETTINGS, fmtTime, fmtWindow, workOf, type Stop, type StopStatus, type Work } from "../data/route";
import { FLEET, FLEET_ALERTS, FLEET_STOPS, UNCOVERED, type Duty } from "../data/fleet";
import { hoursUntil } from "../screens/Schedule";
import { isOn } from "../data/sprints";
import { AssignmentPanel, DriverProfile, DriverRequests, OpenHoursEditor, SkipRequests, TimeOffRequests, TodayChanges, UnassignedOrders } from "./DispatchBoard";
import { cn, STATUS_META, WorkTags } from "./ui";

/* ------------------------------------------------------------------
 * Full-screen dispatch board (SFK Admin), Nov 4 2026.
 *
 * Review: "make the dispatch full view understandable, use the Google Material design system, and have all the
 * functions of the side panel too". So it's Material 3 (Roboto, tonal surfaces from SFK teal, a navigation rail,
 * filled / tonal / outlined buttons, filter chips, cards), and it's split into four plain-language destinations:
 *   Board            today's deliveries: summary cards that filter the table, the table, and a side sheet
 *                    ("Needs your attention", or the delivery / driver you picked)
 *   Requests         everything waiting on an answer: alerts, requests to drivers, orders with no driver,
 *                    pickup skip requests, time off
 *   Drivers          every driver as a card; pick one for their day, requests, hours and vehicle
 *   Hours & vehicle  open hours, time off, duty and storage details (the side panel's settings)
 * Every page says in one line what it's for. Marcus is live (shared with the phone); the rest of the fleet is demo
 * data from src/data/fleet.ts.
 * ------------------------------------------------------------------ */

/* Material 3 tonal palette from SFK teal (#007078), with SFK coral as the tertiary colour. */
const M = {
  primary: "#006A6F",
  onPrimary: "#FFFFFF",
  primaryContainer: "#B4ECEF",
  onPrimaryContainer: "#002022",
  secondaryContainer: "#CCE8E8",
  onSecondaryContainer: "#051F20",
  tertiaryContainer: "#FFDBCC",
  onTertiaryContainer: "#351000",
  error: "#BA1A1A",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  warnContainer: "#FFDEA3",
  onWarnContainer: "#5C4300",
  successContainer: "#B5F0C2",
  onSuccessContainer: "#00210B",
  surface: "#F5FAF9",
  surfaceLow: "#EFF5F4",
  surfaceContainer: "#E9EFEE",
  surfaceHigh: "#E3E9E8",
  onSurface: "#171D1D",
  onSurfaceVariant: "#3F4948",
  outline: "#6F7978",
  outlineVariant: "#BFC8C7",
};
const ROBOTO = { fontFamily: '"Roboto", system-ui, sans-serif' } as const;

type RowStatus = StopStatus | "unassigned";
interface Row {
  id: string;
  orderNo: string;
  name: string;
  area: string;
  windowStart: number;
  windowEnd: number;
  work: Work[];
  meals: number;
  driverIds: string[];
  status: RowStatus;
  eta?: number;
  lateBy?: number;
  issue?: string;
  /** The real Stop when it's one of Marcus's (or an open order): those use the shared state and actions. */
  live?: Stop;
  requestStatus?: string;
}

interface Person {
  id: string;
  name: string;
  first: string;
  initials: string;
  type: string;
  duty: Duty;
  vehicle: string;
  phone: string;
  live?: boolean;
}

interface Alert {
  id: string;
  driverId?: string;
  stopId?: string;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  action?: { label: string; run: () => void };
}

type Filter = "all" | "attention" | "unassigned" | "late" | "active" | "done";
const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: "all", label: "All deliveries", hint: "Everything today" },
  { key: "attention", label: "Need you", hint: "Late, a problem, or no driver" },
  { key: "unassigned", label: "No driver", hint: "Waiting for someone" },
  { key: "late", label: "Running late", hint: "Past the window" },
  { key: "active", label: "On the way", hint: "Driving or on site" },
  { key: "done", label: "Done", hint: "Delivered or cancelled" },
];

type Page = "board" | "requests" | "drivers" | "hours";

const needsAttention = (r: Row) => r.status === "unassigned" || r.status === "issue" || !!r.lateBy;
const matches = (r: Row, f: Filter) =>
  f === "all" ? true : f === "attention" ? needsAttention(r) : f === "unassigned" ? r.status === "unassigned" : f === "late" ? !!r.lateBy : f === "active" ? r.status === "en_route" || r.status === "arrived" : r.status === "delivered" || r.status === "cancelled";
const finished = (r: Row) => r.status === "delivered" || r.status === "cancelled";

export function DispatchDesk({ onClose }: { onClose: () => void }) {
  const { s, a } = useApp();
  const [page, setPage] = useState<Page>("board");
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<"time" | "driver">("time");
  const [query, setQuery] = useState("");
  const [driverId, setDriverId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  // Demo-only changes to the fixed fleet: reassigned stops and alerts dispatch has dealt with.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const people: Person[] = useMemo(
    () => [
      { id: DRIVER.id, name: DRIVER.name, first: DRIVER.first, initials: DRIVER.initials, type: DRIVER.type, duty: !s.signedIn || !s.shiftOn ? "off" : "on", vehicle: `${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}`, phone: DRIVER.phone, live: true },
      ...FLEET,
    ],
    [s.signedIn, s.shiftOn, s.vehicle],
  );
  const person = (id: string) => people.find((p) => p.id === id);

  /* ---------- every delivery of the day, one shape ---------- */
  const rows: Row[] = useMemo(() => {
    const mine: Row[] = routeOf(s).map((x) => {
      const st = s.stops[x.id];
      const open = st.status !== "delivered" && st.status !== "cancelled";
      const lateBy = open && s.clock > x.windowEnd ? s.clock - x.windowEnd : undefined;
      return { id: x.id, orderNo: x.orderNo, name: x.name, area: x.addressLine1, windowStart: x.windowStart, windowEnd: x.windowEnd, work: workOf(x), meals: x.meals, driverIds: (s.assignments[x.id] ?? [{ userId: DRIVER.id }]).map((y) => y.userId), status: st.status, lateBy, issue: st.issue, live: x };
    });
    const pool: Row[] = OPEN_POOL.filter((o) => !s.claims[o.id] || s.claims[o.id].by !== DRIVER.id).map((o) => {
      const claim = s.claims[o.id];
      const req = s.requests.find((r) => r.orderId === o.id);
      return {
        id: o.id,
        orderNo: o.orderNo,
        name: o.name,
        area: o.addressLine1,
        windowStart: o.windowStart,
        windowEnd: o.windowEnd,
        work: workOf(o),
        meals: o.meals,
        driverIds: claim ? [claim.by] : moved[o.id] ? [moved[o.id]] : [],
        status: claim || moved[o.id] ? "queued" : "unassigned",
        live: o,
        requestStatus: req ? (req.status === "pending" ? `Sent to ${DRIVER.first} · waiting` : req.status === "declined" ? `${DRIVER.first} declined` : undefined) : undefined,
      };
    });
    const fleet: Row[] = FLEET_STOPS.map((x) => {
      const to = moved[x.id];
      const uncovered = UNCOVERED.has(x.id) && !to;
      const lateBy = x.eta && x.eta > x.windowEnd ? x.eta - x.windowEnd : undefined;
      return { ...x, driverIds: uncovered ? [] : [to ?? x.driverId], status: uncovered ? "unassigned" : x.status, lateBy };
    });
    return [...mine, ...pool, ...fleet].sort((x, y) => x.windowStart - y.windowStart || x.name.localeCompare(y.name));
  }, [s, moved]);
  const row = (id: string) => rows.find((r) => r.id === id);

  /* ---------- what needs dispatch, across all drivers ---------- */
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];
    for (const r of rows) {
      if (r.status === "issue" && r.live) list.push({ id: `issue-${r.id}`, driverId: r.driverIds[0], stopId: r.id, tone: "danger", title: `${person(r.driverIds[0])?.first ?? "Driver"} · problem at ${r.name}`, detail: r.issue ? `“${r.issue}”` : "Reported from the app", action: { label: "Open delivery", run: () => openStop(r.id) } });
      else if (r.lateBy && r.live) list.push({ id: `late-${r.id}`, driverId: r.driverIds[0], stopId: r.id, tone: "danger", title: `${person(r.driverIds[0])?.first} · ${r.lateBy} min late`, detail: `${r.name} · window ended ${fmtTime(r.windowEnd)}`, action: { label: "Give +20 min", run: () => a.changeTime(r.id, 20) } });
      else if (r.status === "unassigned" && r.live) list.push({ id: `open-${r.id}`, stopId: r.id, tone: "warning", title: `No driver · ${r.name}`, detail: `${fmtWindow(r.windowStart, r.windowEnd)}${r.requestStatus ? ` · ${r.requestStatus}` : ""}`, action: r.requestStatus ? undefined : { label: `Send to ${DRIVER.first}`, run: () => a.sendOrderRequest(r.id) } });
    }
    for (const r of s.requests) {
      if (r.orderId) continue;
      if (r.status === "pending" && hoursUntil(r, s.clock) <= SETTINGS.requestFlagHours) list.push({ id: `req-${r.id}`, driverId: DRIVER.id, tone: "danger", title: `${DRIVER.first} hasn't answered · under 48 h`, detail: `${r.dateLabel} · ${r.name}`, action: { label: "Remind", run: a.remindRequests } });
      if (r.status === "declined") list.push({ id: `dec-${r.id}`, driverId: DRIVER.id, tone: "warning", title: `${DRIVER.first} declined ${r.dateLabel}`, detail: `${r.name}${r.reason ? ` · “${r.reason}”` : ""}`, action: { label: "Send to someone else", run: () => setResolved((x) => new Set(x).add(`dec-${r.id}`)) } });
    }
    for (const [iso, d] of Object.entries(s.availability))
      if (d.status === "unavailable" && d.requested) {
        const day = new Date(iso + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        list.push({ id: `off-${iso}`, driverId: DRIVER.id, tone: "info", title: `${DRIVER.first} asked for ${day} off`, detail: "Time off request", action: { label: "Approve", run: () => a.reviewTimeOff(iso, true) } });
      }
    if (isOn("reusables"))
      for (const x of routeOf(s))
        if (x.kind === "pickup" && s.stops[x.id].skip?.status === "pending") list.push({ id: `skip-${x.id}`, driverId: DRIVER.id, stopId: x.id, tone: "info", title: `${DRIVER.first} asks to skip a pickup`, detail: `${x.name} · “${s.stops[x.id].skip!.reason}”`, action: { label: "Approve skip", run: () => a.decideSkip(x.id, true) } });
    for (const f of FLEET_ALERTS) {
      if (f.stopId && moved[f.stopId]) continue; // Ken's stop got a new driver
      const tone = f.kind === "late" || f.kind === "issue" ? "danger" : f.kind === "time_off" ? "warning" : "info";
      list.push({ id: f.id, driverId: f.driverId, stopId: f.stopId, tone, title: f.title, detail: f.detail, action: { label: f.action, run: () => (f.kind === "time_off" && f.stopId ? openStop(f.stopId) : setResolved((x) => new Set(x).add(f.id))) } });
    }
    const rank = { danger: 0, warning: 1, info: 2 };
    return list.filter((x) => !resolved.has(x.id)).sort((x, y) => rank[x.tone] - rank[y.tone]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, s, resolved, moved]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) => matches(r, filter) && (!driverId || page !== "board" || r.driverIds.includes(driverId)) && (!q || [r.name, r.orderNo, r.area, ...r.driverIds.map((id) => person(id)?.name ?? "")].some((t) => t.toLowerCase().includes(q))),
  );

  // Opening a delivery from anywhere shows it on the Board, in the side sheet.
  function openStop(id: string) {
    setPage("board");
    setStopId(id);
  }
  function openDriver(id: string) {
    setDriverId(id);
    setStopId(null);
  }

  /* ---------- moving between drivers: J / K, "/" to search, Esc steps back ---------- */
  const order = people.map((p) => p.id);
  const step = (d: 1 | -1) => {
    const i = driverId ? order.indexOf(driverId) : -1;
    openDriver(order[(i + d + order.length) % order.length]);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (e.key === "Escape") {
        if (typing) return (e.target as HTMLElement).blur();
        if (stopId) setStopId(null);
        else if (driverId) setDriverId(null);
        else onClose();
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        setPage("board");
        searchRef.current?.focus();
      } else if (!typing && (e.key === "j" || e.key === "k")) step(e.key === "j" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])) as Record<Filter, number>;
  const selRow = stopId ? row(stopId) : undefined;
  const selPerson = driverId ? person(driverId) : undefined;
  const pendingRequests = s.requests.filter((r) => r.status === "pending").length;

  const NAV: { key: Page; label: string; icon: ReactNode; badge?: number }[] = [
    { key: "board", label: "Board", icon: <LayoutList /> },
    { key: "requests", label: "Requests", icon: <Inbox />, badge: alerts.length },
    { key: "drivers", label: "Drivers", icon: <Users /> },
    { key: "hours", label: "Hours & vehicle", icon: <CalendarClock /> },
  ];

  return (
    <div className="anim-fade fixed inset-0 z-[95] flex min-w-[1180px] flex-col" style={{ ...ROBOTO, background: M.surface, color: M.onSurface }}>
      {/* ---------- top app bar ---------- */}
      <header className="flex h-16 shrink-0 items-center gap-4 px-4" style={{ background: M.surface }}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: M.primaryContainer, color: M.onPrimaryContainer }}>
          <Headphones className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[22px] leading-7">Dispatch</span>
          <span className="nums block text-[12px] tracking-[0.4px]" style={{ color: M.onSurfaceVariant }}>
            {DISPATCH.name} · {ROUTE_DATE} · {fmtTime(s.clock)}
          </span>
        </span>
        {/* M3 search bar */}
        <label className="ml-8 flex h-12 w-[460px] items-center gap-3 rounded-full px-4 focus-within:ring-2" style={{ background: M.surfaceHigh, ["--tw-ring-color" as string]: M.primary }}>
          <Search className="size-5 shrink-0" style={{ color: M.onSurfaceVariant }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => (setQuery(e.target.value), setPage("board"))}
            placeholder="Search a customer, order number or driver"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            style={{ color: M.onSurface }}
          />
          {query ? (
            <IconButton label="Clear search" onClick={() => setQuery("")}>
              <X />
            </IconButton>
          ) : (
            <kbd className="rounded border px-1.5 text-[12px]" style={{ borderColor: M.outlineVariant, color: M.onSurfaceVariant }}>
              /
            </kbd>
          )}
        </label>
        <span className="flex-1" />
        <IconButton label="Reset demo" onClick={a.resetDemo}>
          <RotateCcw />
        </IconButton>
        <MdButton variant="outlined" onClick={onClose} icon={<Minimize2 />}>
          Exit full screen
        </MdButton>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- navigation rail ---------- */}
        <nav aria-label="Dispatch sections" className="flex w-24 shrink-0 flex-col items-center gap-3 pt-4">
          {NAV.map((n) => {
            const on = page === n.key;
            return (
              <button key={n.key} onClick={() => setPage(n.key)} aria-current={on ? "page" : undefined} className="group flex w-full flex-col items-center gap-1">
                <span className={cn("relative grid h-8 w-14 place-items-center rounded-full transition-colors [&_svg]:size-6", !on && "group-hover:bg-black/5")} style={on ? { background: M.secondaryContainer, color: M.onSecondaryContainer } : { color: M.onSurfaceVariant }}>
                  {n.icon}
                  {!!n.badge && (
                    <span className="absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[11px] font-medium text-white" style={{ background: M.error }}>
                      {n.badge}
                    </span>
                  )}
                </span>
                <span className={cn("px-1 text-center text-[12px] leading-4 tracking-[0.5px]", on ? "font-bold" : "font-medium")} style={{ color: on ? M.onSurface : M.onSurfaceVariant }}>
                  {n.label}
                </span>
              </button>
            );
          })}
          <p className="mt-auto px-2 pb-4 text-center text-[11px] leading-4" style={{ color: M.onSurfaceVariant }}>
            <kbd>J</kbd>/<kbd>K</kbd> next driver
            <br />
            <kbd>Esc</kbd> back
          </p>
        </nav>

        {/* ---------- page ---------- */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[28px]" style={{ background: M.surfaceLow }}>
          {page === "board" && (
            <BoardPage
              rows={rows}
              visible={visible}
              counts={counts}
              filter={filter}
              setFilter={setFilter}
              group={group}
              setGroup={setGroup}
              people={people}
              person={person}
              driverId={driverId}
              setDriverId={setDriverId}
              stopId={stopId}
              onPick={setStopId}
              clock={s.clock}
              alertsCount={alerts.length}
            />
          )}
          {page === "requests" && <RequestsPage alerts={alerts} pendingRequests={pendingRequests} onOpen={(x) => (x.stopId ? openStop(x.stopId) : x.driverId && (setPage("drivers"), openDriver(x.driverId)))} />}
          {page === "drivers" && <DriversPage people={people} rows={rows} alerts={alerts} selected={driverId} onPick={openDriver} />}
          {page === "hours" && <HoursPage />}
        </main>

        {/* ---------- side sheet: a delivery, a driver, or what needs attention ---------- */}
        {(page === "board" || (page === "drivers" && selPerson)) && (
          <aside className="flex w-[420px] shrink-0 flex-col overflow-hidden" style={{ background: M.surface }}>
            {page === "board" && selRow ? (
              <StopSheet r={selRow} person={person} people={people} onClose={() => setStopId(null)} onDriver={(id) => (setPage("drivers"), openDriver(id))} onMove={(to) => setMoved((m) => ({ ...m, [selRow.id]: to }))} />
            ) : selPerson ? (
              <DriverSheet p={selPerson} rows={rows.filter((r) => r.driverIds.includes(selPerson.id))} alerts={alerts.filter((x) => x.driverId === selPerson.id)} onPrev={() => step(-1)} onNext={() => step(1)} onClose={() => setDriverId(null)} onStop={openStop} />
            ) : (
              <AttentionSheet alerts={alerts} onOpen={(x) => (x.stopId ? openStop(x.stopId) : x.driverId && openDriver(x.driverId))} onAll={() => setPage("requests")} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ================================================================== Material 3 bits */

function MdButton({ variant = "filled", icon, children, onClick, className, disabled, danger }: { variant?: "filled" | "tonal" | "outlined" | "text"; icon?: ReactNode; children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean; danger?: boolean }) {
  const style =
    variant === "filled"
      ? { background: danger ? M.error : M.primary, color: M.onPrimary }
      : variant === "tonal"
        ? { background: M.secondaryContainer, color: M.onSecondaryContainer }
        : variant === "outlined"
          ? { border: `1px solid ${M.outline}`, color: danger ? M.error : M.primary }
          : { color: danger ? M.error : M.primary };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-[14px] font-medium tracking-[0.1px] transition hover:brightness-95 disabled:opacity-40 [&_svg]:size-[18px]", variant === "text" ? "px-3" : icon ? "pl-4 pr-6" : "px-6", className)}
      style={style}
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-black/5 [&_svg]:size-5" style={{ color: M.onSurfaceVariant }}>
      {children}
    </button>
  );
}

function Avatar({ p, size = 40 }: { p?: Pick<Person, "initials" | "duty">; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full text-[14px] font-medium" style={{ width: size, height: size, background: M.primaryContainer, color: M.onPrimaryContainer }}>
      {p?.initials ?? "?"}
      {p && <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2" style={{ borderColor: M.surface, background: p.duty === "on" ? "#2E7D32" : p.duty === "off" ? M.outline : M.error }} aria-hidden />}
    </span>
  );
}

/** Page header: a title and one plain line saying what this page is for. */
function PageHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end gap-4 px-8 pb-4 pt-6">
      <span className="min-w-0 flex-1">
        <h1 className="text-[28px] leading-9">{title}</h1>
        <p className="mt-1 text-[14px] tracking-[0.25px]" style={{ color: M.onSurfaceVariant }}>
          {sub}
        </p>
      </span>
      {children}
    </div>
  );
}

function Card({ title, sub, children, className }: { title?: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-white p-5", className)} style={{ borderColor: M.outlineVariant }}>
      {title && <h2 className="text-[16px] font-medium tracking-[0.15px]">{title}</h2>}
      {sub && (
        <p className="mb-4 mt-0.5 text-[14px] tracking-[0.25px]" style={{ color: M.onSurfaceVariant }}>
          {sub}
        </p>
      )}
      {/* The side-panel sections inside keep their buttons, but their own small titles are hidden: the card says it. */}
      <div className={cn(title && "[&_section>div:first-child>h3]:hidden")}>{children}</div>
    </section>
  );
}

const TONE = {
  danger: { bg: M.errorContainer, fg: M.onErrorContainer, dot: M.error },
  warning: { bg: M.warnContainer, fg: M.onWarnContainer, dot: "#B58A00" },
  info: { bg: M.secondaryContainer, fg: M.onSecondaryContainer, dot: M.primary },
  success: { bg: M.successContainer, fg: M.onSuccessContainer, dot: "#2E7D32" },
  neutral: { bg: M.surfaceHigh, fg: M.onSurfaceVariant, dot: M.outline },
} as const;
const toneOf = (t: string): keyof typeof TONE => (t === "danger" || t === "warning" || t === "info" || t === "success" ? t : "neutral");

/** M3 assist-chip-style status: tonal container + label. */
function StatusChip({ tone, children }: { tone: string; children: ReactNode }) {
  const c = TONE[toneOf(tone)];
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-medium tracking-[0.5px]" style={{ background: c.bg, color: c.fg }}>
      <span className="size-1.5 rounded-full" style={{ background: c.dot }} aria-hidden />
      {children}
    </span>
  );
}

/* ================================================================== Board */

function BoardPage(p: {
  rows: Row[];
  visible: Row[];
  counts: Record<Filter, number>;
  filter: Filter;
  setFilter: (f: Filter) => void;
  group: "time" | "driver";
  setGroup: (g: "time" | "driver") => void;
  people: Person[];
  person: (id: string) => Person | undefined;
  driverId: string | null;
  setDriverId: (id: string | null) => void;
  stopId: string | null;
  onPick: (id: string) => void;
  clock: number;
  alertsCount: number;
}) {
  const { visible, counts, filter, setFilter, group, setGroup, people, person, driverId, setDriverId, stopId, onPick, clock } = p;
  // A "Now" line before the first delivery still to come; the table opens scrolled to it.
  const nowBefore = group === "time" ? visible.find((r) => r.windowEnd >= clock && !finished(r))?.id : undefined;
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tableRef.current?.querySelector<HTMLElement>("[data-now]");
    if (el && tableRef.current) tableRef.current.scrollTop = Math.max(0, el.offsetTop - 140);
  }, []);
  const total = p.rows.filter((r) => r.status !== "cancelled").length;
  return (
    <>
      <PageHead title="Today's deliveries" sub={`${total} deliveries · ${counts.done} done · pick a card to filter, click a row to see and change a delivery`}>
        {/* Segmented button: how the table is grouped. */}
        <div className="flex h-10 overflow-hidden rounded-full border" style={{ borderColor: M.outline }}>
          {(["time", "driver"] as const).map((g, i) => (
            <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={cn("flex items-center gap-1.5 px-4 text-[14px] font-medium", i > 0 && "border-l")} style={{ borderColor: M.outline, background: group === g ? M.secondaryContainer : "transparent", color: group === g ? M.onSecondaryContainer : M.onSurface }}>
              {group === g && <Check className="size-4" />}
              {g === "time" ? "By time" : "By driver"}
            </button>
          ))}
        </div>
      </PageHead>

      {/* Summary cards double as filters: each says what it counts. */}
      <div className="grid shrink-0 grid-cols-6 gap-3 px-8 pb-4">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const hot = (f.key === "attention" || f.key === "unassigned" || f.key === "late") && counts[f.key] > 0;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={on} className="rounded-xl border px-4 py-3 text-left transition hover:brightness-[0.98]" style={{ borderColor: on ? M.primary : M.outlineVariant, background: on ? M.secondaryContainer : "#fff", boxShadow: on ? `inset 0 0 0 1px ${M.primary}` : undefined }}>
              <span className="nums block text-[28px] leading-8" style={{ color: hot ? M.error : M.onSurface }}>
                {counts[f.key]}
              </span>
              <span className="mt-1 block text-[14px] font-medium">{f.label}</span>
              <span className="block truncate text-[12px] tracking-[0.4px]" style={{ color: M.onSurfaceVariant }}>
                {f.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Driver filter chips: everyone, or one driver's day. */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-8 pb-3">
        <FilterChip on={!driverId} onClick={() => setDriverId(null)}>
          All drivers
        </FilterChip>
        {people.map((x) => (
          <FilterChip key={x.id} on={driverId === x.id} onClick={() => setDriverId(driverId === x.id ? null : x.id)}>
            {x.first}
          </FilterChip>
        ))}
      </div>

      <div ref={tableRef} className="mx-8 mb-6 min-h-0 flex-1 overflow-y-auto rounded-xl border bg-white" style={{ borderColor: M.outlineVariant }}>
        <table className="w-full text-[14px]">
          <thead className="sticky top-0 z-10 bg-white text-left text-[12px] font-medium tracking-[0.5px]" style={{ color: M.onSurfaceVariant }}>
            <tr className="border-b" style={{ borderColor: M.outlineVariant }}>
              <th className="w-[180px] px-5 py-3 font-medium">Time window</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="w-[170px] px-3 py-3 font-medium">Food</th>
              <th className="w-[70px] px-3 py-3 text-right font-medium">Meals</th>
              <th className="w-[170px] px-3 py-3 font-medium">Driver</th>
              <th className="w-[150px] px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {groupRows(visible, group, person).map(([label, sub, list]) => (
              <GroupRows key={label} label={label} sub={sub} rows={list} person={person} selected={stopId} onPick={onPick} nowBefore={nowBefore} clock={clock} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ color: M.onSurfaceVariant }}>
                  No deliveries match. Try another card or “All drivers”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[14px] font-medium tracking-[0.1px]" style={on ? { background: M.secondaryContainer, borderColor: "transparent", color: M.onSecondaryContainer } : { borderColor: M.outline, color: M.onSurfaceVariant }}>
      {on && <Check className="size-4" />}
      {children}
    </button>
  );
}

function groupRows(rows: Row[], by: "time" | "driver", person: (id: string) => Person | undefined): [string, string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = by === "time" ? String(Math.floor(r.windowStart / 60)) : (r.driverIds[0] ?? "");
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const out = [...map.entries()].map(([k, list]): [string, string, Row[]] => {
    if (by === "time") return [fmtTime(+k * 60).replace(":00", ""), `${list.length} ${list.length === 1 ? "delivery" : "deliveries"}`, list];
    const done = list.filter(finished).length;
    return [k ? (person(k)?.name ?? k) : "No driver yet", k ? `${done} of ${list.length} done` : `${list.length} to assign`, list];
  });
  return by === "driver" ? out.sort((x, y) => (x[0] === "No driver yet" ? -1 : y[0] === "No driver yet" ? 1 : 0)) : out;
}

function GroupRows({ label, sub, rows, person, selected, onPick, nowBefore, clock }: { label: string; sub: string; rows: Row[]; person: (id: string) => Person | undefined; selected: string | null; onPick: (id: string) => void; nowBefore?: string; clock: number }) {
  const allDone = rows.length > 0 && rows.every(finished);
  // An hour where everything is delivered folds to one line (click to open), so live work comes first.
  const [open, setOpen] = useState(!allDone);
  return (
    <>
      <tr>
        <td colSpan={6} className="border-b p-0" style={{ borderColor: M.outlineVariant, background: M.surfaceContainer }}>
          <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-2.5 text-left">
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} style={{ color: M.onSurfaceVariant }} />
            <span className="text-[16px] font-medium tracking-[0.15px]">{label}</span>
            <span className="text-[13px]" style={{ color: M.onSurfaceVariant }}>
              {allDone ? `${rows.length} delivered` : sub}
            </span>
            {allDone && <StatusChip tone="success">All done</StatusChip>}
          </button>
        </td>
      </tr>
      {open &&
        rows.map((r) => {
          const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
          const done = finished(r);
          const alarm = !!r.lateBy || r.status === "issue";
          const warn = !alarm && r.status === "unassigned";
          return (
            <FragmentRow key={r.id}>
              {r.id === nowBefore && (
                <tr data-now>
                  <td colSpan={6} className="p-0">
                    <div className="flex items-center gap-2 px-5 py-1">
                      <span className="nums rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: M.tertiaryContainer, color: M.onTertiaryContainer }}>
                        Now · {fmtTime(clock)}
                      </span>
                      <span className="h-0.5 flex-1 rounded-full" style={{ background: "#E8A887" }} />
                    </div>
                  </td>
                </tr>
              )}
              <tr
                onClick={() => onPick(r.id)}
                aria-selected={selected === r.id}
                className="cursor-pointer border-b hover:brightness-[0.97]"
                style={{
                  borderColor: M.outlineVariant,
                  background: selected === r.id ? M.secondaryContainer : alarm ? "#FFF4F2" : warn ? "#FFF8EA" : "#fff",
                  boxShadow: alarm ? `inset 4px 0 0 ${M.error}` : warn ? "inset 4px 0 0 #B58A00" : undefined,
                  color: done ? M.onSurfaceVariant : M.onSurface,
                }}
              >
                <td className="nums px-5 py-3 align-top">
                  <span className="block whitespace-nowrap" style={alarm ? { color: M.error, fontWeight: 500 } : undefined}>
                    {fmtWindow(r.windowStart, r.windowEnd)}
                  </span>
                  {r.lateBy ? (
                    <span className="block text-[12px] font-medium" style={{ color: M.error }}>
                      {r.lateBy} min late
                    </span>
                  ) : r.eta ? (
                    <span className="block text-[12px]" style={{ color: M.onSurfaceVariant }}>
                      ETA {fmtTime(r.eta)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={cn("block text-[15px]", !done && "font-medium")}>{r.name}</span>
                  <span className="block text-[12px]" style={{ color: M.onSurfaceVariant }}>
                    {r.orderNo} · {r.area}
                  </span>
                </td>
                <td className={cn("px-3 py-3 align-top", done && "opacity-60")}>
                  <WorkTags work={r.work} variant="plain" short chips={false} />
                </td>
                <td className="nums px-3 py-3 text-right align-top" style={{ color: M.onSurfaceVariant }}>
                  {r.meals || "–"}
                </td>
                <td className="px-3 py-3 align-top">
                  {r.driverIds.length ? (
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        {r.driverIds.slice(0, 3).map((id) => (
                          <span key={id} className="grid size-6 place-items-center rounded-full border-2 border-white text-[10px] font-medium" style={{ background: M.primaryContainer, color: M.onPrimaryContainer }}>
                            {person(id)?.initials ?? "?"}
                          </span>
                        ))}
                      </span>
                      <span className="truncate text-[14px]">
                        {person(r.driverIds[0])?.first}
                        {r.driverIds.length > 1 && ` +${r.driverIds.length - 1}`}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium" style={{ background: M.warnContainer, color: M.onWarnContainer }}>
                      <UserX className="size-3.5" /> {r.requestStatus ?? "Needs a driver"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <StatusChip tone={meta ? meta.tone : "warning"}>{meta ? meta.label : "No driver"}</StatusChip>
                </td>
              </tr>
            </FragmentRow>
          );
        })}
    </>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ================================================================== side sheets */

function SheetHead({ title, sub, children, onClose }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex shrink-0 items-start gap-3 px-6 pb-3 pt-6">
      <span className="min-w-0 flex-1">
        <span className="block text-[22px] leading-7">{title}</span>
        {sub && (
          <span className="mt-1 block text-[14px] tracking-[0.25px]" style={{ color: M.onSurfaceVariant }}>
            {sub}
          </span>
        )}
      </span>
      {children}
      {onClose && (
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      )}
    </div>
  );
}

/** One alert as an M3 list item: tonal icon, headline, supporting text, then its action button. */
function AlertItem({ x, onOpen }: { x: Alert; onOpen: (x: Alert) => void }) {
  const c = TONE[x.tone];
  return (
    <div className="px-6 py-3">
      <button onClick={() => onOpen(x)} className="flex w-full items-start gap-4 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: c.bg, color: c.fg }}>
          {x.tone === "danger" ? <AlertTriangle className="size-5" /> : <Clock className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] tracking-[0.15px]">{x.title}</span>
          <span className="mt-0.5 block text-[14px] tracking-[0.25px]" style={{ color: M.onSurfaceVariant }}>
            {x.detail}
          </span>
        </span>
        <ChevronRight className="mt-2.5 size-5 shrink-0" style={{ color: M.onSurfaceVariant }} />
      </button>
      {x.action && (
        <div className="ml-14 mt-2">
          <MdButton variant={x.tone === "danger" ? "filled" : "tonal"} onClick={x.action.run} className="h-9">
            {x.action.label}
          </MdButton>
        </div>
      )}
    </div>
  );
}

function AttentionSheet({ alerts, onOpen, onAll }: { alerts: Alert[]; onOpen: (x: Alert) => void; onAll: () => void }) {
  const urgent = alerts.filter((x) => x.tone === "danger");
  const rest = alerts.filter((x) => x.tone !== "danger");
  return (
    <>
      <SheetHead title="Needs your attention" sub={alerts.length ? `${alerts.length} things across all drivers, most urgent first` : "Nothing is waiting on you"}>
        <MdButton variant="text" onClick={onAll}>
          See all
        </MdButton>
      </SheetHead>
      <div className="flex-1 overflow-y-auto pb-4">
        {urgent.length > 0 && <SubHead>Urgent · {urgent.length}</SubHead>}
        {urgent.map((x) => (
          <AlertItem key={x.id} x={x} onOpen={onOpen} />
        ))}
        {rest.length > 0 && <SubHead>To do · {rest.length}</SubHead>}
        {rest.map((x) => (
          <AlertItem key={x.id} x={x} onOpen={onOpen} />
        ))}
        {alerts.length === 0 && (
          <p className="mx-6 rounded-xl p-4 text-[14px]" style={{ background: M.successContainer, color: M.onSuccessContainer }}>
            All clear. Every delivery has a driver and is on time.
          </p>
        )}
      </div>
    </>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 pb-1 pt-4 text-[14px] font-medium tracking-[0.1px]" style={{ color: M.primary }}>
      {children}
    </div>
  );
}

function StopSheet({ r, person, people, onClose, onDriver, onMove }: { r: Row; person: (id: string) => Person | undefined; people: Person[]; onClose: () => void; onDriver: (id: string) => void; onMove: (to: string) => void }) {
  const { s, a } = useApp();
  const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
  const marcusStop = r.live && routeOf(s).some((x) => x.id === r.id);
  const openOrder = r.live && !marcusStop;
  const req = openOrder ? s.requests.find((x) => x.orderId === r.id) : undefined;
  const done = finished(r);
  return (
    <>
      <SheetHead title={r.name} sub={`${r.orderNo} · ${r.area}`} onClose={onClose} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={meta ? meta.tone : "warning"}>{meta ? meta.label : "No driver"}</StatusChip>
          {!!r.lateBy && <StatusChip tone="danger">{r.lateBy} min late</StatusChip>}
          <WorkTags work={r.work} variant="plain" short chips={false} />
        </div>
        <Card>
          <dl className="-my-2 text-[14px]">
            <Field label="Time window" value={<span className="nums">{fmtWindow(r.windowStart, r.windowEnd)}</span>} />
            {r.eta && <Field label="ETA" value={<span className="nums" style={r.lateBy ? { color: M.error } : undefined}>{fmtTime(r.eta)}</span>} />}
            <Field label="Meals" value={r.meals || "–"} />
            {r.issue && <Field label="Problem" value={<span style={{ color: M.error }}>{r.issue}</span>} />}
          </dl>
        </Card>

        <Card title="Who's on it" sub={r.driverIds.length ? "Click a driver to see their whole day." : "Nobody yet. Send it to a driver or put someone on it."}>
          {r.driverIds.map((id) => {
            const p = person(id);
            return (
              <button key={id} onClick={() => onDriver(id)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5">
                <Avatar p={p} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px]">{p?.name ?? id}</span>
                  <span className="block text-[13px]" style={{ color: M.onSurfaceVariant }}>
                    {p?.phone}
                  </span>
                </span>
                <ChevronRight className="size-5" style={{ color: M.onSurfaceVariant }} />
              </button>
            );
          })}
          {marcusStop ? (
            <div className="mt-3">
              <AssignmentPanel stop={r.live!} />
            </div>
          ) : (
            !done && (
              <div className="mt-3 space-y-3">
                {openOrder && !req && !s.claims[r.id] && (
                  <MdButton onClick={() => a.sendOrderRequest(r.id)} className="w-full">
                    Send to {DRIVER.first} to accept
                  </MdButton>
                )}
                {r.requestStatus && <p className="text-[14px]" style={{ color: M.onSurfaceVariant }}>{r.requestStatus}</p>}
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium tracking-[0.4px]" style={{ color: M.onSurfaceVariant }}>
                    {r.driverIds.length ? "Move to another driver" : "Put a driver on it"}
                  </span>
                  <select value="" onChange={(e) => e.target.value && onMove(e.target.value)} className="h-12 w-full rounded border bg-white px-3 text-[16px] outline-none focus:border-2" style={{ borderColor: M.outline }}>
                    <option value="">Choose a driver…</option>
                    {people
                      .filter((p) => p.duty !== "time_off" && !p.live && !r.driverIds.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.duty === "on" ? "on duty" : "not on yet"}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )
          )}
        </Card>

        {marcusStop && !done && (
          <Card title="Change this delivery" sub={`${DRIVER.first} gets a push on his phone.`}>
            <div className="flex gap-2">
              <MdButton variant="tonal" onClick={() => a.changeTime(r.id, 20)} className="flex-1">
                Window +20 min
              </MdButton>
              <MdButton variant="outlined" danger onClick={() => a.cancelOrder(r.id)} className="flex-1">
                Cancel order
              </MdButton>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt style={{ color: M.onSurfaceVariant }}>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

type DriverTab = "today" | "requests" | "hours" | "vehicle";
function DriverSheet({ p, rows, alerts, onPrev, onNext, onClose, onStop }: { p: Person; rows: Row[]; alerts: Alert[]; onPrev: () => void; onNext: () => void; onClose: () => void; onStop: (id: string) => void }) {
  const [tab, setTab] = useState<DriverTab>("today");
  const done = rows.filter(finished).length;
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 px-6 pb-3 pt-6">
        <Avatar p={p} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[22px] leading-7">{p.name}</span>
          <span className="block text-[14px]" style={{ color: M.onSurfaceVariant }}>
            {p.type} · {p.duty === "on" ? "On duty" : p.duty === "off" ? "Not on duty" : "Time off"} · {done}/{rows.length} done
          </span>
        </span>
        <IconButton label="Previous driver (K)" onClick={onPrev}>
          <ChevronLeft />
        </IconButton>
        <IconButton label="Next driver (J)" onClick={onNext}>
          <ChevronRight />
        </IconButton>
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="flex shrink-0 gap-2 px-6 pb-3">
        <MdButton variant="tonal" icon={<Phone />} className="flex-1" onClick={() => (window.location.href = `tel:${p.phone}`)}>
          Call {p.first}
        </MdButton>
        <MdButton variant="outlined" icon={<MessageSquare />} className="flex-1">
          Message
        </MdButton>
      </div>
      {/* M3 primary tabs */}
      <div className="flex shrink-0 border-b" role="tablist" style={{ borderColor: M.outlineVariant }}>
        {(
          [
            ["today", "Today"],
            ["requests", "Requests"],
            ["hours", "Hours"],
            ["vehicle", "Vehicle"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="relative h-12 flex-1 text-[14px] font-medium tracking-[0.1px]" style={{ color: tab === k ? M.primary : M.onSurfaceVariant }}>
            {label}
            {tab === k && <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-t-full" style={{ background: M.primary }} />}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {tab === "today" && (
          <>
            {alerts.map((x) => (
              <div key={x.id} className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[14px]" style={{ background: TONE[x.tone].bg, color: TONE[x.tone].fg }}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <b className="font-medium">{x.title}</b> · {x.detail}
                </span>
              </div>
            ))}
            {p.live ? (
              <TodayChanges />
            ) : (
              <div className="divide-y overflow-hidden rounded-xl border bg-white" style={{ borderColor: M.outlineVariant }}>
                {rows.map((r) => {
                  const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
                  return (
                    <button key={r.id} onClick={() => onStop(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]" style={{ borderColor: M.outlineVariant }}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{r.name}</span>
                        <span className="nums block text-[13px]" style={{ color: r.lateBy ? M.error : M.onSurfaceVariant }}>
                          {fmtWindow(r.windowStart, r.windowEnd)}
                          {r.lateBy ? ` · ${r.lateBy} min late` : ""}
                        </span>
                      </span>
                      {meta && <StatusChip tone={meta.tone}>{meta.label}</StatusChip>}
                    </button>
                  );
                })}
                {rows.length === 0 && <p className="p-4 text-[14px]" style={{ color: M.onSurfaceVariant }}>No deliveries today.</p>}
              </div>
            )}
          </>
        )}
        {tab === "requests" &&
          (p.live ? (
            <>
              <DriverRequests />
              {isOn("reusables") && <SkipRequests />}
            </>
          ) : (
            <DemoOnly p={p} />
          ))}
        {tab === "hours" &&
          (p.live ? (
            <>
              <OpenHoursEditor />
              <TimeOffRequests />
            </>
          ) : (
            <DemoOnly p={p} />
          ))}
        {tab === "vehicle" &&
          (p.live ? (
            <DriverProfile />
          ) : (
            <Card>
              <p className="text-[16px]">{p.vehicle}</p>
              <p className="text-[14px]" style={{ color: M.onSurfaceVariant }}>
                {p.phone}
              </p>
            </Card>
          ))}
      </div>
    </>
  );
}

function DemoOnly({ p }: { p: Person }) {
  return (
    <p className="rounded-xl p-4 text-[14px]" style={{ background: M.surfaceContainer, color: M.onSurfaceVariant }}>
      {p.first}'s requests and hours work the same as Marcus's. In this prototype only Marcus is connected to the phone, so pick him to try them.
    </p>
  );
}

/* ================================================================== Requests */

function RequestsPage({ alerts, pendingRequests, onOpen }: { alerts: Alert[]; pendingRequests: number; onOpen: (x: Alert) => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <PageHead title="Requests" sub={`Everything waiting on an answer: ${alerts.length} for you to act on, ${pendingRequests} waiting on drivers.`} />
      <div className="grid grid-cols-2 items-start gap-4 px-8">
        <Card title="Needs your attention" sub="Late drivers, problems on site, and deliveries with nobody on them. Most urgent first." className="row-span-2 !p-0 [&>h2]:px-5 [&>h2]:pt-5 [&>p]:px-5">
          <div className="-mt-1 pb-2">
            {alerts.map((x) => (
              <AlertItem key={x.id} x={x} onOpen={onOpen} />
            ))}
            {alerts.length === 0 && <p className="px-5 pb-4 text-[14px]">All clear.</p>}
          </div>
        </Card>
        <Card title="Requests to drivers" sub="Deliveries you've asked a driver to take. Remind them, send a new one, or assign straight away.">
          <DriverRequests />
        </Card>
        <Card title="Orders with no driver" sub="Send one to a driver to accept. It joins their route once they do.">
          <UnassignedOrders />
        </Card>
        {isOn("reusables") && (
          <Card title="Pickup skip requests" sub="A driver can't do a reusables pickup and asks to skip it.">
            <SkipRequests />
          </Card>
        )}
        <Card title="Time off requests" sub="Days a driver asked for off. Approving it greys them out for that day.">
          <TimeOffRequests />
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== Drivers */

function DriversPage({ people, rows, alerts, selected, onPick }: { people: Person[]; rows: Row[]; alerts: Alert[]; selected: string | null; onPick: (id: string) => void }) {
  const groups: [string, Duty][] = [
    ["On duty", "on"],
    ["Not on duty yet", "off"],
    ["Off today", "time_off"],
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <PageHead title="Drivers" sub={`${people.filter((p) => p.duty === "on").length} on duty · ${people.length} working today. Click a driver to see their day, requests, hours and vehicle.`} />
      {groups.map(([label, duty]) => {
        const list = people.filter((p) => p.duty === duty);
        if (!list.length) return null;
        return (
          <section key={duty} className="px-8 pb-4">
            <h2 className="pb-2 text-[14px] font-medium tracking-[0.1px]" style={{ color: M.primary }}>
              {label} · {list.length}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {list.map((p) => {
                const mine = rows.filter((r) => r.driverIds.includes(p.id) || (p.id === "u-ken" && UNCOVERED.has(r.id) && r.status === "unassigned"));
                const done = mine.filter(finished).length;
                const next = mine.find((r) => !finished(r) && r.status !== "unassigned");
                const flags = alerts.filter((x) => x.driverId === p.id).length;
                const late = mine.some((r) => r.lateBy);
                const on = selected === p.id;
                return (
                  <button key={p.id} onClick={() => onPick(p.id)} aria-pressed={on} className="rounded-xl border bg-white p-4 text-left transition hover:brightness-[0.98]" style={{ borderColor: on ? M.primary : M.outlineVariant, boxShadow: on ? `inset 0 0 0 1px ${M.primary}` : undefined }}>
                    <span className="flex items-center gap-3">
                      <Avatar p={p} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[16px] font-medium">{p.name}</span>
                          {p.live && (
                            <span className="rounded px-1.5 text-[11px] font-medium" style={{ background: M.tertiaryContainer, color: M.onTertiaryContainer }}>
                              Live
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[13px]" style={{ color: M.onSurfaceVariant }}>
                          {p.type} · {p.vehicle}
                        </span>
                      </span>
                      {flags > 0 && <StatusChip tone="danger">{flags} need you</StatusChip>}
                    </span>
                    <span className="mt-3 block truncate text-[14px]">{p.duty === "time_off" ? "Time off today" : next ? `Next: ${next.name} · ${fmtTime(next.windowStart)}` : mine.length ? "All deliveries done" : "Nothing today"}</span>
                    {mine.length > 0 && (
                      <span className="mt-2 flex items-center gap-3">
                        <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: M.surfaceHigh }}>
                          <span className="block h-full rounded-full" style={{ width: `${(done / mine.length) * 100}%`, background: late ? M.error : M.primary }} />
                        </span>
                        <span className="nums text-[12px]" style={{ color: M.onSurfaceVariant }}>
                          {done}/{mine.length} done
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ================================================================== Hours & vehicle */

function HoursPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <PageHead title="Hours & vehicle" sub={`${DRIVER.first}'s weekly hours, time off, duty status and what fits in the vehicle. Changes show on his phone right away.`} />
      <div className="grid grid-cols-2 items-start gap-4 px-8">
        <Card title="Weekly hours" sub="The days and times a driver can be sent work. Requests outside them are flagged.">
          <OpenHoursEditor />
        </Card>
        <Card title="Duty & vehicle" sub="Whether he's on duty (and sharing location), his vehicle, and the storage notes only dispatch edits.">
          <DriverProfile />
        </Card>
        <Card title="Time off" sub="Days off he booked on the phone. Approve or decline here.">
          <TimeOffRequests />
        </Card>
        <Card title="Today's route" sub="Move a delivery's window or cancel it. He gets a push.">
          <TodayChanges />
        </Card>
      </div>
    </div>
  );
}
