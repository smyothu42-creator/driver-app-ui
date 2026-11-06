import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Headphones, Inbox, LayoutList, MessageSquare, Minimize2, Phone, RotateCcw, Search, Send, UserX, Users, X } from "lucide-react";
import { routeOf, sentBy, useApp } from "../store";
import { DISPATCH, DRIVER, OPEN_POOL, ROUTE_DATE, SETTINGS, SFK_TEAM, fmtTime, fmtWindow, workOf, type Stop, type StopStatus, type Work } from "../data/route";
import { FLEET, FLEET_ALERTS, FLEET_CHATS, FLEET_STOPS, UNCOVERED, type ChatMsg, type Duty } from "../data/fleet";
import { hoursUntil } from "../screens/Schedule";
import { isOn } from "../data/sprints";
import { AssignmentPanel, DriverProfile, DriverRequests, EditableBlock, OpenHoursEditor, SkipRequests, TimeOffRequests, TodayChanges, UnassignedOrders } from "./DispatchBoard";
import { cn, STATUS_META, WorkTags } from "./ui";

/* ------------------------------------------------------------------
 * Full-screen dispatch board (SFK Admin), Nov 4 2026.
 *
 * Review: "make the dispatch full view understandable, use the Google Material design system, and have all the
 * functions of the side panel too". So it's Material 3 (Roboto, tonal surfaces from SFK teal, a navigation rail,
 * filled / tonal / outlined buttons, filter chips, cards), and it's split into five plain-language destinations:
 *   Board            today's deliveries: summary cards that filter the table, the table, and a side sheet
 *                    ("Needs your attention", or the delivery / driver you picked). Nov 6 2026 (review: "include most
 *                    of the current dispatch board"): brings over the live SFK Admin board's stages (Fulfillment,
 *                    Dispatch ready, In transit, Delivered), row actions, company view and filter, tick-to-assign
 *                    and Export, next to what the driver app adds (alerts, chat, requests).
 *   Requests         everything waiting on an answer: alerts, requests to drivers, orders with no driver,
 *                    pickup skip requests, time off
 *   Drivers          every driver as a card; pick one for their day, requests, hours and vehicle
 *   Hours & vehicle  settings that rarely change: open hours, duty, vehicle and storage details. Nov 6 2026 (review):
 *                    time off and today's route left this page; they live on Requests and the driver's panel.
 *   Messages         Nov 6 2026 (review: "message the driver in more places, it'll be heavily used"): every driver's
 *                    thread. A message icon on table rows, Who's on it, driver cards and alerts opens the same thread
 *                    in a small window over the page, so dispatch keeps their place on the board.
 * Type follows the Material 3 type scale (the m3-* classes in src/index.css, Nov 6 2026).
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
  stage?: Stage;
  readyAt?: number; // Dispatch ready time, as on the live board
}

/** The live board's stages for an order. */
type Stage = "fulfillment" | "ready" | "transit" | "delivered";
const READY_LEAD = 45; // demo: orders are dispatch ready 45 min before their window

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

type Filter = "all" | "attention" | "unassigned" | "late" | "fulfillment" | "ready" | "active" | "done";
const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: "all", label: "All deliveries", hint: "Everything today" },
  { key: "attention", label: "Need you", hint: "Late, a problem, or no driver" },
  { key: "unassigned", label: "No driver", hint: "Waiting for someone" },
  { key: "late", label: "Running late", hint: "Past the window" },
  { key: "fulfillment", label: "Fulfillment", hint: "Still in the kitchen" },
  { key: "ready", label: "Ready", hint: "Dispatch ready: can go out now" },
  { key: "active", label: "In transit", hint: "Driving or on site" },
  { key: "done", label: "Delivered", hint: "Delivered or cancelled" },
];

type Group = "time" | "driver" | "company";
type Page = "board" | "requests" | "drivers" | "hours" | "messages";

/** Messaging, reachable from anywhere on the desk without passing props through every page. */
const Chat = createContext<{ open: (driverId: string, stopId?: string) => void; unread: (driverId: string) => number; can: (driverId: string) => boolean; first: (driverId: string) => string }>({ open: () => {}, unread: () => 0, can: () => false, first: () => "" });

const needsAttention = (r: Row) => r.status === "unassigned" || r.status === "issue" || !!r.lateBy;
const matches = (r: Row, f: Filter) =>
  f === "all" ? true : f === "attention" ? needsAttention(r) : f === "unassigned" ? r.status === "unassigned" : f === "late" ? !!r.lateBy : f === "fulfillment" || f === "ready" ? r.stage === f : f === "active" ? r.status === "en_route" || r.status === "arrived" : r.status === "delivered" || r.status === "cancelled";
const finished = (r: Row) => r.status === "delivered" || r.status === "cancelled";

export function DispatchDesk({ onClose }: { onClose: () => void }) {
  const { s, a } = useApp();
  const [page, setPage] = useState<Page>("board");
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<Group>("time");
  const [company, setCompany] = useState("");
  const [query, setQuery] = useState("");
  const [driverId, setDriverId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  // Demo-only changes to the fixed fleet: reassigned stops and alerts dispatch has dealt with.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  // Messages: the small window over the page, the thread picked on the Messages page, demo sends, and what's been read.
  const [chat, setChat] = useState<{ id: string; stopId?: string } | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, ChatMsg[]>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set());
  // Demo-only stage changes from the row actions. Marcus's go through the state shared with the phone.
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [statusOver, setStatusOver] = useState<Record<string, StopStatus>>({});
  const [staffOf, setStaffOf] = useState<Record<string, string>>({});
  const [fleetVehicles, setFleetVehicles] = useState<Record<string, string>>({}); // demo: edits to the fleet's vehicles

  const people: Person[] = useMemo(
    () => [
      { id: DRIVER.id, name: DRIVER.name, first: DRIVER.first, initials: DRIVER.initials, type: DRIVER.type, duty: !s.signedIn || !s.shiftOn ? "off" : "on", vehicle: `${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}`, phone: DRIVER.phone, live: true },
      ...FLEET.map((f) => ({ ...f, vehicle: fleetVehicles[f.id] ?? f.vehicle })),
    ],
    [s.signedIn, s.shiftOn, s.vehicle, fleetVehicles],
  );
  const person = (id: string) => people.find((p) => p.id === id);

  /* ---------- messages: Marcus's thread is the phone's Chat; the rest of the fleet is demo data ---------- */
  const threadOf = (id: string): ChatMsg[] =>
    person(id)?.live ? [...s.inbox].reverse().map((m) => ({ id: m.id, at: m.at, mine: m.from === "dispatch", text: m.title, sub: m.body, with: m.from === "dispatch" && sentBy(m) !== DISPATCH.name ? sentBy(m).split(" ")[0] : undefined })) : [...(FLEET_CHATS[id] ?? []), ...(sent[id] ?? [])];
  const unreadOf = (id: string) => threadOf(id).filter((m) => !m.mine && !m.read && !seen.has(m.id)).length;
  const canMessage = (id: string) => !!person(id) && person(id)!.type !== "No app"; // no app, nothing to receive it: call instead
  const messageable = people.filter((p) => canMessage(p.id));
  const markSeen = (msgs: ChatMsg[]) => setSeen((prev) => (msgs.every((m) => m.mine || prev.has(m.id)) ? prev : new Set([...prev, ...msgs.filter((m) => !m.mine).map((m) => m.id)])));
  function sendTo(id: string, text: string, stopId?: string) {
    const r = stopId ? rows.find((x) => x.id === stopId) : undefined;
    const full = r ? `${r.name}: ${text}` : text;
    if (person(id)?.live) a.notify({ kind: "info", title: full, stopId: r && routeOf(s).some((x) => x.id === r.id) ? r.id : undefined, priority: "medium" }, { name: "inbox" });
    else setSent((m) => ({ ...m, [id]: [...(m[id] ?? []), { id: `sent-${id}-${(m[id] ?? []).length}`, at: s.clock, mine: true, text: full }] }));
  }
  function openChat(id: string, stopId?: string) {
    if (page === "messages") setChatId(id);
    else setChat({ id, stopId });
  }

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
        status: claim || moved[o.id] ? (statusOver[o.id] ?? "queued") : "unassigned",
        live: o,
        requestStatus: req ? (req.status === "pending" ? `Sent to ${DRIVER.first} · waiting` : req.status === "declined" ? `${DRIVER.first} declined` : undefined) : undefined,
      };
    });
    const fleet: Row[] = FLEET_STOPS.map((x) => {
      const to = moved[x.id];
      const uncovered = UNCOVERED.has(x.id) && !to;
      const status = statusOver[x.id] ?? x.status;
      const lateBy = status !== "delivered" && x.eta && x.eta > x.windowEnd ? x.eta - x.windowEnd : undefined;
      return { ...x, driverIds: uncovered ? [] : [to ?? x.driverId], status: uncovered ? "unassigned" : status, lateBy };
    });
    const stageOf = (r: Row): Stage => (finished(r) ? "delivered" : r.status === "en_route" || r.status === "arrived" || r.status === "issue" ? "transit" : readyIds.has(r.id) || s.clock >= r.windowStart - READY_LEAD ? "ready" : "fulfillment");
    return [...mine, ...pool, ...fleet].sort((x, y) => x.windowStart - y.windowStart || x.name.localeCompare(y.name)).map((r) => ({ ...r, stage: stageOf(r), readyAt: r.windowStart - READY_LEAD }));
  }, [s, moved, readyIds, statusOver]);
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
    (r) => matches(r, filter) && (!company || r.name === company) && (!driverId || page !== "board" || r.driverIds.includes(driverId)) && (!q || [r.name, r.orderNo, r.area, ...r.driverIds.map((id) => person(id)?.name ?? "")].some((t) => t.toLowerCase().includes(q))),
  );

  /* ---------- row actions, as on the live board. Marcus's stops change the state shared with the phone ---------- */
  const isMarcusStop = (id: string) => routeOf(s).some((x) => x.id === id);
  function setStatus(id: string, status: StopStatus) {
    if (isMarcusStop(id)) a.jump((p) => ({ stops: { ...p.stops, [id]: { ...p.stops[id], status, ...(status === "delivered" ? { deliveredAt: p.clock } : { enRouteAt: p.clock }) } } }));
    else setStatusOver((m) => ({ ...m, [id]: status }));
  }
  function assignTo(ids: string[], to: string) {
    const mine = ids.filter(isMarcusStop);
    if (mine.length) a.jump((p) => ({ assignments: { ...p.assignments, ...Object.fromEntries(mine.map((id) => [id, [{ userId: to }]])) } }));
    setMoved((m) => ({ ...m, ...Object.fromEntries(ids.filter((id) => !isMarcusStop(id)).map((id) => [id, to])) }));
  }

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
        if (chat && page !== "messages") setChat(null);
        else if (stopId) setStopId(null);
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
    { key: "messages", label: "Messages", icon: <MessageSquare />, badge: messageable.reduce((n, p) => n + unreadOf(p.id), 0) },
  ];

  return (
    <Chat.Provider value={{ open: openChat, unread: unreadOf, can: canMessage, first: (id) => person(id)?.first ?? "driver" }}>
    <div className="m3-desk anim-fade fixed inset-0 z-[95] flex min-w-[1180px] flex-col" style={{ ...ROBOTO, background: M.surface, color: M.onSurface }}>
      {/* ---------- top app bar ---------- */}
      <header className="flex h-20 shrink-0 items-center gap-4 px-5" style={{ background: M.surface }}>
        <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: M.primaryContainer, color: M.onPrimaryContainer }}>
          <Headphones className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block m3-headline-s">Dispatch</span>
          <span className="nums block m3-body-m" style={{ color: M.onSurfaceVariant }}>
            {DISPATCH.name} · {ROUTE_DATE} · {fmtTime(s.clock)}
          </span>
        </span>
        {/* M3 search bar */}
        <label className="ml-8 flex h-14 w-[520px] items-center gap-3 rounded-full px-5 focus-within:ring-2" style={{ background: M.surfaceHigh, ["--tw-ring-color" as string]: M.primary }}>
          <Search className="size-6 shrink-0" style={{ color: M.onSurfaceVariant }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => (setQuery(e.target.value), setPage("board"))}
            placeholder="Search a customer, order number or driver"
            className="h-full min-w-0 flex-1 bg-transparent m3-body-l outline-none"
            style={{ color: M.onSurface }}
          />
          {query ? (
            <IconButton label="Clear search" onClick={() => setQuery("")}>
              <X />
            </IconButton>
          ) : (
            <kbd className="rounded border px-1.5 m3-body-m" style={{ borderColor: M.outlineVariant, color: M.onSurfaceVariant }}>
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
        <nav aria-label="Dispatch sections" className="flex w-28 shrink-0 flex-col items-center gap-5 pt-5">
          {NAV.map((n) => {
            const on = page === n.key;
            return (
              <button key={n.key} onClick={() => setPage(n.key)} aria-current={on ? "page" : undefined} className="group flex w-full flex-col items-center gap-1">
                <span className={cn("relative grid h-10 w-16 place-items-center rounded-full transition-colors [&_svg]:size-7", !on && "group-hover:bg-black/5")} style={on ? { background: M.secondaryContainer, color: M.onSecondaryContainer } : { color: M.onSurfaceVariant }}>
                  {n.icon}
                  {!!n.badge && (
                    <span className="absolute -right-1 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full px-1 m3-label-m font-medium text-white" style={{ background: M.error }}>
                      {n.badge}
                    </span>
                  )}
                </span>
                <span className={cn("px-1 text-center m3-label-m", on && "!font-bold")} style={{ color: on ? M.onSurface : M.onSurfaceVariant }}>
                  {n.label}
                </span>
              </button>
            );
          })}
          <p className="mt-auto whitespace-nowrap pb-4 text-center m3-label-s !font-normal !tracking-normal" style={{ color: M.onSurfaceVariant }}>
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
              companies={[...new Set(rows.map((r) => r.name))].sort()}
              company={company}
              setCompany={setCompany}
              act={{ ready: (id) => setReadyIds((x) => new Set(x).add(id)), start: (id) => setStatus(id, "en_route"), delivered: (id) => setStatus(id, "delivered"), assign: assignTo }}
            />
          )}
          {page === "requests" && <RequestsPage alerts={alerts} pendingRequests={pendingRequests} onOpen={(x) => (x.stopId ? openStop(x.stopId) : x.driverId && (setPage("drivers"), openDriver(x.driverId)))} />}
          {page === "drivers" && <DriversPage people={people} rows={rows} alerts={alerts} selected={driverId} onPick={openDriver} />}
          {page === "hours" && <HoursPage />}
          {page === "messages" && <MessagesPage people={messageable} threadOf={threadOf} selected={chatId} onPick={setChatId} onSend={sendTo} onSeen={markSeen} />}
        </main>

        {/* ---------- side sheet: a delivery, a driver, or what needs attention ---------- */}
        {(page === "board" || (page === "drivers" && selPerson)) && (
          // On a laptop the table needs the width: the attention list gives way (it's on Requests too, and the rail shows its count).
          <aside className={cn("flex w-[420px] shrink-0 flex-col overflow-hidden", page === "board" && !selRow && !selPerson && "max-[1780px]:hidden")} style={{ background: M.surface }}>
            {page === "board" && selRow ? (
              <StopSheet r={selRow} person={person} people={people} onClose={() => setStopId(null)} onDriver={(id) => (setPage("drivers"), openDriver(id))} onMove={(to) => setMoved((m) => ({ ...m, [selRow.id]: to }))} staff={staffOf[selRow.id] ?? DISPATCH.name} onStaff={(name) => setStaffOf((m) => ({ ...m, [selRow.id]: name }))} />
            ) : selPerson ? (
              <DriverSheet p={selPerson} rows={rows.filter((r) => r.driverIds.includes(selPerson.id))} alerts={alerts.filter((x) => x.driverId === selPerson.id)} onPrev={() => step(-1)} onNext={() => step(1)} onClose={() => setDriverId(null)} onStop={openStop} onVehicle={(v) => setFleetVehicles((m) => ({ ...m, [selPerson.id]: v }))} />
            ) : (
              <AttentionSheet alerts={alerts} onOpen={(x) => (x.stopId ? openStop(x.stopId) : x.driverId && openDriver(x.driverId))} onAll={() => setPage("requests")} />
            )}
          </aside>
        )}
      </div>
      {chat && page !== "messages" && person(chat.id) && (
        <ChatWindow p={person(chat.id)!} msgs={threadOf(chat.id)} about={chat.stopId ? row(chat.stopId)?.name : undefined} onClearAbout={() => setChat({ id: chat.id })} onClose={() => setChat(null)} onSend={(text) => sendTo(chat.id, text, chat.stopId)} onSeen={markSeen} />
      )}
    </div>
    </Chat.Provider>
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
      className={cn("inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full m3-label-l font-medium transition hover:brightness-95 disabled:opacity-40 [&_svg]:size-5", variant === "text" ? "px-3" : icon ? "pl-5 pr-6" : "px-6", className)}
      style={style}
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-black/5 [&_svg]:size-6" style={{ color: M.onSurfaceVariant }}>
      {children}
    </button>
  );
}

function Avatar({ p, size = 40 }: { p?: Pick<Person, "initials" | "duty">; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full m3-label-l font-medium" style={{ width: size, height: size, background: M.primaryContainer, color: M.onPrimaryContainer }}>
      {p?.initials ?? "?"}
      {p && <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2" style={{ borderColor: M.surface, background: p.duty === "on" ? "#2E7D32" : p.duty === "off" ? M.outline : M.error }} aria-hidden />}
    </span>
  );
}

/** Page header: a title and one plain line saying what this page is for. */
function PageHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end gap-4 px-8 pb-5 pt-7">
      <span className="min-w-0 flex-1">
        <h1 className="m3-headline-l">{title}</h1>
        <p className="mt-1 m3-body-l" style={{ color: M.onSurfaceVariant }}>
          {sub}
        </p>
      </span>
      {children}
    </div>
  );
}

function Card({ title, sub, children, className }: { title?: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-white p-6", className)} style={{ borderColor: M.outlineVariant }}>
      {title && <h2 className="m3-title-l">{title}</h2>}
      {sub && (
        <p className="mb-4 mt-0.5 m3-body-l" style={{ color: M.onSurfaceVariant }}>
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
    <span className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 m3-label-l font-medium" style={{ background: c.bg, color: c.fg }}>
      <span className="size-2 rounded-full" style={{ background: c.dot }} aria-hidden />
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
  group: Group;
  setGroup: (g: Group) => void;
  people: Person[];
  person: (id: string) => Person | undefined;
  driverId: string | null;
  setDriverId: (id: string | null) => void;
  stopId: string | null;
  onPick: (id: string) => void;
  clock: number;
  alertsCount: number;
  companies: string[];
  company: string;
  setCompany: (name: string) => void;
  act: RowActions;
}) {
  const { visible, counts, filter, setFilter, group, setGroup, people, person, driverId, setDriverId, stopId, onPick, clock, companies, company, setCompany, act } = p;
  // Ticked rows: assign them together, or limit Export to them. Delivered rows can't be ticked, as on the live board.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(""), 3500);
    return () => window.clearTimeout(t);
  }, [note]);
  const togglePick = (id: string) =>
    setPicked((x) => {
      const n = new Set(x);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const assignable = people.filter((x) => x.duty !== "time_off");
  const exportRows = picked.size ? visible.filter((r) => picked.has(r.id)) : visible;
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
      <PageHead title="Today's deliveries" sub={`${total} deliveries · ${counts.done} delivered · pick a card to filter, click a row to open it`}>
        <ExportMenu rows={exportRows} ticked={picked.size} person={person} onNote={setNote} />
        {/* Segmented button: how the table is grouped. */}
        <div className="flex h-12 overflow-hidden rounded-full border" style={{ borderColor: M.outline }}>
          {(["time", "driver", "company"] as const).map((g, i) => (
            <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={cn("flex items-center gap-1.5 px-5 m3-label-l font-medium", i > 0 && "border-l")} style={{ borderColor: M.outline, background: group === g ? M.secondaryContainer : "transparent", color: group === g ? M.onSecondaryContainer : M.onSurface }}>
              {group === g && <Check className="size-4" />}
              {g === "time" ? "By time" : g === "driver" ? "By driver" : "By company"}
            </button>
          ))}
        </div>
      </PageHead>

      {/* Summary cards double as filters: each says what it counts. */}
      <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(144px,1fr))] gap-3 px-8 pb-5">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const hot = (f.key === "attention" || f.key === "unassigned" || f.key === "late") && counts[f.key] > 0;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={on} title={f.hint} className="min-w-0 rounded-xl border px-4 py-3.5 text-left transition hover:brightness-[0.98]" style={{ borderColor: on ? M.primary : M.outlineVariant, background: on ? M.secondaryContainer : "#fff", boxShadow: on ? `inset 0 0 0 1px ${M.primary}` : undefined }}>
              <span className="nums block m3-headline-m" style={{ color: hot ? M.error : M.onSurface }}>
                {counts[f.key]}
              </span>
              <span className="mt-0.5 block truncate m3-label-l font-medium">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Driver filter chips: everyone, or one driver's day. */}
      <div className="flex shrink-0 items-center gap-2.5 overflow-x-auto px-8 pb-4">
        <FilterChip on={!driverId} onClick={() => setDriverId(null)}>
          All drivers
        </FilterChip>
        {people.map((x) => (
          <FilterChip key={x.id} on={driverId === x.id} onClick={() => setDriverId(driverId === x.id ? null : x.id)}>
            {x.first}
          </FilterChip>
        ))}
        <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Filter by company" className="ml-auto h-11 max-w-[220px] shrink-0 rounded-lg border bg-transparent px-3 m3-label-l font-medium" style={{ borderColor: M.outline, color: M.onSurfaceVariant }}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Tick rows to assign them together or export just those. */}
      {picked.size > 0 && (
        <div className="mx-8 mb-2 flex shrink-0 items-center gap-3 rounded-xl px-4 py-2 m3-body-l" style={{ background: M.secondaryContainer, color: M.onSecondaryContainer }}>
          <span className="font-medium">{picked.size} selected</span>
          <select
            value=""
            aria-label="Assign selected to a driver"
            onChange={(e) => {
              act.assign([...picked], e.target.value);
              setNote(`${picked.size} assigned to ${person(e.target.value)?.first}`);
              setPicked(new Set());
            }}
            className="h-10 rounded-lg border bg-white px-3 m3-label-l font-medium"
            style={{ borderColor: M.outline }}
          >
            <option value="" disabled>
              Assign to…
            </option>
            {assignable.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <MdButton variant="text" className="h-10" onClick={() => setPicked(new Set())}>
            Clear
          </MdButton>
        </div>
      )}

      <div ref={tableRef} className="mx-8 mb-6 min-h-0 flex-1 overflow-auto rounded-xl border bg-white" style={{ borderColor: M.outlineVariant }}>
        <table className="w-full min-w-[1180px] m3-body-l">
          <thead className="sticky top-0 z-10 bg-white text-left m3-label-l font-medium" style={{ color: M.onSurfaceVariant }}>
            <tr className="border-b" style={{ borderColor: M.outlineVariant }}>
              <th className="w-12 py-4 pl-5 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-[190px] px-4 py-4 font-medium">Time window</th>
              <th className="px-4 py-4 font-medium">Customer</th>
              <th className="w-[140px] px-4 py-4 font-medium">Food</th>
              <th className="w-[190px] px-4 py-4 font-medium">Driver</th>
              <th className="w-[160px] px-4 py-4 font-medium">Status</th>
              <th className="sticky right-0 w-[200px] bg-white px-4 py-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {groupRows(visible, group, person).map(([label, sub, list]) => (
              <GroupRows key={label} label={label} sub={sub} rows={list} person={person} selected={stopId} onPick={onPick} nowBefore={nowBefore} clock={clock} picked={picked} onToggle={togglePick} act={act} assignable={assignable} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center" style={{ color: M.onSurfaceVariant }}>
                  No deliveries match. Try another card or “All drivers”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {note && (
        <div role="status" className="anim-fade fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-3 m3-body-l shadow-lg" style={{ background: M.onSurface, color: M.surface }}>
          {note}
        </div>
      )}
    </>
  );
}

/** Export, as on the live board: everything matching the filters, or just the ticked rows. */
function ExportMenu({ rows, ticked, person, onNote }: { rows: Row[]; ticked: number; person: (id: string) => Person | undefined; onNote: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const csv = (file: string, head: string[], body: (r: Row) => (string | number)[]) => {
    const line = (cells: (string | number)[]) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    const url = URL.createObjectURL(new Blob([[line(head), ...rows.map((r) => line(body(r)))].join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
    onNote(`${file} saved · ${rows.length} orders`);
  };
  // Prototype: the PDFs are generated by SFK Admin; here they only say what they'd contain.
  const pdf = (name: string) => onNote(`${name} PDF for ${rows.length} orders comes from SFK Admin`);
  const items: [string, () => void][] = [
    ["Export to Excel", () => csv("dispatch-board.csv", ["Order", "Customer", "Area", "Window", "Dispatch ready", "Meals", "Driver", "Status"], (r) => [r.orderNo, r.name, r.area, fmtWindow(r.windowStart, r.windowEnd), r.readyAt ? fmtTime(r.readyAt) : "", r.meals, r.driverIds.map((id) => person(id)?.name ?? id).join(", "), r.status === "unassigned" ? "No driver" : STATUS_META[r.status].label])],
    ["Special instructions (PDF)", () => pdf("Special instructions")],
    ["Packing lists (PDF)", () => pdf("Packing lists")],
    ["Tent cards (PDF)", () => pdf("Tent cards")],
    ["Tent cards (CSV)", () => csv("tent-cards.csv", ["Order", "Customer", "Meals"], (r) => [r.orderNo, r.name, r.meals])],
  ];
  return (
    <div className="relative">
      <MdButton variant="outlined" icon={<Download />} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-1">
          {ticked ? `Export (${ticked})` : "Export"} <ChevronDown className="size-4" />
        </span>
      </MdButton>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: M.outlineVariant }}>
          <p className="px-4 py-1.5 m3-body-m" style={{ color: M.onSurfaceVariant }}>
            {ticked ? `${ticked} selected orders` : `All ${rows.length} filtered orders`}
          </p>
          {items.map(([label, run]) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                run();
              }}
              className="block h-10 w-full px-4 text-left m3-body-l hover:bg-black/5"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-4 m3-label-l font-medium" style={on ? { background: M.secondaryContainer, borderColor: "transparent", color: M.onSecondaryContainer } : { borderColor: M.outline, color: M.onSurfaceVariant }}>
      {on && <Check className="size-4" />}
      {children}
    </button>
  );
}

function groupRows(rows: Row[], by: Group, person: (id: string) => Person | undefined): [string, string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = by === "time" ? String(Math.floor(r.windowStart / 60)) : by === "company" ? r.name : (r.driverIds[0] ?? "");
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const out = [...map.entries()].map(([k, list]): [string, string, Row[]] => {
    if (by === "time") return [fmtTime(+k * 60).replace(":00", ""), `${list.length} ${list.length === 1 ? "delivery" : "deliveries"}`, list];
    const done = list.filter(finished).length;
    if (by === "company") return [k, `${list.length} ${list.length === 1 ? "order" : "orders"} · ${list.reduce((n, r) => n + r.meals, 0)} meals`, list];
    return [k ? (person(k)?.name ?? k) : "No driver yet", k ? `${done} of ${list.length} done` : `${list.length} to assign`, list];
  });
  if (by === "company") return out.sort((x, y) => x[0].localeCompare(y[0]));
  return by === "driver" ? out.sort((x, y) => (x[0] === "No driver yet" ? -1 : y[0] === "No driver yet" ? 1 : 0)) : out;
}

interface RowActions {
  ready: (id: string) => void;
  start: (id: string) => void;
  delivered: (id: string) => void;
  assign: (ids: string[], to: string) => void;
}

/** The one next step for an order, as on the live board: Mark ready → Start delivery → Mark delivered. */
function RowAction({ r, act }: { r: Row; act: RowActions }) {
  const base = "h-11 w-full !px-3";
  if (r.stage === "fulfillment")
    return (
      <MdButton variant="tonal" className={base} onClick={() => act.ready(r.id)}>
        Mark ready
      </MdButton>
    );
  if (r.stage === "ready")
    return (
      <MdButton variant={r.driverIds.length ? "filled" : "outlined"} className={base} disabled={!r.driverIds.length} onClick={() => act.start(r.id)}>
        {r.driverIds.length ? "Start delivery" : "Assign driver first"}
      </MdButton>
    );
  if (r.stage === "transit")
    return (
      <MdButton variant="filled" className={base} onClick={() => act.delivered(r.id)}>
        Mark delivered
      </MdButton>
    );
  return null;
}

function GroupRows({ label, sub, rows, person, selected, onPick, nowBefore, clock, picked, onToggle, act, assignable }: { label: string; sub: string; rows: Row[]; person: (id: string) => Person | undefined; selected: string | null; onPick: (id: string) => void; nowBefore?: string; clock: number; picked: Set<string>; onToggle: (id: string) => void; act: RowActions; assignable: Person[] }) {
  const allDone = rows.length > 0 && rows.every(finished);
  // An hour where everything is delivered folds to one line (click to open), so live work comes first.
  const [open, setOpen] = useState(!allDone);
  return (
    <>
      <tr>
        <td colSpan={7} className="border-b p-0" style={{ borderColor: M.outlineVariant, background: M.surfaceContainer }}>
          <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-3.5 text-left">
            <ChevronRight className={cn("size-5 transition-transform", open && "rotate-90")} style={{ color: M.onSurfaceVariant }} />
            <span className="m3-title-m font-medium">{label}</span>
            <span className="m3-body-m" style={{ color: M.onSurfaceVariant }}>
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
                  <td colSpan={7} className="p-0">
                    <div className="flex items-center gap-2 px-5 py-1">
                      <span className="nums rounded-full px-2.5 py-0.5 m3-label-l font-medium" style={{ background: M.tertiaryContainer, color: M.onTertiaryContainer }}>
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
                  background: selected === r.id ? "#E8F4F4" : alarm ? "#FFF4F2" : warn ? "#FFF8EA" : "#fff",
                  boxShadow: alarm ? `inset 4px 0 0 ${M.error}` : selected === r.id ? `inset 4px 0 0 ${M.primary}` : warn ? "inset 4px 0 0 #B58A00" : undefined,
                  color: done ? M.onSurfaceVariant : M.onSurface,
                }}
              >
                <td className="py-4 pl-5 align-middle" onClick={(e) => e.stopPropagation()}>
                  {!done && <input type="checkbox" checked={picked.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.orderNo}`} className="block size-5" style={{ accentColor: M.primary }} />}
                </td>
                <td className="nums px-4 py-4 align-middle">
                  <span className="block whitespace-nowrap" style={alarm ? { color: M.error, fontWeight: 500 } : undefined}>
                    {fmtWindow(r.windowStart, r.windowEnd)}
                  </span>
                  {r.lateBy ? (
                    <span className="block m3-label-l font-medium" style={{ color: M.error }}>
                      {r.lateBy} min late
                    </span>
                  ) : r.eta ? (
                    <span className="block m3-body-m" style={{ color: M.onSurfaceVariant }}>
                      ETA {fmtTime(r.eta)}
                    </span>
                  ) : !done && r.readyAt ? (
                    <span className="block m3-body-m" style={{ color: M.onSurfaceVariant }}>
                      Ready {fmtTime(r.readyAt)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-4 align-middle">
                  <span className={cn("block m3-body-l", !done && "font-medium")}>{r.name}</span>
                  <span className="block m3-body-m" style={{ color: M.onSurfaceVariant }}>
                    {r.orderNo} · {r.area}
                  </span>
                </td>
                <td className={cn("px-4 py-4 align-middle", done && "opacity-60")}>
                  <WorkTags work={r.work} variant="plain" short chips={false} />
                  {r.meals > 0 && (
                    <span className="nums m3-body-m block" style={{ color: M.onSurfaceVariant }}>
                      {r.meals} meals
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 align-middle">
                  {r.driverIds.length ? (
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        {r.driverIds.slice(0, 3).map((id) => (
                          <span key={id} className="grid size-8 place-items-center rounded-full border-2 border-white m3-label-s font-medium" style={{ background: M.primaryContainer, color: M.onPrimaryContainer }}>
                            {person(id)?.initials ?? "?"}
                          </span>
                        ))}
                      </span>
                      <span className="truncate m3-body-l">
                        {person(r.driverIds[0])?.first}
                        {r.driverIds.length > 1 && ` +${r.driverIds.length - 1}`}
                      </span>
                      <span className="-my-1 ml-auto">
                        <MessageButton id={r.driverIds[0]} stopId={r.id} />
                      </span>
                    </span>
                  ) : (
                    <label onClick={(e) => e.stopPropagation()} className="inline-flex h-10 max-w-full items-center gap-1 rounded-lg pl-2.5 m3-label-l font-medium" style={{ background: M.warnContainer, color: M.onWarnContainer }}>
                      <UserX className="size-4 shrink-0" />
                      <select value="" onChange={(e) => act.assign([r.id], e.target.value)} aria-label={`Assign a driver to ${r.name}`} className="h-10 min-w-0 max-w-[140px] bg-transparent m3-label-l font-medium outline-none">
                        <option value="" disabled>
                          {r.requestStatus ?? "Needs a driver"}
                        </option>
                        {assignable.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </td>
                <td className="px-4 py-4 align-middle">
                  <StatusChip tone={meta ? meta.tone : "warning"}>{meta ? meta.label : "No driver"}</StatusChip>
                </td>
                {/* Pinned, as on the live board, so the next step stays in view when the table scrolls sideways on a laptop. */}
                <td className="sticky right-0 z-[1] px-4 py-4 align-middle" style={{ background: "inherit" }} onClick={(e) => e.stopPropagation()}>
                  <RowAction r={r} act={act} />
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
        <span className="block m3-headline-s">{title}</span>
        {sub && (
          <span className="mt-1 block m3-body-l" style={{ color: M.onSurfaceVariant }}>
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
  const chat = useContext(Chat);
  const canChat = !!x.driverId && chat.can(x.driverId);
  return (
    <div className="px-6 py-4">
      <button onClick={() => onOpen(x)} className="flex w-full items-start gap-4 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: c.bg, color: c.fg }}>
          {x.tone === "danger" ? <AlertTriangle className="size-5" /> : <Clock className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block m3-body-l">{x.title}</span>
          <span className="mt-0.5 block m3-body-l" style={{ color: M.onSurfaceVariant }}>
            {x.detail}
          </span>
        </span>
        <ChevronRight className="mt-2.5 size-5 shrink-0" style={{ color: M.onSurfaceVariant }} />
      </button>
      {(x.action || canChat) && (
        <div className="ml-16 mt-3 flex flex-wrap items-center gap-1">
          {x.action && (
            <MdButton variant={x.tone === "danger" ? "filled" : "tonal"} onClick={x.action.run} className="h-11">
              {x.action.label}
            </MdButton>
          )}
          {canChat && (
            <MdButton variant="text" icon={<MessageSquare />} onClick={() => chat.open(x.driverId!, x.stopId)} className="h-11">
              Message {chat.first(x.driverId!)}
            </MdButton>
          )}
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
          <p className="mx-6 rounded-xl p-4 m3-body-l" style={{ background: M.successContainer, color: M.onSuccessContainer }}>
            All clear. Every delivery has a driver and is on time.
          </p>
        )}
      </div>
    </>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 pb-1 pt-4 m3-label-l font-medium" style={{ color: M.primary }}>
      {children}
    </div>
  );
}

function StopSheet({ r, person, people, onClose, onDriver, onMove, staff, onStaff }: { r: Row; person: (id: string) => Person | undefined; people: Person[]; onClose: () => void; onDriver: (id: string) => void; onMove: (to: string) => void; staff: string; onStaff: (name: string) => void }) {
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
          <dl className="-my-1 m3-body-l">
            <Field label="Time window" value={<span className="nums">{fmtWindow(r.windowStart, r.windowEnd)}</span>} />
            {r.eta && <Field label="ETA" value={<span className="nums" style={r.lateBy ? { color: M.error } : undefined}>{fmtTime(r.eta)}</span>} />}
            {r.readyAt && <Field label="Dispatch ready" value={<span className="nums">{fmtTime(r.readyAt)}</span>} />}
            <Field label="Meals" value={r.meals || "–"} />
            <Field
              label="Dispatch staff"
              value={
                <select value={staff} onChange={(e) => onStaff(e.target.value)} aria-label="Dispatch staff" className="h-10 max-w-[200px] rounded-lg border bg-white px-2 m3-label-l font-medium" style={{ borderColor: M.outline }}>
                  {[...new Set([DISPATCH.name, ...SFK_TEAM.map((x) => x.name)])].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              }
            />
            {r.issue && <Field label="Problem" value={<span style={{ color: M.error }}>{r.issue}</span>} />}
          </dl>
        </Card>

        <Card title="Who's on it" sub={r.driverIds.length ? "Click a driver to see their whole day." : "Nobody yet. Send it to a driver or put someone on it."}>
          {r.driverIds.map((id) => {
            const p = person(id);
            return (
              <div key={id} className="relative -mx-2">
                <button onClick={() => onDriver(id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5">
                  <Avatar p={p} />
                  <span className="min-w-0 flex-1 pr-10">
                    <span className="block m3-body-l">{p?.name ?? id}</span>
                    <span className="block m3-body-m" style={{ color: M.onSurfaceVariant }}>
                      {p?.phone}
                    </span>
                  </span>
                  <ChevronRight className="size-5" style={{ color: M.onSurfaceVariant }} />
                </button>
                <span className="absolute right-8 top-1/2 -translate-y-1/2">
                  <MessageButton id={id} stopId={r.id} />
                </span>
              </div>
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
                {r.requestStatus && <p className="m3-body-l" style={{ color: M.onSurfaceVariant }}>{r.requestStatus}</p>}
                <label className="block">
                  <span className="mb-1 block m3-label-l font-medium" style={{ color: M.onSurfaceVariant }}>
                    {r.driverIds.length ? "Move to another driver" : "Put a driver on it"}
                  </span>
                  <select value="" onChange={(e) => e.target.value && onMove(e.target.value)} className="h-12 w-full rounded-xl border bg-white px-3 m3-body-l outline-none focus:border-2" style={{ borderColor: M.outline }}>
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
    <div className="flex items-center justify-between gap-3 py-3">
      <dt style={{ color: M.onSurfaceVariant }}>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

type DriverTab = "today" | "requests" | "hours" | "vehicle";
function DriverSheet({ p, rows, alerts, onPrev, onNext, onClose, onStop, onVehicle }: { p: Person; rows: Row[]; alerts: Alert[]; onPrev: () => void; onNext: () => void; onClose: () => void; onStop: (id: string) => void; onVehicle: (vehicle: string) => void }) {
  const [tab, setTab] = useState<DriverTab>("today");
  const chat = useContext(Chat);
  const done = rows.filter(finished).length;
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-4 pt-3">
        <IconButton label="Previous driver (K)" onClick={onPrev}>
          <ChevronLeft />
        </IconButton>
        <IconButton label="Next driver (J)" onClick={onNext}>
          <ChevronRight />
        </IconButton>
        <span className="flex-1" />
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="flex shrink-0 items-center gap-3 px-6 pb-4 pt-1">
        <Avatar p={p} size={56} />
        <span className="min-w-0 flex-1">
          <span className="m3-headline-s block">{p.name}</span>
          <span className="m3-body-m block" style={{ color: M.onSurfaceVariant }}>
            {p.type} · {p.duty === "on" ? "On duty" : p.duty === "off" ? "Not on duty" : "Time off"} · {done}/{rows.length} done
          </span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2 px-6 pb-3">
        <MdButton variant="tonal" icon={<Phone />} className="flex-1" onClick={() => (window.location.href = `tel:${p.phone}`)}>
          Call {p.first}
        </MdButton>
        <MdButton variant="outlined" icon={<MessageSquare />} className="flex-1" disabled={!chat.can(p.id)} onClick={() => chat.open(p.id)}>
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
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="relative h-12 flex-1 m3-label-l font-medium" style={{ color: tab === k ? M.primary : M.onSurfaceVariant }}>
            {label}
            {tab === k && <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-t-full" style={{ background: M.primary }} />}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {tab === "today" && (
          <>
            {alerts.map((x) => (
              <div key={x.id} className="flex items-start gap-2 rounded-xl px-3 py-2.5 m3-body-l" style={{ background: TONE[x.tone].bg, color: TONE[x.tone].fg }}>
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
                        <span className="block truncate m3-body-l">{r.name}</span>
                        <span className="nums block m3-body-m" style={{ color: r.lateBy ? M.error : M.onSurfaceVariant }}>
                          {fmtWindow(r.windowStart, r.windowEnd)}
                          {r.lateBy ? ` · ${r.lateBy} min late` : ""}
                        </span>
                      </span>
                      {meta && <StatusChip tone={meta.tone}>{meta.label}</StatusChip>}
                    </button>
                  );
                })}
                {rows.length === 0 && <p className="p-4 m3-body-l" style={{ color: M.onSurfaceVariant }}>No deliveries today.</p>}
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
            <DriverProfile defaultOpen />
          ) : (
            <Card>
              <FleetVehicle key={p.id} p={p} onSave={onVehicle} />
            </Card>
          ))}
      </div>
    </>
  );
}

/** The vehicle of a driver who isn't connected to the phone in this prototype: one line, behind the same pencil. */
function FleetVehicle({ p, onSave }: { p: Person; onSave: (vehicle: string) => void }) {
  const [draft, setDraft] = useState(p.vehicle);
  return (
    <EditableBlock
      label="vehicle"
      className=""
      canSave={!!draft.trim() && draft.trim() !== p.vehicle}
      onSave={() => onSave(draft.trim())}
      onCancel={() => setDraft(p.vehicle)}
      view={
        <>
          <p className="m3-body-l">{p.vehicle}</p>
          <p className="m3-body-l" style={{ color: M.onSurfaceVariant }}>
            {p.phone}
          </p>
        </>
      }
      edit={
        <label className="block m3-body-l" style={{ color: M.onSurfaceVariant }}>
          Vehicle
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 m3-body-l outline-none" style={{ borderColor: M.outline, color: M.onSurface }} />
        </label>
      }
    />
  );
}

function DemoOnly({ p }: { p: Person }) {
  return (
    <p className="rounded-xl p-4 m3-body-l" style={{ background: M.surfaceContainer, color: M.onSurfaceVariant }}>
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
            {alerts.length === 0 && <p className="px-5 pb-4 m3-body-l">All clear.</p>}
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
            <h2 className="pb-2 m3-label-l font-medium" style={{ color: M.primary }}>
              {label} · {list.length}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(370px,1fr))] gap-3">
              {list.map((p) => {
                const mine = rows.filter((r) => r.driverIds.includes(p.id) || (p.id === "u-ken" && UNCOVERED.has(r.id) && r.status === "unassigned"));
                const done = mine.filter(finished).length;
                const next = mine.find((r) => !finished(r) && r.status !== "unassigned");
                const flags = alerts.filter((x) => x.driverId === p.id).length;
                const late = mine.some((r) => r.lateBy);
                const on = selected === p.id;
                return (
                  <div key={p.id} className="relative">
                  <button onClick={() => onPick(p.id)} aria-pressed={on} className="h-full w-full rounded-xl border bg-white p-4 text-left transition hover:brightness-[0.98]" style={{ borderColor: on ? M.primary : M.outlineVariant, boxShadow: on ? `inset 0 0 0 1px ${M.primary}` : undefined }}>
                    <span className="flex items-center gap-3 pr-8">
                      <Avatar p={p} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate m3-title-m font-medium">{p.name}</span>
                          {p.live && (
                            <span className="rounded px-1.5 m3-label-m font-medium" style={{ background: M.tertiaryContainer, color: M.onTertiaryContainer }}>
                              Live
                            </span>
                          )}
                        </span>
                        <span className="block truncate m3-body-m" style={{ color: M.onSurfaceVariant }}>
                          {p.type} · {p.vehicle}
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 block truncate m3-body-l">{p.duty === "time_off" ? "Time off today" : next ? `Next: ${next.name} · ${fmtTime(next.windowStart)}` : mine.length ? "All deliveries done" : "Nothing today"}</span>
                    {flags > 0 && mine.length === 0 && (
                      <span className="mt-2 block">
                        <StatusChip tone="danger">{flags} need you</StatusChip>
                      </span>
                    )}
                    {mine.length > 0 && (
                      <span className="mt-2 flex items-center gap-3">
                        <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: M.surfaceHigh }}>
                          <span className="block h-full rounded-full" style={{ width: `${(done / mine.length) * 100}%`, background: late ? M.error : M.primary }} />
                        </span>
                        {flags > 0 && <StatusChip tone="danger">{flags} need you</StatusChip>}
                        <span className="nums m3-body-m" style={{ color: M.onSurfaceVariant }}>
                          {done}/{mine.length} done
                        </span>
                      </span>
                    )}
                  </button>
                  <span className="absolute right-3 top-3">
                    <MessageButton id={p.id} />
                  </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ================================================================== Messages */

/** The message icon used across the desk. Nothing for a driver without the app; a dot when they've written. */
function MessageButton({ id, stopId }: { id: string; stopId?: string }) {
  const chat = useContext(Chat);
  if (!chat.can(id)) return null;
  const n = chat.unread(id);
  const label = `Message ${chat.first(id)}${n ? `, ${n} unread` : ""}`;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // the row or card under it opens something else
        chat.open(id, stopId);
      }}
      aria-label={label}
      title={label}
      className="relative grid size-10 shrink-0 place-items-center rounded-full hover:bg-black/10 [&_svg]:size-[22px]"
      style={{ color: M.primary }}
    >
      <MessageSquare />
      {n > 0 && <span className="absolute right-1 top-1 size-3 rounded-full border-2 border-white" style={{ background: M.error }} aria-hidden />}
    </button>
  );
}

const QUICK_TO_DRIVER = ["What's your ETA?", "Can you call me?", "Thanks!"];

/** A thread with a driver: the Messages page and the small window both use it. Enter sends; Shift+Enter is a new line. */
function Thread({ p, msgs, about, onClearAbout, onSend, onSeen }: { p: Person; msgs: ChatMsg[]; about?: string; onClearAbout?: () => void; onSend: (text: string) => void; onSeen: (msgs: ChatMsg[]) => void }) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    onSeen(msgs);
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);
  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  };
  return (
    <>
      <ol ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 [&>li:first-child]:mt-auto" style={{ background: M.surfaceLow }}>
        {msgs.map((m) => (
          <li key={m.id} className={cn("flex", m.mine && "justify-end")}>
            <span className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 m3-body-l", !m.mine && "border bg-white")} style={m.mine ? { background: M.primary, color: M.onPrimary } : { borderColor: M.outlineVariant }}>
              <span className="block">{m.text}</span>
              {m.sub && <span className="mt-0.5 block m3-body-m opacity-80">{m.sub}</span>}
              <span className="nums mt-1 block m3-body-m opacity-70">
                {m.mine ? (m.with ?? "You") : p.first} · {fmtTime(m.at)}
              </span>
            </span>
          </li>
        ))}
        {msgs.length === 0 && (
          <li className="text-center m3-body-l" style={{ color: M.onSurfaceVariant }}>
            No messages with {p.first} yet.
          </li>
        )}
      </ol>
      <div className="shrink-0 border-t bg-white p-3" style={{ borderColor: M.outlineVariant }}>
        {about && (
          <span className="mb-2 inline-flex h-10 max-w-full items-center gap-1 rounded-lg pl-3 pr-1 m3-label-l font-medium" style={{ background: M.secondaryContainer, color: M.onSecondaryContainer }}>
            <span className="truncate">About {about}</span>
            <button onClick={onClearAbout} aria-label="Not about this delivery" className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-black/10">
              <X className="size-4" />
            </button>
          </span>
        )}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_TO_DRIVER.map((q) => (
            <button key={q} onClick={() => onSend(q)} className="h-10 rounded-lg border px-3.5 m3-label-l font-medium hover:bg-black/5" style={{ borderColor: M.outline, color: M.onSurfaceVariant }}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message ${p.first}…`}
            aria-label={`Message to ${p.name}`}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-[24px] border px-4 py-2.5 m3-body-l outline-none"
            style={{ borderColor: M.outline }}
          />
          <button type="submit" aria-label="Send" disabled={!draft.trim()} className="grid size-12 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: M.primary, color: M.onPrimary }}>
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </>
  );
}

function ThreadHead({ p, children }: { p: Person; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: M.outlineVariant }}>
      <Avatar p={p} />
      <span className="min-w-0 flex-1">
        <span className="block truncate m3-title-m font-medium">{p.name}</span>
        <span className="block truncate m3-body-m" style={{ color: M.onSurfaceVariant }}>
          {p.duty === "on" ? "On duty" : p.duty === "off" ? "Not on duty" : "Time off"} · {p.phone}
        </span>
      </span>
      <IconButton label={`Call ${p.first}`} onClick={() => (window.location.href = `tel:${p.phone}`)}>
        <Phone />
      </IconButton>
      {children}
    </div>
  );
}

/** The thread in a small window over the page, so dispatch keeps their place on the board. */
function ChatWindow({ p, msgs, about, onClearAbout, onClose, onSend, onSeen }: { p: Person; msgs: ChatMsg[]; about?: string; onClearAbout: () => void; onClose: () => void; onSend: (text: string) => void; onSeen: (msgs: ChatMsg[]) => void }) {
  return (
    <div role="dialog" aria-label={`Messages with ${p.name}`} className="absolute bottom-4 right-6 z-20 flex h-[620px] max-h-[calc(100%-112px)] w-[460px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl" style={{ borderColor: M.outlineVariant }}>
      <ThreadHead p={p}>
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </ThreadHead>
      <Thread key={p.id} p={p} msgs={msgs} about={about} onClearAbout={onClearAbout} onSend={onSend} onSeen={onSeen} />
    </div>
  );
}

function MessagesPage({ people, threadOf, selected, onPick, onSend, onSeen }: { people: Person[]; threadOf: (id: string) => ChatMsg[]; selected: string | null; onPick: (id: string) => void; onSend: (id: string, text: string) => void; onSeen: (msgs: ChatMsg[]) => void }) {
  const chat = useContext(Chat);
  const lastOf = (id: string) => threadOf(id)[threadOf(id).length - 1];
  const sorted = [...people].sort((x, y) => (lastOf(y.id)?.at ?? -1) - (lastOf(x.id)?.at ?? -1));
  const p = people.find((x) => x.id === selected) ?? sorted[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead title="Messages" sub={`One chat per driver, shared by all dispatch staff: anyone can read and reply. ${DRIVER.first}'s messages show on the phone right away.`} />
      <div className="flex min-h-0 flex-1 gap-4 px-8 pb-6">
        <div className="w-[380px] shrink-0 divide-y overflow-y-auto rounded-xl border bg-white" style={{ borderColor: M.outlineVariant }}>
          {sorted.map((x) => {
            const last = lastOf(x.id);
            const n = x.id === p.id ? 0 : chat.unread(x.id);
            return (
              <button key={x.id} onClick={() => onPick(x.id)} aria-current={x.id === p.id ? "true" : undefined} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:brightness-[0.97]" style={{ borderColor: M.outlineVariant, background: x.id === p.id ? M.secondaryContainer : "#fff" }}>
                <Avatar p={x} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate m3-body-l", n > 0 && "font-medium")}>{x.name}</span>
                    {last && (
                      <span className="nums shrink-0 m3-body-m" style={{ color: M.onSurfaceVariant }}>
                        {fmtTime(last.at)}
                      </span>
                    )}
                  </span>
                  <span className="block truncate m3-body-m" style={{ color: M.onSurfaceVariant }}>
                    {last ? `${last.mine ? `${last.with ?? "You"}: ` : ""}${last.text}` : "No messages yet"}
                  </span>
                </span>
                {n > 0 && (
                  <span className="nums grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 m3-label-l font-medium text-white" style={{ background: M.error }}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white" style={{ borderColor: M.outlineVariant }}>
          <ThreadHead p={p} />
          <Thread key={p.id} p={p} msgs={threadOf(p.id)} onSend={(text) => onSend(p.id, text)} onSeen={onSeen} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== Hours & vehicle */

function HoursPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <PageHead title="Hours & vehicle" sub={`${DRIVER.first}'s settings that rarely change. Day-to-day work is on Board and Requests.`} />
      <div className="grid grid-cols-2 items-start gap-4 px-8">
        <Card title="Weekly hours" sub="The days and times a driver can be sent work. Requests outside them are flagged.">
          <OpenHoursEditor />
        </Card>
        <Card title="Duty & vehicle" sub="Whether he's on duty (and sharing location), his vehicle, and the storage notes. Click a pencil to change one.">
          <DriverProfile defaultOpen />
        </Card>
      </div>
    </div>
  );
}
