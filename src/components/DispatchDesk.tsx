import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Headphones, MessageSquare, Minimize2, Phone, RotateCcw, Search, UserX, X } from "lucide-react";
import { routeOf, useApp } from "../store";
import { DISPATCH, DRIVER, OPEN_POOL, ROUTE_DATE, SETTINGS, fmtTime, fmtWindow, workOf, type Stop, type StopStatus, type Work } from "../data/route";
import { FLEET, FLEET_ALERTS, FLEET_STOPS, UNCOVERED, type Duty } from "../data/fleet";
import { hoursUntil } from "../screens/Schedule";
import { isOn } from "../data/sprints";
import { AssignmentPanel, DriverProfile, DriverRequests, OpenHoursEditor, SkipRequests, TimeOffRequests, TodayChanges } from "./DispatchBoard";
import { Badge, cn, STATUS_META, WorkTags } from "./ui";

/* ------------------------------------------------------------------
 * Nov 4 2026 (review: "Will it take much time to do a rendering of the dispatch board at full screen? I'm not
 * sure how dispatch will move between drivers and view/request these types of things when there's 40+
 * deliveries/day. They'll be on a computer 90% of the time."):
 *   left   every driver, with progress, next stop and a red count of what needs them (J / K steps through)
 *   middle every delivery of the day in one table, filtered by tab, grouped by time or by driver
 *   right  "Needs attention" across all drivers until a driver or a delivery is picked, then that one's panel
 * Marcus is live (shared with the phone); the rest of the fleet is demo data from src/data/fleet.ts.
 * ------------------------------------------------------------------ */

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
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "unassigned", label: "No driver" },
  { key: "late", label: "Running late" },
  { key: "active", label: "On the way" },
  { key: "done", label: "Done" },
];

const needsAttention = (r: Row) => r.status === "unassigned" || r.status === "issue" || !!r.lateBy;
const matches = (r: Row, f: Filter) =>
  f === "all" ? true : f === "attention" ? needsAttention(r) : f === "unassigned" ? r.status === "unassigned" : f === "late" ? !!r.lateBy : f === "active" ? r.status === "en_route" || r.status === "arrived" : r.status === "delivered" || r.status === "cancelled";

export function DispatchDesk({ onClose }: { onClose: () => void }) {
  const { s, a } = useApp();
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
      return {
        id: x.id,
        orderNo: x.orderNo,
        name: x.name,
        area: x.addressLine1,
        windowStart: x.windowStart,
        windowEnd: x.windowEnd,
        work: workOf(x),
        meals: x.meals,
        driverIds: (s.assignments[x.id] ?? [{ userId: DRIVER.id }]).map((y) => y.userId),
        status: st.status,
        lateBy,
        issue: st.issue,
        live: x,
      };
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
      return { ...x, driverIds: uncovered ? [] : [to ?? x.driverId], status: uncovered ? "unassigned" : x.status, lateBy, area: x.area };
    });
    return [...mine, ...pool, ...fleet].sort((x, y) => x.windowStart - y.windowStart || x.name.localeCompare(y.name));
  }, [s, moved]);
  const row = (id: string) => rows.find((r) => r.id === id);

  /* ---------- what needs dispatch, across all drivers ---------- */
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];
    for (const r of rows) {
      if (r.status === "issue" && r.live) list.push({ id: `issue-${r.id}`, driverId: r.driverIds[0], stopId: r.id, tone: "danger", title: `${person(r.driverIds[0])?.first ?? "Driver"} · problem at ${r.name}`, detail: r.issue ? `“${r.issue}”` : "Reported from the app", action: { label: "Call customer", run: () => setStopId(r.id) } });
      else if (r.lateBy && r.live) list.push({ id: `late-${r.id}`, driverId: r.driverIds[0], stopId: r.id, tone: "danger", title: `${person(r.driverIds[0])?.first} · ${r.lateBy} min late`, detail: `${r.name} · window ended ${fmtTime(r.windowEnd)}`, action: { label: "+20 min", run: () => a.changeTime(r.id, 20) } });
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
      list.push({ id: f.id, driverId: f.driverId, stopId: f.stopId, tone, title: f.title, detail: f.detail, action: { label: f.action, run: () => (f.kind === "time_off" && f.stopId ? setStopId(f.stopId) : setResolved((x) => new Set(x).add(f.id))) } });
    }
    const rank = { danger: 0, warning: 1, info: 2 };
    return list.filter((x) => !resolved.has(x.id)).sort((x, y) => rank[x.tone] - rank[y.tone]);
  }, [rows, s, resolved, moved]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      matches(r, filter) &&
      (!driverId || r.driverIds.includes(driverId)) &&
      (!q || [r.name, r.orderNo, r.area, ...r.driverIds.map((id) => person(id)?.name ?? "")].some((t) => t.toLowerCase().includes(q))),
  );

  /* ---------- moving between drivers: J / K, "/" to search, Esc steps back ---------- */
  const order = people.map((p) => p.id);
  const step = (d: 1 | -1) => {
    const i = driverId ? order.indexOf(driverId) : -1;
    setDriverId(order[(i + d + order.length) % order.length]);
    setStopId(null);
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
        searchRef.current?.focus();
      } else if (!typing && (e.key === "j" || e.key === "k")) step(e.key === "j" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Nov 4 2026 (review: "visual hierarchy, usable"): a "Now" line before the first delivery still to come, and the
  // table opens scrolled to it, so the live part of the day is what dispatch sees first.
  const nowBefore = visible.find((r) => r.windowEnd >= s.clock && r.status !== "delivered" && r.status !== "cancelled")?.id;
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tableRef.current?.querySelector<HTMLElement>("[data-now]");
    const box = tableRef.current;
    if (el && box) box.scrollTop = Math.max(0, el.offsetTop - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])) as Record<Filter, number>;
  const selRow = stopId ? row(stopId) : undefined;
  const selPerson = driverId ? person(driverId) : undefined;

  return (
    <div className="anim-fade fixed inset-0 z-[95] flex min-w-[1180px] flex-col bg-background text-foreground">
      {/* ---------- header ---------- */}
      <header data-dark-surface className="flex h-16 shrink-0 items-center gap-4 bg-teal-deep px-5 text-white">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-yellow text-teal-deep">
          <Headphones className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold leading-tight">Dispatch · SFK Admin</span>
          <span className="nums block text-2xs text-sidebar-muted">
            {DISPATCH.name} · {ROUTE_DATE} · {fmtTime(s.clock)}
          </span>
        </span>
        <label className="ml-6 flex h-10 w-[420px] items-center gap-2 rounded-full bg-white/10 px-4 text-sm focus-within:bg-white focus-within:text-foreground">
          <Search className="size-4 shrink-0 opacity-70" />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, order or driver" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-current placeholder:opacity-60" />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="rounded border border-current/30 px-1.5 text-2xs opacity-60">/</kbd>
          )}
        </label>
        <span className="flex-1" />
        <Stat label="Deliveries" value={rows.filter((r) => r.status !== "cancelled").length} />
        <Stat label="Done" value={counts.done} />
        <Stat label="Need you" value={alerts.length} hot={alerts.length > 0} />
        <button onClick={a.resetDemo} aria-label="Reset demo" title="Reset demo" className="grid size-9 place-items-center rounded-full hover:bg-sidebar-active">
          <RotateCcw className="size-4" />
        </button>
        <button onClick={onClose} title="Back to the phone (Esc)" className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold hover:bg-sidebar-active">
          <Minimize2 className="size-4" /> Exit full screen
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- drivers ---------- */}
        <nav aria-label="Drivers" className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card">
          <button onClick={() => (setDriverId(null), setStopId(null))} className={cn("flex items-center gap-3 border-b border-border px-4 py-3 text-left", !driverId ? "bg-teal-wash" : "hover:bg-muted")}>
            <span className="grid size-9 place-items-center rounded-full bg-teal-deep text-2xs font-bold text-white">All</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">All drivers</span>
              <span className="block text-2xs text-muted-foreground">
                {people.filter((p) => p.duty === "on").length} on duty · {people.length} today
              </span>
            </span>
          </button>
          <div className="flex-1 overflow-y-auto">
            {(["on", "off", "time_off"] as Duty[]).map((duty) => {
              const list = people.filter((p) => p.duty === duty);
              if (!list.length) return null;
              return (
                <div key={duty}>
                  <div className="sticky top-0 z-10 border-y border-border bg-muted/90 px-4 py-2 text-[13px] font-semibold text-muted-foreground backdrop-blur">{duty === "on" ? "On duty" : duty === "off" ? "Not on yet" : "Off today"}</div>
                  {list.map((p) => (
                    <DriverItem key={p.id} p={p} rows={rows.filter((r) => r.driverIds.includes(p.id) || (p.id === "u-ken" && UNCOVERED.has(r.id) && r.status === "unassigned"))} flags={alerts.filter((x) => x.driverId === p.id).length} active={driverId === p.id} onClick={() => (setDriverId(p.id), setStopId(null))} />
                  ))}
                </div>
              );
            })}
          </div>
          <p className="border-t border-border px-4 py-2.5 text-2xs text-muted-foreground">
            <kbd className="rounded border border-border-strong px-1">J</kbd> / <kbd className="rounded border border-border-strong px-1">K</kbd> next / previous driver · <kbd className="rounded border border-border-strong px-1">Esc</kbd> back
          </p>
        </nav>

        {/* ---------- deliveries ---------- */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-5 py-3">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold", filter === f.key ? "border-teal-deep bg-teal-deep text-white" : "border-control bg-card hover:bg-teal-wash")}
              >
                {f.label}
                <span className={cn("nums rounded-full px-1.5 text-2xs", filter === f.key ? "bg-white/20" : (f.key === "attention" || f.key === "unassigned" || f.key === "late") && counts[f.key] ? "bg-danger-bg text-danger" : "bg-muted text-muted-foreground")}>{counts[f.key]}</span>
              </button>
            ))}
            <span className="flex-1" />
            
            <span className="flex shrink-0 rounded-full bg-muted p-0.5" aria-label="Group by">
              {(["time", "driver"] as const).map((g) => (
                <button key={g} onClick={() => setGroup(g)} className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", group === g ? "bg-card shadow-card" : "text-muted-foreground")}>
                  {g === "time" ? "By time" : "By driver"}
                </button>
              ))}
            </span>
          </div>
          {selPerson && (
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-teal-wash/60 px-5 py-2 text-[13px]">
              <span>Showing <b className="font-semibold">{selPerson.name}</b>'s deliveries</span>
              <button onClick={() => setDriverId(null)} className="ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-teal-deep hover:bg-card">
                <X className="size-3.5" /> Show everyone
              </button>
            </div>
          )}
          <div ref={tableRef} className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-[13px] text-muted-foreground">
                <tr>
                  <th className="w-[180px] px-5 py-2.5 font-semibold">Window</th>
                  <th className="px-3 py-2.5 font-semibold">Customer</th>
                  <th className="w-[170px] px-3 py-2.5 font-semibold">Work</th>
                  <th className="w-[70px] px-3 py-2.5 text-right font-semibold">Meals</th>
                  <th className="w-[170px] px-3 py-2.5 font-semibold">Driver</th>
                  <th className="w-[140px] px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups(visible, group, person).map(([label, sub, list]) => (
                  <GroupRows key={label} label={label} sub={sub} rows={list} person={person} selected={stopId} onPick={(id) => setStopId(id)} nowBefore={group === "time" ? nowBefore : undefined} clock={s.clock} />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                      Nothing here{q ? ` for “${query}”` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>

        {/* ---------- context: a delivery, a driver, or what needs attention ---------- */}
        <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-card">
          {selRow ? (
            <StopPanel r={selRow} person={person} people={people} onClose={() => setStopId(null)} onDriver={(id) => (setDriverId(id), setStopId(null))} onMove={(to) => setMoved((m) => ({ ...m, [selRow.id]: to }))} />
          ) : selPerson ? (
            <DriverPanel p={selPerson} rows={rows.filter((r) => r.driverIds.includes(selPerson.id))} alerts={alerts.filter((x) => x.driverId === selPerson.id)} onPrev={() => step(-1)} onNext={() => step(1)} onClose={() => setDriverId(null)} onStop={setStopId} />
          ) : (
            <AttentionPanel alerts={alerts} onOpen={(x) => (x.stopId ? setStopId(x.stopId) : x.driverId && setDriverId(x.driverId))} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <span className="px-2 text-right">
      <span className={cn("nums block text-[19px] font-bold leading-none", hot && "text-yellow")}>{value}</span>
      <span className="block text-2xs text-sidebar-muted">{label}</span>
    </span>
  );
}

function Avatar({ p, className }: { p?: Pick<Person, "initials" | "duty">; className?: string }) {
  return (
    <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full bg-teal-soft text-2xs font-bold text-teal-deep", className)}>
      {p?.initials ?? "?"}
      {p && <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card", p.duty === "on" ? "bg-success" : p.duty === "off" ? "bg-control" : "bg-danger")} aria-hidden />}
    </span>
  );
}

function DriverItem({ p, rows, flags, active, onClick }: { p: Person; rows: Row[]; flags: number; active: boolean; onClick: () => void }) {
  const done = rows.filter((r) => r.status === "delivered" || r.status === "cancelled").length;
  const next = rows.find((r) => r.status !== "delivered" && r.status !== "cancelled" && r.status !== "unassigned");
  const late = rows.some((r) => r.lateBy);
  return (
    <button onClick={onClick} aria-current={active} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", active ? "bg-teal-wash shadow-[inset_3px_0_0] shadow-teal-deep" : "hover:bg-muted")}>
      <Avatar p={p} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{p.name}</span>
          {p.live && <span className="rounded bg-yellow-wash px-1 text-[10px] font-bold uppercase text-teal-deep">Live</span>}
        </span>
        <span className="block truncate text-2xs text-muted-foreground">
          {p.duty === "time_off" ? "Time off" : next ? `Next: ${next.name} · ${fmtTime(next.windowStart)}` : rows.length ? "All done" : "Nothing today"}
        </span>
        {rows.length > 0 && (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", late ? "bg-danger" : "bg-teal")} style={{ width: `${(done / rows.length) * 100}%` }} />
            </span>
            <span className="nums text-2xs text-muted-foreground">
              {done}/{rows.length}
            </span>
          </span>
        )}
      </span>
      {flags > 0 && <span className="nums grid size-5 shrink-0 place-items-center rounded-full bg-danger text-[11px] font-bold text-white">{flags}</span>}
    </button>
  );
}

function groups(rows: Row[], by: "time" | "driver", person: (id: string) => Person | undefined): [string, string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = by === "time" ? String(Math.floor(r.windowStart / 60)) : (r.driverIds[0] ?? "");
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const out = [...map.entries()].map(([k, list]): [string, string, Row[]] => {
    if (by === "time") return [fmtTime(+k * 60).replace(":00", ""), `${list.length} ${list.length === 1 ? "delivery" : "deliveries"}`, list];
    const done = list.filter((r) => r.status === "delivered" || r.status === "cancelled").length;
    return [k ? (person(k)?.name ?? k) : "No driver", k ? `${done} of ${list.length} done` : `${list.length} to assign`, list];
  });
  // By driver: "No driver" first, since that's the work to do.
  return by === "driver" ? out.sort((x, y) => (x[0] === "No driver" ? -1 : y[0] === "No driver" ? 1 : 0)) : out;
}

function GroupRows({ label, sub, rows, person, selected, onPick, nowBefore, clock }: { label: string; sub: string; rows: Row[]; person: (id: string) => Person | undefined; selected: string | null; onPick: (id: string) => void; nowBefore?: string; clock: number }) {
  const finished = (r: Row) => r.status === "delivered" || r.status === "cancelled";
  const allDone = rows.length > 0 && rows.every(finished);
  // An hour where everything is delivered folds to one line (tap to open), so live work comes first.
  const [open, setOpen] = useState(!allDone);
  return (
    <>
      <tr>
        {/* Nov 4 2026 (review: "match the theme"): the same soft grey band as the phone's section headers. */}
        <td colSpan={6} className="border-y border-border bg-muted/70 p-0">
          <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-2.5 text-left">
            <span className={cn("text-[17px] font-semibold tracking-tight", allDone ? "text-muted-foreground" : "text-teal-deep")}>{label}</span>
            <span className="text-[13px] text-muted-foreground">{allDone ? `${rows.length} delivered` : sub}</span>
            {allDone && <span className="ml-1 grid size-5 place-items-center rounded-full bg-success text-[11px] font-bold text-white">✓</span>}
            <ChevronRight className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-90")} />
          </button>
        </td>
      </tr>
      {open &&
        rows.map((r) => {
          const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
          const done = finished(r);
          // Problems get a coloured edge and tint: red for late / issue, amber for no driver.
          const alarm = !!r.lateBy || r.status === "issue";
          const warn = !alarm && r.status === "unassigned";
          return (
            <FragmentRow key={r.id}>
              {r.id === nowBefore && (
                <tr data-now>
                  <td colSpan={6} className="p-0">
                    <div className="flex items-center gap-2 px-5 py-1">
                      <span className="nums rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white">Now · {fmtTime(clock)}</span>
                      <span className="h-0.5 flex-1 rounded-full bg-coral/60" />
                    </div>
                  </td>
                </tr>
              )}
              <tr
                onClick={() => onPick(r.id)}
                aria-selected={selected === r.id}
                className={cn(
                  "cursor-pointer border-b border-border",
                  selected === r.id ? "bg-teal-wash" : alarm ? "bg-danger-bg/40 shadow-[inset_4px_0_0] shadow-danger hover:bg-danger-bg/60" : warn ? "bg-warning-bg/40 shadow-[inset_4px_0_0] shadow-warning hover:bg-warning-bg/60" : "bg-card hover:bg-teal-wash/50",
                  done && "text-muted-foreground",
                )}
              >
                <td className="nums px-5 py-3 align-top">
                  <span className={cn("block whitespace-nowrap", alarm ? "font-semibold text-danger" : done ? "" : "font-medium text-foreground/80")}>{fmtWindow(r.windowStart, r.windowEnd)}</span>
                  {r.lateBy ? <span className="block text-2xs font-semibold text-danger">{r.lateBy} min late</span> : r.eta ? <span className="block text-2xs text-muted-foreground">ETA {fmtTime(r.eta)}</span> : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={cn("block text-[15px]", done ? "font-medium" : "font-semibold text-foreground")}>{r.name}</span>
                  <span className="block text-2xs text-muted-foreground">
                    {r.orderNo} · {r.area}
                  </span>
                </td>
                <td className={cn("px-3 py-3 align-top", done && "opacity-60")}>
                  {/* Plain coloured icon + word, no filled pills (as on the phone's lists). */}
                  <WorkTags work={r.work} variant="plain" short chips={false} />
                </td>
                <td className="nums px-3 py-3 text-right align-top text-muted-foreground">{r.meals || "–"}</td>
                <td className="px-3 py-3 align-top">
                  {r.driverIds.length ? (
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        {r.driverIds.slice(0, 3).map((id) => (
                          <span key={id} className="grid size-6 place-items-center rounded-full border-2 border-card bg-teal-soft text-[10px] font-bold text-teal-deep">
                            {person(id)?.initials ?? "?"}
                          </span>
                        ))}
                      </span>
                      <span className="truncate text-[13px]">
                        {person(r.driverIds[0])?.first}
                        {r.driverIds.length > 1 && ` +${r.driverIds.length - 1}`}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-warning px-2.5 text-[13px] font-semibold text-white">
                      <UserX className="size-3.5" /> {r.requestStatus ?? "Assign driver"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <StatusDot tone={meta ? meta.tone : "warning"}>{meta ? meta.label : "No driver"}</StatusDot>
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

/* ---------- right panel: needs attention ---------- */
function AttentionPanel({ alerts, onOpen }: { alerts: Alert[]; onOpen: (x: Alert) => void }) {
  return (
    <>
      <PanelHead title="Needs attention" sub={alerts.length ? `${alerts.length} across all drivers · most urgent first` : "Nothing waiting on you"} />
      {/* Nov 4 2026 (review: "match the theme"): full-width rows with hairlines (no boxed cards), a tinted icon tile
          like the phone's section tiles, and the action as a quiet outline pill. */}
      <div className="flex-1 divide-y divide-border overflow-y-auto">
        {alerts.map((x, i) => (
          <div key={x.id}>
          {/* Nov 4 2026: grouped by urgency, on the same grey bands as the rest of the board. */}
          {(i === 0 || (alerts[i - 1].tone === "danger") !== (x.tone === "danger")) && (
            <div className="border-b border-border bg-muted/70 px-5 py-2 text-[13px] font-semibold text-muted-foreground">
              {x.tone === "danger" ? `Urgent · ${alerts.filter((y) => y.tone === "danger").length}` : `To do · ${alerts.filter((y) => y.tone !== "danger").length}`}
            </div>
          )}
          <div className="px-5 py-3.5">
            <button onClick={() => onOpen(x)} className="flex w-full items-start gap-3 text-left">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", x.tone === "danger" ? "bg-danger-bg text-danger" : x.tone === "warning" ? "bg-warning-bg text-warning" : "bg-teal-wash text-teal-deep")}>
                {x.tone === "danger" ? <AlertTriangle className="size-5" /> : <Clock className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{x.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{x.detail}</span>
              </span>
              <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground/60" />
            </button>
            {x.action && (
              <button onClick={x.action.run} className={cn("ml-[52px] mt-2.5 h-9 rounded-full px-3.5 text-[13px] font-semibold", x.tone === "danger" ? "bg-coral text-white hover:bg-coral-deep" : "border border-teal-deep/30 bg-white text-teal-deep hover:bg-teal-wash")}>
                {x.action.label}
              </button>
            )}
          </div>
          </div>
        ))}
        {alerts.length === 0 && <p className="m-5 rounded-xl bg-success-bg p-4 text-sm font-semibold text-success">All clear. Every delivery has a driver and is on time.</p>}
      </div>
    </>
  );
}

/** Status as a coloured dot and word (calmer than a filled badge in a long table). */
function StatusDot({ tone, children }: { tone: string; children: ReactNode }) {
  const c = tone === "success" ? "bg-success text-success" : tone === "danger" ? "bg-danger text-danger" : tone === "warning" ? "bg-warning text-warning" : tone === "info" ? "bg-info text-info" : "bg-control text-muted-foreground";
  const [dot, text] = c.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold", text)}>
      <span className={cn("size-2 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}

function PanelHead({ title, sub, children, onClose }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-tight">{title}</span>
        {sub && <span className="mt-0.5 block text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {children}
      {onClose && (
        <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-muted">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ---------- right panel: one driver ---------- */
type DriverTab = "today" | "requests" | "hours" | "vehicle";
function DriverPanel({ p, rows, alerts, onPrev, onNext, onClose, onStop }: { p: Person; rows: Row[]; alerts: Alert[]; onPrev: () => void; onNext: () => void; onClose: () => void; onStop: (id: string) => void }) {
  const [tab, setTab] = useState<DriverTab>("today");
  const done = rows.filter((r) => r.status === "delivered" || r.status === "cancelled").length;
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
        <Avatar p={p} className="size-11 text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-tight">{p.name}</span>
          <span className="block text-[13px] text-muted-foreground">
            {p.type} · {p.duty === "on" ? "On duty" : p.duty === "off" ? "Not on duty" : "Time off"} · {done}/{rows.length} done
          </span>
        </span>
        <button onClick={onPrev} aria-label="Previous driver (K)" title="Previous driver (K)" className="grid size-8 place-items-center rounded-full border border-control hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        <button onClick={onNext} aria-label="Next driver (J)" title="Next driver (J)" className="grid size-8 place-items-center rounded-full border border-control hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
        <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex shrink-0 gap-2 border-b border-border px-5 py-3">
        <a href={`tel:${p.phone}`} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-control text-[13px] font-semibold hover:bg-teal-wash">
          <Phone className="size-4" /> Call {p.first}
        </a>
        <button className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-control text-[13px] font-semibold hover:bg-teal-wash">
          <MessageSquare className="size-4" /> Message
        </button>
      </div>
      <div className="flex shrink-0 gap-1 border-b border-border px-3" role="tablist">
        {(
          [
            ["today", "Today"],
            ["requests", "Requests"],
            ["hours", "Hours & time off"],
            ["vehicle", "Vehicle"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-10 border-b-2 px-2.5 text-[13px] font-semibold", tab === k ? "border-teal-deep text-teal-deep" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {tab === "today" && (
          <>
            {alerts.length > 0 && (
              <div className="space-y-1.5">
                {alerts.map((x) => (
                  <div key={x.id} className="flex items-start gap-2 rounded-xl bg-danger-bg px-3 py-2 text-[13px] text-danger">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <b className="font-semibold">{x.title}</b> · {x.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {p.live ? (
              <TodayChanges />
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border">
                {rows.map((r) => {
                  const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
                  return (
                    <button key={r.id} onClick={() => onStop(r.id)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-teal-wash/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.name}</span>
                        <span className={cn("nums block text-2xs", r.lateBy ? "font-semibold text-danger" : "text-muted-foreground")}>
                          {fmtWindow(r.windowStart, r.windowEnd)}
                          {r.lateBy ? ` · ${r.lateBy} min late` : ""}
                        </span>
                      </span>
                      {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                    </button>
                  );
                })}
                {rows.length === 0 && <p className="p-4 text-[13px] text-muted-foreground">No deliveries today.</p>}
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
            <div className="rounded-2xl border border-border px-4 py-3 text-sm">
              <span className="block font-semibold">{p.vehicle}</span>
              <span className="block text-[13px] text-muted-foreground">{p.phone}</span>
            </div>
          ))}
      </div>
    </>
  );
}

function DemoOnly({ p }: { p: Person }) {
  return (
    <p className="rounded-xl bg-muted p-4 text-[13px] text-muted-foreground">
      {p.first}'s requests and hours look the same as Marcus's. In this prototype only Marcus is connected to the phone, so pick him (the <b className="font-semibold">Live</b> driver) to try them.
    </p>
  );
}

/* ---------- right panel: one delivery ---------- */
function StopPanel({ r, person, people, onClose, onDriver, onMove }: { r: Row; person: (id: string) => Person | undefined; people: Person[]; onClose: () => void; onDriver: (id: string) => void; onMove: (to: string) => void }) {
  const { s, a } = useApp();
  const meta = r.status === "unassigned" ? null : STATUS_META[r.status];
  const marcusStop = r.live && routeOf(s).some((x) => x.id === r.id);
  const openOrder = r.live && !marcusStop;
  const req = openOrder ? s.requests.find((x) => x.orderId === r.id) : undefined;
  const done = r.status === "delivered" || r.status === "cancelled";
  return (
    <>
      <PanelHead title={r.name} sub={`${r.orderNo} · ${r.area}`} onClose={onClose} />
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="warning">No driver</Badge>}
          {!!r.lateBy && <Badge tone="danger">{r.lateBy} min late</Badge>}
          <WorkTags work={r.work} variant="plain" short />
        </div>
        <dl className="divide-y divide-border rounded-2xl border border-border text-sm">
          <Field label="Window" value={<span className="nums">{fmtWindow(r.windowStart, r.windowEnd)}</span>} />
          {r.eta && <Field label="ETA" value={<span className={cn("nums", !!r.lateBy && "font-semibold text-danger")}>{fmtTime(r.eta)}</span>} />}
          <Field label="Meals" value={r.meals || "–"} />
          {r.issue && <Field label="Problem" value={<span className="text-danger">{r.issue}</span>} />}
        </dl>

        <section>
          <div className="text-overline mb-2">Driver</div>
          {r.driverIds.length > 0 && (
            <div className="mb-3 divide-y divide-border rounded-2xl border border-border">
              {r.driverIds.map((id) => {
                const p = person(id);
                return (
                  <button key={id} onClick={() => onDriver(id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-teal-wash/50">
                    <Avatar p={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{p?.name ?? id}</span>
                      <span className="block text-2xs text-muted-foreground">{p?.phone}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
          {marcusStop ? (
            <AssignmentPanel stop={r.live!} />
          ) : (
            !done && (
              <div className="space-y-2">
                {openOrder && !req && !s.claims[r.id] && (
                  <button onClick={() => a.sendOrderRequest(r.id)} className="h-9 w-full rounded-full bg-teal text-[13px] font-semibold text-white">
                    Send to {DRIVER.first} to accept
                  </button>
                )}
                {r.requestStatus && <p className="text-[13px] text-muted-foreground">{r.requestStatus}</p>}
                <label className="block">
                  <span className="mb-1 block text-[13px] text-muted-foreground">{r.driverIds.length ? "Move to another driver" : "Or put someone on it"}</span>
                  <select value="" onChange={(e) => e.target.value && onMove(e.target.value)} className="h-10 w-full rounded-xl border border-control bg-card px-3 text-[13px] font-semibold outline-none focus:border-teal">
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
        </section>

        {marcusStop && !done && (
          <section>
            <div className="text-overline mb-2">Change this delivery</div>
            <div className="flex gap-2">
              <button onClick={() => a.changeTime(r.id, 20)} className="h-9 flex-1 rounded-full border border-control text-[13px] font-semibold hover:bg-teal-wash">
                Window +20 min
              </button>
              <button onClick={() => a.cancelOrder(r.id)} className="h-9 flex-1 rounded-full border border-control text-[13px] font-semibold text-danger hover:bg-danger-bg">
                Cancel order
              </button>
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">{DRIVER.first} gets a push on his phone.</p>
          </section>
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
