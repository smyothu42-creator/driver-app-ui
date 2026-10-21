import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { isStaffAvailable, routeOf, useApp, vehicleOf } from "../store";
import { DRIVER, OPEN_POOL, ROUTE_DATE, ROUTE_ISO, SETTINGS, STAFF, STAFF_ROLES, VEHICLES, WEEKDAYS, fmtTime, fmtWindow, type OpenDay, type StaffMember, type StaffRole, type Stop } from "../data/route";
import { hoursUntil } from "../screens/Schedule";
import { DEFAULT_HOURS, TIME_OPTIONS } from "../data/availability";
import { Badge, cn, RoleBadge } from "./ui";

/* ------------------------------------------------------------------
 * SFK Admin dispatch surfaces for US-814 (multi-driver) and US-815 (role labels).
 * They live in the prototype guide because the dispatch board is a separate product;
 * they share state with the phone, so edits here show up on the driver's screens.
 * ------------------------------------------------------------------ */

export interface DriverOption extends StaffMember {
  isAvailable: boolean;
}

/** Orders with someone on them: Marcus's route (with route numbers) plus open orders other drivers claimed. */
function useBoardOrders() {
  const { s } = useApp();
  return [...routeOf(s), ...OPEN_POOL.filter((o) => s.claims[o.id] && s.claims[o.id].by !== DRIVER.id)];
}

export function DispatchBoard() {
  const { s } = useApp();
  const [openId, setOpenId] = useState<string | null>(s.focusId);
  const orders = useBoardOrders();

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground">
        SFK Admin view. Assign several people to a delivery and label their role. Marcus is grayed out wherever the time off he booked on his phone covers the window. For a driver without the app, assign “Appless driver (office)” and mark it delivered from the Simulate tab (#74).
      </p>

      <DriverRequests />

      <TimeOffRequests />

      <UnassignedOrders />

      <section>
        <div className="text-overline mb-2">Dispatch board · {ROUTE_DATE}</div>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {orders.map((stop) => (
            <div key={stop.id}>
              <BoardRow stop={stop} open={openId === stop.id} onToggle={() => setOpenId(openId === stop.id ? null : stop.id)} />
              {openId === stop.id && <AssignmentPanel stop={stop} />}
            </div>
          ))}
        </div>
      </section>

      <RunSheet />
    </div>
  );
}

/** Board row: every assigned person, stacked, each with their role pill (if any). */
function BoardRow({ stop, open, onToggle }: { stop: Stop; open: boolean; onToggle: () => void }) {
  const { s } = useApp();
  const list = s.assignments[stop.id] ?? [];
  return (
    <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-teal-wash/50">
      <span className="nums mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 border-teal-deep text-2xs font-bold text-teal-deep">{stop.seq || "+"}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {stop.name} <span className="font-normal text-muted-foreground">· {stop.orderNo}</span>
        </span>
        <span className="nums block text-2xs text-muted-foreground">{fmtWindow(stop.windowStart, stop.windowEnd)}</span>
        <span className="mt-1.5 flex flex-col items-start gap-1">
          {list.length === 0 && <Badge tone="warning">Unassigned</Badge>}
          {list.map((x) => (
            <span key={x.userId} className="flex items-center gap-1.5 text-[13px]">
              {STAFF.find((m) => m.id === x.userId)!.name}
              <RoleBadge role={x.role} />
            </span>
          ))}
        </span>
      </span>
      <ChevronRight className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
    </button>
  );
}

/** Inline editor under a board row: multi-select for people, then one role dropdown per person. */
function AssignmentPanel({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const list = s.assignments[stop.id] ?? [];
  const options: DriverOption[] = STAFF.map((m) => ({ ...m, isAvailable: isStaffAvailable(s, m, stop) }));

  return (
    <div className="space-y-3 border-t border-dashed border-border bg-teal-wash/40 px-4 py-3">
      <div>
        <div className="text-overline mb-1.5">Drivers</div>
        <DriverMultiSelect options={options} value={list.map((x) => x.userId)} onChange={(ids) => a.setAssignees(stop.id, ids)} />
      </div>
      <VehicleSelect stop={stop} />
      {list.length > 0 && (
        <div>
          <div className="text-overline mb-1.5">Roles</div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {list.map((x) => (
              <li key={x.userId} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{STAFF.find((m) => m.id === x.userId)!.name}</span>
                <RoleSelect value={x.role} onChange={(r) => a.setRole(stop.id, x.userId, r)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- DriverMultiSelect ---------------- */

interface DriverMultiSelectProps {
  options: DriverOption[];
  value: string[]; // selected staff ids, in assignment order; a one-item array is a legacy single-driver assignment
  onChange: (ids: string[]) => void;
  maxChips?: number;
}

/** Searchable checkbox dropdown. Closed, it shows `maxChips` chips and a "+N more" chip; open, it shows them all. */
export function DriverMultiSelect({ options, value, onChange, maxChips = 2 }: DriverMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Escape closes only the dropdown; stopPropagation keeps the guide panel's own Escape handler from firing too.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const byId = (id: string) => options.find((o) => o.id === id)!;
  const shown = open ? value : value.slice(0, maxChips);
  const hidden = value.length - shown.length;
  const filtered = options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={root} onKeyDown={onKey}>
      <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-card p-1.5", open ? "border-teal ring-2 ring-teal/30" : "border-control")}>
        {shown.map((id) => (
          <AssigneeChip key={id} option={byId(id)} onRemove={() => onChange(value.filter((v) => v !== id))} />
        ))}
        {hidden > 0 && (
          <button onClick={() => setOpen(true)} className="h-8 rounded-full border border-control bg-muted px-2.5 text-xs font-semibold text-muted-foreground">
            +{hidden} more
          </button>
        )}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Choose drivers"
          className="flex h-8 min-w-8 flex-1 items-center justify-end gap-1 px-1.5 text-sm text-muted-foreground"
        >
          {value.length === 0 && <span className="mr-auto">Assign drivers</span>}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        // Rendered in-flow (not absolutely positioned) so the guide panel's scroll area never clips it.
        <div className="anim-fade mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff" aria-label="Search staff" className="h-10 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => {
              const checked = value.includes(o.id);
              // Unavailable people can't be added, but if they're already on the delivery they can still be removed.
              const disabled = !o.isAvailable && !checked;
              return (
                <li key={o.id} role="option" aria-selected={checked} aria-disabled={disabled}>
                  <label className={cn("flex h-11 items-center gap-3 px-3 text-sm", disabled ? "cursor-not-allowed text-muted-foreground opacity-60" : "cursor-pointer hover:bg-teal-wash")}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(o.id)} className="size-4 accent-teal" />
                    <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                    {!o.isAvailable && <span className="text-2xs">Not available</span>}
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No staff match “{query}”</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function AssigneeChip({ option, onRemove }: { option: DriverOption; onRemove: () => void }) {
  return (
    <span
      title={option.isAvailable ? undefined : "Not available for this delivery window"}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border pl-2.5 pr-1 text-xs font-semibold",
        option.isAvailable ? "border-teal-soft bg-teal-wash text-teal-deep" : "border-dashed border-control bg-muted text-muted-foreground",
      )}
    >
      {option.name}
      <button onClick={onRemove} aria-label={`Remove ${option.name}`} className="grid size-6 place-items-center rounded-full hover:bg-black/5">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

/** Inline role dropdown. Saves on change, with no save button and no toast. */
function RoleSelect({ value, onChange }: { value?: StaffRole; onChange: (r: StaffRole | undefined) => void }) {
  return (
    <select
      aria-label="Role"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as StaffRole | undefined)}
      className={cn("h-9 rounded-lg border border-control bg-card px-2 text-[13px] font-semibold outline-none focus:border-teal", !value && "text-muted-foreground")}
    >
      <option value="">No role</option>
      {STAFF_ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

/* ---------------- Run sheet ---------------- */

function RunSheet() {
  const { s } = useApp();
  const orders = useBoardOrders();
  return (
    <section>
      <div className="text-overline mb-2">Run sheet</div>
      <table className="w-full overflow-hidden rounded-2xl border border-border text-[13px]">
        <thead className="bg-muted text-left text-2xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Stop</th>
            <th className="px-3 py-2 font-semibold">Driver</th>
            <th className="px-3 py-2 font-semibold">Role</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((stop) => {
            const list = s.assignments[stop.id] ?? [];
            const rows = list.length ? list : [null];
            // One line per person; the stop cell spans them so multi-driver stops read as one delivery.
            return rows.map((x, i) => (
              <tr key={stop.id + (x?.userId ?? "none")} className={cn(i === 0 && "border-t border-border")}>
                {i === 0 && (
                  <td rowSpan={rows.length} className="px-3 py-2 align-top font-semibold">
                    {stop.seq ? `${stop.seq}. ` : ""}
                    {stop.name}
                  </td>
                )}
                <td className="px-3 py-1.5">{x ? STAFF.find((m) => m.id === x.userId)!.name : <span className="text-warning">Unassigned</span>}</td>
                {/* Legacy assignments without a role leave this cell empty, with no placeholder text. */}
                <td className="px-3 py-1.5 text-muted-foreground">{x?.role ?? ""}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </section>
  );
}

/* ---------------- Unassigned orders: dispatch sends them as requests (drivers don't browse) ---------------- */

export function UnassignedOrders() {
  const { s, a } = useApp();
  return (
    <section>
      <SectionHead title="Unassigned today" />
      <div className="divide-y divide-border rounded-2xl border border-border">
        {OPEN_POOL.map((o) => {
          const accepted = s.claims[o.id];
          const req = s.requests.find((r) => r.orderId === o.id);
          const who = accepted && (accepted.by === DRIVER.id ? DRIVER.name : STAFF.find((m) => m.id === accepted.by)?.name);
          return (
            <div key={o.id} className="space-y-1 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{o.name}</span>
                  <span className="nums block text-2xs text-muted-foreground">{fmtWindow(o.windowStart, o.windowEnd)}</span>
                </span>
                {accepted ? (
                  <Badge tone="success">Accepted · {who?.split(" ")[0]}</Badge>
                ) : req?.status === "declined" ? (
                  <Badge tone="danger">Declined</Badge>
                ) : req ? (
                  <Badge tone="warning">Pending</Badge>
                ) : (
                  <button onClick={() => a.sendOrderRequest(o.id)} className="h-8 shrink-0 rounded-full bg-teal px-3 text-[13px] font-semibold text-white">
                    Send to {DRIVER.first}
                  </button>
                )}
              </div>
              {req?.status === "declined" && <p className="text-2xs text-foreground">“{req.reason}”</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- #79 / #80 vehicle per delivery ---------------- */

/** Driver's default vehicle or an SFK van. A van already on another delivery is greyed but can still be picked, so dispatch can fix overlaps. */
function VehicleSelect({ stop }: { stop: Stop }) {
  const { s, a } = useApp();
  const value = vehicleOf(s, stop.id);
  const inUse = (vid: string) => Object.entries(s.vehicleFor).some(([sid, v]) => v === vid && sid !== stop.id);
  return (
    <div>
      <div className="text-overline mb-1.5">Vehicle</div>
      <select
        aria-label="Vehicle"
        value={value}
        onChange={(e) => a.setVehicle(stop.id, e.target.value)}
        className="h-10 w-full rounded-xl border border-control bg-card px-3 text-[13px] font-semibold outline-none focus:border-teal"
      >
        {VEHICLES.map((v) => (
          <option key={v.id} value={v.id} className={inUse(v.id) ? "text-muted-foreground" : undefined}>
            {v.owner === "driver" ? "Driver's default vehicle" : v.name}
            {inUse(v.id) ? " · in use on another delivery" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------- #76 time-off requests ---------------- */

export function TimeOffRequests() {
  const { s, a } = useApp();
  const list = Object.entries(s.availability).filter(([iso, d]) => iso >= ROUTE_ISO && d.status === "unavailable");
  return (
    <section>
      <SectionHead title="Time off" />
      {list.length === 0 ? (
        <p className="rounded-xl bg-muted p-3 text-[13px] text-muted-foreground">No requests</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {list.map(([iso, d]) => (
            <div key={iso} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="nums flex-1 font-semibold">{new Date(iso + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              {d.requested ? (
                <>
                  <button onClick={() => a.reviewTimeOff(iso, true)} className="h-8 rounded-full bg-teal px-3 text-[13px] font-semibold text-white">
                    Approve
                  </button>
                  <button onClick={() => a.reviewTimeOff(iso, false)} className="h-8 rounded-full border border-control px-3 text-[13px] font-semibold">
                    Decline
                  </button>
                </>
              ) : (
                <Badge tone="success">Approved</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- Reusables pickups: skip requests from the driver (Oct 21 2026) ---------------- */
export function SkipRequests() {
  const { s, a } = useApp();
  const list = routeOf(s).filter((x) => x.kind === "pickup" && s.stops[x.id].skip);
  return (
    <section>
      <SectionHead title="Pickup skip requests" />
      {list.length === 0 ? (
        <p className="rounded-xl bg-muted p-3 text-[13px] text-muted-foreground">No requests</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {list.map((x) => {
            const skip = s.stops[x.id].skip!;
            return (
              <div key={x.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {x.name} · {x.orderNo}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">{skip.reason}</span>
                </span>
                {skip.status === "pending" ? (
                  <>
                    <button onClick={() => a.decideSkip(x.id, true)} className="h-8 rounded-full bg-teal px-3 text-[13px] font-semibold text-white">
                      Approve
                    </button>
                    <button onClick={() => a.decideSkip(x.id, false)} className="h-8 rounded-full border border-control px-3 text-[13px] font-semibold">
                      Decline
                    </button>
                  </>
                ) : (
                  <Badge tone={skip.status === "approved" ? "success" : "danger"}>{skip.status === "approved" ? "Skipped" : "Declined"}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- #77 driver request status, #18 reminders + 48-hour flag ---------------- */
const REQ_BADGE = {
  pending: { tone: "warning", label: "Pending" },
  accepted: { tone: "success", label: "Accepted" },
  declined: { tone: "danger", label: "Declined" },
} as const;

export function DriverRequests() {
  const { s, a } = useApp();
  const list = s.requests.filter((r) => !r.placeholder && !r.orderId).sort((x, y) => x.dateISO.localeCompare(y.dateISO));
  const pending = list.filter((r) => r.status === "pending").length;
  return (
    <section>
      <SectionHead
        title={`Requests · ${DRIVER.first}`}
        action={
          <span className="flex gap-1.5">
            <button onClick={a.remindRequests} disabled={!pending} className="h-8 rounded-full border border-control px-3 text-[13px] font-semibold disabled:opacity-40">
              Remind
            </button>
            <button onClick={a.sendRequest} className="h-8 rounded-full bg-teal px-3 text-[13px] font-semibold text-white">
              New request
            </button>
          </span>
        }
      />
      <div className="divide-y divide-border rounded-2xl border border-border">
        {list.map((r) => {
          // #18: not answered and under 48 h → flagged; one red chip instead of two.
          const flag = r.status === "pending" && hoursUntil(r, s.clock) <= SETTINGS.requestFlagHours;
          const b = flag ? { tone: "danger" as const, label: "⚑ Pending · 48 h" } : REQ_BADGE[r.status];
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="nums block text-2xs text-muted-foreground">
                    {r.days ? `${r.dateLabel} +${r.days.length - 1} days` : r.dateLabel} · {fmtTime(r.time)}
                  </span>
                </span>
                <Badge tone={b.tone}>{b.label}</Badge>
              </div>
              {r.status === "declined" && <p className="mt-1 text-2xs text-foreground">“{r.reason}”</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Section title with an optional action on the right. */
function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {action}
    </div>
  );
}

/* ---------------- #16 open hours: dispatch sets them, the driver sees them under Schedule ---------------- */
export function OpenHoursEditor() {
  const { s, a } = useApp();
  const [draft, setDraft] = useState<OpenDay[]>(s.openHours);
  // Picks up a demo reset while this panel is open.
  useEffect(() => setDraft(s.openHours), [s.openHours]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.openHours);
  const set = (i: number, h: OpenDay) => setDraft((d) => d.map((x, j) => (j === i ? h : x)));
  const sel = "nums h-8 rounded-lg border border-control bg-card px-1.5 text-[13px] font-semibold outline-none focus:border-teal";
  return (
    <section>
      <SectionHead title="Open hours" />
      <div className="divide-y divide-border rounded-2xl border border-border">
        {WEEKDAYS.map((day, i) => {
          const h = draft[i];
          return (
            <div key={day} className="flex min-h-11 items-center gap-2 px-4 py-1.5 text-sm">
              <span className="w-9 font-semibold">{day}</span>
              <label className="flex items-center gap-1.5 text-[13px]">
                <input type="checkbox" checked={!!h} onChange={(e) => set(i, e.target.checked ? { ...DEFAULT_HOURS } : null)} className="size-4 accent-[#007078]" />
                Open
              </label>
              {h ? (
                <span className="ml-auto flex items-center gap-1">
                  <select aria-label={`${day} from`} className={sel} value={h.start} onChange={(e) => set(i, { start: +e.target.value, end: Math.max(h.end, +e.target.value + 30) })}>
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {fmtTime(t)}
                      </option>
                    ))}
                  </select>
                  –
                  <select aria-label={`${day} to`} className={sel} value={h.end} onChange={(e) => set(i, { ...h, end: +e.target.value })}>
                    {TIME_OPTIONS.filter((t) => t > h.start).map((t) => (
                      <option key={t} value={t}>
                        {fmtTime(t)}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <span className="ml-auto text-[13px] text-muted-foreground">Off</span>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={() => a.setOpenHours(draft)} disabled={!dirty} className="mt-2 h-9 rounded-full bg-teal px-3.5 text-[13px] font-semibold text-white disabled:opacity-40">
        {dirty ? "Save" : "Saved"}
      </button>
    </section>
  );
}
