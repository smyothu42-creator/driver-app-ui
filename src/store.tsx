import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_VEHICLE_ID, DISPATCH, DRIVER, INITIAL_ASSIGNMENTS, KITCHEN, OPEN_HOURS, OPEN_POOL, REQUESTS, workOf, ROUTE_ISO, STAFF, STOPS, fmtTime, fmtWindow, runOf, sameAddress, type Assignment, type DeliveryRequest, type OpenDay, type StaffMember, type StaffRole, type Stop, type StopStatus } from "./data/route";
import { translate, type Lang } from "./i18n";
import { isOn } from "./data/sprints";
import { coversWindow, dayOf, type Availability } from "./data/availability";

export type Tab = "today" | "map" | "schedule" | "history" | "me";

export type Screen =
  | { name: "signin" }
  | { name: "permissions" }
  | { name: "tabs" }
  | { name: "stop"; id: string }
  | { name: "navigate"; id: string }
  | { name: "camera"; id: string }
  | { name: "proof"; id: string }
  | { name: "tracking" }
  | { name: "scan"; id?: string } // #9 packing-slip scanner at the kitchen; `id` = opened from that order, so the next scan reads its slip
  | { name: "package"; id: string } // #9 after a scan: check the items inside that package
  | { name: "problem"; id: string; reusables?: string[] } // #21 step-by-step problem flow; `reusables` = what's short after a count (#53)
  | { name: "request"; id: string } // #18 one delivery request
  | { name: "requests" } // #18 only the requests waiting for an answer (Home's request button)
  | { name: "inbox" } // #6 messages to and from dispatch
  | { name: "vehicle" } // #64 vehicle profile
  | { name: "publicPage"; id: string } // #10 public delivery page opened from the slip QR
  | { name: "collect"; id: string } // #53 count reusables against the expected count
  | { name: "availability" }
  | { name: "pickup"; id: string }; // kitchen run for one claimed order

export type Sheet =
  | { name: "contact"; id: string }
  | { name: "people"; id: string; who: "customer" | "sfk" } // "Customer" / "SFK Team" call sheets on the stop
  | { name: "setup"; id: string } // #11 setup checklist dialog on arrival; unlocks the delivery photo
  | { name: "photo"; id: string } // parking & access photo for a stop
  | { name: "photoFull"; id: string } // the same photo, full screen
  | { name: "maps"; id: string }
  | { name: "instructions"; id: string } // parking, access, drop-off note for a stop, opened from navigation
  | { name: "delivered"; id: string }
  | { name: "claimed"; id: string }
  | { name: "endShift" }
  | { name: "startShift" }
  | { name: "decline"; id: string } // #18 decline needs a reason
  | { name: "language" } // #25
  | { name: "update" } // #24
  | { name: "openHours" } // #16 the week, from the Schedule header
  | { name: "laterPickup"; id: string } // an order on a later kitchen pickup, tapped from Home: when it's loaded
  | { name: "skip"; id: string } // reusables pickup: ask dispatch to skip it, with a reason
  | { name: "packingList"; id: string }; // reusables pickup: the packing list, to view, download or share

export type Handoff = "handed" | "left";

export interface StopState {
  status: StopStatus;
  enRouteAt?: number;
  arrivedAt?: number;
  deliveredAt?: number;
  photos: number;
  handoff?: Handoff;
  receivedBy?: string;
  notes?: string;
  issue?: string;
  returnsCollected?: boolean;
  setupDone?: boolean[];
  issuePhotos?: number;
  delayReason?: string; // #4 why it was delayed (preset)
  delayNote?: string; // #4 free text when the reason is "Other"
  /** #13 / #75: where the driver was when they marked it delivered. */
  deliveredAway?: boolean;
  setupEndAt?: number; // #12
  serviceEndAt?: number; // #12
  cancelledAt?: number; // #15 / #31
  officeOverride?: boolean; // #74 marked at the SFK office for an appless driver
  collected?: Record<string, number>; // #53 reusable item id → actual count
  collectPhotos?: number;
  /** Reusables pickup: the driver asked dispatch to skip it. Approved = the stop drops off the route. */
  skip?: { reason: string; at: number; status: "pending" | "approved" | "declined"; decidedAt?: number };
}

/** #15: a dispatch change to a stop's time. The driver sees old → new. */
export interface TimeChange {
  windowStart: number;
  windowEnd: number;
  prevStart: number;
  prevEnd: number;
  at: number;
}

/** #6: a message in the dispatch inbox. `priority` follows the UX skill's notification tiers. */
export interface Msg {
  id: string;
  at: number;
  from: "dispatch" | "you";
  kind: "time" | "cancel" | "route" | "request" | "reminder" | "info" | "reply";
  title: string;
  body?: string;
  stopId?: string;
  requestId?: string;
  /** Where a message without a stop or request opens: the Schedule tab or the time-off screen. */
  goto?: "schedule" | "availability";
  priority: "high" | "medium" | "low";
  read?: boolean;
}

export interface Push {
  id: number;
  title: string;
  body: string;
  tone: "high" | "medium";
  open?: Screen;
  /** A delivery request or a reminder about one: shown with Schedule, even while Notifications is hidden. */
  schedule?: boolean;
}

export interface VehicleProfile {
  make: string;
  model: string;
  year: number;
  headcount: number;
}

export type LocationPerm = "always" | "while" | "off";

export interface State {
  clock: number;
  signedIn: boolean;
  permsDone: boolean;
  location: LocationPerm;
  camera: boolean;
  notifications: boolean;
  shiftOn: boolean;
  shiftStartedAt?: number;
  /** Current kitchen pickup (1-based). `pickupDone` / `pickupAt` describe this run; the next run starts once it's delivered. */
  run: number;
  runLoadedAt: Record<number, number>; // when each kitchen pickup was loaded
  pickupDone: boolean;
  pickupAt?: number;
  bagChecks: Record<string, boolean>;
  stops: Record<string, StopState>;
  stack: Screen[];
  tab: Tab;
  sheet: Sheet | null;
  toast: string | null;
  /** Success pop-up (white card, green tick) shown briefly at the top, e.g. "Slip scanned". */
  notice: { title: string; body?: string } | null;
  focusId: string | null; // which order the connections panel follows
  availability: Availability; // the signed-in driver's saved availability (US-813)
  assignments: Record<string, Assignment[]>; // stop id → everyone on it (US-814/815)
  /* Same-day assignments. Drivers don't browse open orders: dispatch sends a request, the driver accepts. */
  claims: Record<string, { by: string; at: number }>; // unassigned order id → driver who accepted it, and when
  loaded: Record<string, "route" | "kitchen-run">; // order id → how it got into the vehicle
  /* Phase 3 scope */
  lang: Lang; // #25
  online: boolean; // #23
  pendingSync: number; // #23 actions saved on the phone while offline
  update: "none" | "optional" | "required"; // #24
  push: Push | null; // #15 the banner currently on screen
  inbox: Msg[]; // #6
  requests: DeliveryRequest[]; // #17–20
  openHours: OpenDay[]; // #16 set by dispatch, Monday first
  changes: Record<string, TimeChange>; // #15 time changes from dispatch
  scanned: Record<string, boolean>; // #9 packing slips scanned at the kitchen
  awayFromAddress: boolean; // #13 prototype stand-in for GPS distance at the drop
  vehicle: VehicleProfile; // #64 driver-entered
  vehicleFor: Record<string, string>; // #79 stop id → vehicle dispatch set for it; missing = driver's default
  order: string[] | null; // route re-ordered by dispatch (note A); null = planned order
  afterSignIn: Screen | null; // #10 a driver who opened the slip QR signed out lands on that stop after sign-in
  attendance: Record<string, Record<string, { in?: number; out?: number }>>; // #65 nice-to-have: lead logs staff in/out
}

const initialStops = () =>
  Object.fromEntries([...STOPS, ...OPEN_POOL].map((s) => [s.id, { status: "queued", photos: 0 } as StopState]));

/**
 * The prototype always starts clean on reload: nothing is kept between sessions (Oct 21 2026). The real app saves
 * kitchen checks to the phone on every tap; an old saved entry from earlier builds is cleared here.
 */
const LOAD_KEY = "sfk-load-progress";
try {
  localStorage.removeItem(LOAD_KEY);
} catch {
  // no storage (private window): nothing to clear
}

const initial = (): State => ({
  clock: KITCHEN.readyAt - 4,
  // The prototype opens signed in, past permissions: sign-in is out of the current design scope
  // (Sprint 3). The SignIn / Permissions screens stay in the code; set these back to false to show them.
  signedIn: true,
  permsDone: true,
  location: "always",
  camera: true,
  notifications: true,
  shiftOn: false,
  run: 1,
  runLoadedAt: {},
  pickupDone: false,
  bagChecks: {},
  stops: initialStops(),
  stack: [{ name: "tabs" }],
  tab: "today",
  sheet: null,
  toast: null,
  notice: null,
  focusId: "s1",
  availability: {},
  assignments: INITIAL_ASSIGNMENTS,
  claims: {},
  loaded: {},
  lang: "en",
  online: true,
  pendingSync: 0,
  update: "none",
  push: null,
  inbox: [
    { id: "m1", at: 7 * 60 + 30, from: "dispatch", kind: "info", title: "Today's route is published", body: "3 deliveries + 1 reusables pickup · kitchen ready 11:12 AM. Load in reverse order.", priority: "medium" },
    { id: "m2", at: 9 * 60 + 40, from: "dispatch", kind: "reminder", title: "3 delivery requests need your answer", body: "Brightline Health is in less than 48 h.", requestId: "r2", priority: "high" },
  ],
  requests: REQUESTS,
  openHours: OPEN_HOURS,
  changes: {},
  scanned: {},
  awayFromAddress: false,
  vehicle: { make: "Toyota", model: "Sienna", year: 2019, headcount: 2 },
  vehicleFor: { s2: "v-van2" }, // family-style setup needs the van
  order: null,
  afterSignIn: null,
  attendance: {},
});

let msgSeq = 10;
let pushSeq = 1;
/** #23: while offline, every driver action is queued on the phone and synced later. */
const queued = (p: State): Partial<State> => (p.online ? {} : { pendingSync: p.pendingSync + 1 });

/**
 * After every update: if the current run is loaded and all its deliveries are done (delivered or cancelled),
 * move to the next kitchen pickup. The driver then sees "Back to the kitchen" with its own load.
 */
function rollRun(p: State): State {
  if (!p.pickupDone) return p;
  const deliveries = liveRoute(p).filter((x) => x.kind !== "pickup");
  // A stop with a reported problem is with dispatch, so it doesn't hold the driver on this run:
  // the next kitchen pickup comes before the next run's deliveries.
  const open = deliveries.filter((x) => p.stops[x.id].status !== "delivered" && !p.stops[x.id].issue);
  if (open.some((x) => runOf(x) <= p.run)) return p;
  const next = open.map(runOf).sort((a, b) => a - b)[0];
  return next ? { ...p, run: next, pickupDone: false, pickupAt: undefined } : p;
}

function useAppState() {
  const [s, rawSet] = useState<State>(initial);
  const set = useCallback((u: State | ((p: State) => State)) => rawSet((prev) => rollRun(typeof u === "function" ? u(prev) : u)), []);

  const patch = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    set((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) }));
  }, []);

  const patchStop = useCallback((id: string, p: Partial<StopState>, extra?: Partial<State>, tick = 0) => {
    set((prev) => ({
      ...prev,
      ...extra,
      clock: prev.clock + tick,
      stops: { ...prev.stops, [id]: { ...prev.stops[id], ...p } },
    }));
  }, []);

  const toast = useCallback((msg: string) => {
    set((prev) => ({ ...prev, toast: msg }));
    window.setTimeout(() => set((prev) => (prev.toast === msg ? { ...prev, toast: null } : prev)), 2600);
  }, []);

  const popup = useCallback((title: string, body?: string) => {
    const n = { title, body };
    set((prev) => ({ ...prev, notice: n }));
    window.setTimeout(() => set((prev) => (prev.notice === n ? { ...prev, notice: null } : prev)), 2400);
  }, []);

  const actions = useMemo(
    () => ({
      push: (scr: Screen) =>
        patch((p) => ({ stack: [...p.stack, scr], sheet: null, focusId: "id" in scr ? scr.id : p.focusId })),
      back: () => patch((p) => ({ stack: p.stack.length > 1 ? p.stack.slice(0, -1) : p.stack, sheet: null })),
      reset: (scr: Screen) => patch({ stack: [scr], sheet: null }),
      setTab: (tab: Tab) => patch({ tab, stack: [{ name: "tabs" }], sheet: null }),
      openSheet: (sheet: Sheet) => patch((p) => ({ sheet, focusId: "id" in sheet ? sheet.id : p.focusId })),
      closeSheet: () => patch({ sheet: null }),
      focus: (id: string) => patch({ focusId: id }),
      toast,
      popup,

      signIn: () => patch((p) => ({ signedIn: true, stack: p.permsDone ? [{ name: "tabs" }, ...(p.afterSignIn ? [p.afterSignIn] : [])] : [{ name: "permissions" }], afterSignIn: p.permsDone ? null : p.afterSignIn })),
      setPerm: (p: Partial<Pick<State, "location" | "camera" | "notifications">>) => patch(p),
      finishPerms: () => patch((p) => ({ permsDone: true, stack: [{ name: "tabs" }, ...(p.afterSignIn ? [p.afterSignIn] : [])], tab: "today", afterSignIn: null })),

      startShift: () =>
        patch((p) => ({ shiftOn: true, shiftStartedAt: p.clock, sheet: null, location: p.location === "off" ? "while" : p.location })),
      endShift: () => patch({ shiftOn: false, sheet: null }),

      toggleBag: (id: string) => patch((p) => ({ bagChecks: { ...p.bagChecks, [id]: !p.bagChecks[id] } })),
      /** One tick per order on the load checklist (bag counts aren't reliable, review Oct 14 2026). */
      setOrderLoaded: (ids: string[], on: boolean) => patch((p) => ({ bagChecks: { ...p.bagChecks, ...Object.fromEntries(ids.map((i) => [i, on])) } })),
      /** #9 Open the kitchen load where it left off: the package still being checked, else the scanner. */
      openLoad: () => patch((p) => ({ stack: [...p.stack.filter((x) => x.name !== "scan" && x.name !== "package"), loadStep(p)] })),
      checkAllBags: (ids: string[]) =>
        patch((p) => ({ bagChecks: { ...p.bagChecks, ...Object.fromEntries(ids.map((i) => [i, true])) } })),
      confirmPickup: () =>
        patch((p) => ({
          pickupDone: true,
          pickupAt: p.clock + 6,
          runLoadedAt: { ...p.runLoadedAt, [p.run]: p.clock + 6 },
          clock: p.clock + 8,
          // This run's orders, including ones claimed before the pickup, are loaded.
          loaded: { ...p.loaded, ...Object.fromEntries(runStops(p).map((x) => [x.id, "route" as const])) },
          stack: [{ name: "tabs" }],
          tab: "today",
          ...queued(p),
        })),

      // A same-day order accepted after the main pickup needs its own kitchen run.
      confirmClaimPickup: (id: string) =>
        patch((p) => ({
          loaded: { ...p.loaded, [id]: "kitchen-run" },
          clock: p.clock + 12,
          stack: [{ name: "tabs" }, { name: "stop", id }],
          sheet: null,
        })),

      // #3 (Oct 20 2026): turn-by-turn opens in Google Maps to start. This screen stays behind it with the same
      // ETA, instructions, call and "slide when you arrive", so the driver comes back here to arrive.
      startNav: (id: string) => {
        toast("Opening Google Maps…");
        set((prev) => ({
          ...prev,
          clock: prev.clock + 1,
          focusId: id,
          sheet: null,
          stops: { ...prev.stops, [id]: { ...prev.stops[id], status: "en_route", enRouteAt: prev.clock + 1 } },
          stack: [...prev.stack.filter((x) => x.name !== "navigate"), { name: "navigate", id }],
        }));
      },
      arrive: (id: string, driveMins: number) =>
        set((prev) => ({
          ...prev,
          clock: prev.clock + driveMins,
          stops: { ...prev.stops, [id]: { ...prev.stops[id], status: "arrived", arrivedAt: prev.clock + driveMins } },
          stack: [{ name: "tabs" }, { name: "stop", id }],
          ...queued(prev),
        })),
      addPhoto: (id: string) =>
        set((prev) => ({
          ...prev,
          stops: { ...prev.stops, [id]: { ...prev.stops[id], photos: Math.min(3, prev.stops[id].photos + 1) } },
        })),
      removePhoto: (id: string) => patchStop(id, { photos: 0 }),
      /** Proof screen: remove one photo (the X on its thumbnail). Photos are a count in the prototype. */
      removeOnePhoto: (id: string) => patch((p) => ({ stops: { ...p.stops, [id]: { ...p.stops[id], photos: Math.max(0, p.stops[id].photos - 1) } } })),
      updateStop: patchStop,
      completeDelivery: (id: string) =>
        set((prev) => ({
          ...prev,
          clock: prev.clock + 9,
          // #13 / #75: the driver's location is logged with the delivery; away from the address flags dispatch.
          stops: { ...prev.stops, [id]: { ...prev.stops[id], status: "delivered", deliveredAt: prev.clock + 8, deliveredAway: prev.awayFromAddress } },
          stack: [{ name: "tabs" }],
          tab: "today",
          sheet: { name: "delivered", id },
          ...queued(prev),
        })),
      // Only availability save gets a toast; assignment and role edits are silent by spec.
      // Time off is a request (#76): new days off wait for dispatch to approve them.
      saveAvailability: (availability: Availability) => {
        patch((p) => ({
          availability: Object.fromEntries(
            Object.entries(availability).map(([iso, d]) => [iso, d.status === "unavailable" && !(p.availability[iso]?.status === "unavailable" && !p.availability[iso]?.requested) ? { ...d, requested: true } : d]),
          ),
        }));
        toast("Time off requested · dispatch will confirm");
      },
      reviewTimeOff: (iso: string, approve: boolean) =>
        patch((p) => {
          const availability = { ...p.availability };
          if (approve) availability[iso] = { status: "unavailable" };
          else delete availability[iso];
          const day = new Date(iso + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const title = approve ? "Time off approved" : "Time off not approved";
          const body = approve ? `${day} · dispatch won't send you work` : `${day} · you're still working. Call dispatch to talk it over.`;
          return {
            availability,
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "info", title, body, goto: "availability", priority: "medium" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: approve ? "medium" : "high", open: { name: "availability" } },
          };
        }),
      /** #16: dispatch changes the driver's open hours; the phone gets a push and shows the new hours. */
      setOpenHours: (openHours: OpenDay[]) =>
        patch((p) => {
          const title = "Your open hours changed";
          const body = "Set by dispatch · see Schedule";
          return {
            openHours,
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "info", title, body, goto: "schedule", priority: "medium" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "medium", open: { name: "tabs" } },
          };
        }),
      /** #18: the every-X-hours reminder for unanswered requests (dispatch can also send it now). */
      remindRequests: () =>
        patch((p) => {
          const pending = p.requests.filter((r) => r.status === "pending");
          if (!pending.length) return {};
          const title = `${pending.length} ${pending.length === 1 ? "request needs" : "requests need"} your answer`;
          const body = pending.map((r) => r.name).join(" · ");
          return {
            requests: p.requests.map((r) => (r.status === "pending" ? { ...r, remindedAt: p.clock } : r)),
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "reminder", title, body, goto: "schedule", priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "tabs" }, schedule: true },
          };
        }),
      // Keeps the role of anyone who stays selected, so removing one chip never clears the others' roles.
      setAssignees: (stopId: string, userIds: string[]) =>
        patch((p) => {
          const prev = p.assignments[stopId] ?? [];
          return { assignments: { ...p.assignments, [stopId]: userIds.map((u) => prev.find((x) => x.userId === u) ?? { userId: u }) } };
        }),
      setRole: (stopId: string, userId: string, role: StaffRole | undefined) =>
        patch((p) => ({
          assignments: { ...p.assignments, [stopId]: (p.assignments[stopId] ?? []).map((x) => (x.userId === userId ? { ...x, role } : x)) },
        })),
      reportIssue: (id: string, issue: string, photos = 0) =>
        set((p) => ({
          ...p,
          stops: { ...p.stops, [id]: { ...p.stops[id], issue, issuePhotos: photos } },
          inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "you", kind: "reply", title: `Problem reported: ${issue}`, body: findStop(p, id).name, stopId: id, priority: "high" }, ...p.inbox],
          ...queued(p),
        })),

      /* ---- Phase 3 ---- */
      setLang: (lang: Lang) => patch({ lang, sheet: null }),
      setOnline: (online: boolean) =>
        set((p) => {
          if (online && p.pendingSync > 0) window.setTimeout(() => toast(`Back online · ${p.pendingSync} ${p.pendingSync === 1 ? "update" : "updates"} synced`), 0);
          return { ...p, online, pendingSync: online ? 0 : p.pendingSync };
        }),
      setUpdate: (update: State["update"]) => patch({ update, sheet: update === "optional" ? { name: "update" } : null }),
      installUpdate: () => {
        patch({ update: "none", sheet: null });
        toast("Updated · you're on the current version");
      },
      setAway: (awayFromAddress: boolean) => patch({ awayFromAddress }),
      dismissPush: () => patch({ push: null }),
      openPush: () =>
        patch((p) => {
          const open = p.push?.open;
          if (!open) return { push: null };
          // A push about requests in general lands on the Schedule tab; anything else opens its screen over the tabs.
          if (open.name === "tabs") return { push: null, stack: [{ name: "tabs" }], tab: "schedule", sheet: null };
          return { push: null, stack: [{ name: "tabs" }, open], sheet: null };
        }),
      markInboxRead: () => patch((p) => (p.inbox.some((m) => !m.read) ? { inbox: p.inbox.map((m) => ({ ...m, read: true })) } : {})),
      scanSlip: (id: string) => {
        patch((p) => ({ scanned: { ...p.scanned, [id]: true } }));
      },
      markSetupDone: (id: string) => set((p) => ({ ...p, clock: p.clock + 6, stops: { ...p.stops, [id]: { ...p.stops[id], setupEndAt: p.clock + 6 } }, ...queued(p) })),
      endService: (id: string) => set((p) => ({ ...p, clock: p.clock + 40, stops: { ...p.stops, [id]: { ...p.stops[id], serviceEndAt: p.clock + 40 } }, ...queued(p) })),
      saveVehicle: (vehicle: VehicleProfile) => {
        patch({ vehicle });
        toast("Vehicle saved");
      },
      sendToDispatch: (text: string) => {
        set((p) => ({ ...p, inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "you", kind: "reply", title: text, priority: "low" }, ...p.inbox], ...queued(p) }));
        toast("Sent to dispatch");
      },
      answerRequest: (id: string, status: "accepted" | "declined", reason?: string) => {
        set((p) => {
          const r = p.requests.find((x) => x.id === id)!;
          const requests = p.requests.map((x) => (x.id === id ? { ...x, status, reason } : x));
          // A same-day request joins the end of today's route as soon as it's accepted.
          if (status === "accepted" && r.orderId)
            return {
              ...p,
              requests,
              claims: { ...p.claims, [r.orderId]: { by: DRIVER.id, at: p.clock } },
              assignments: { ...p.assignments, [r.orderId]: [{ userId: DRIVER.id }] },
              focusId: r.orderId,
              sheet: { name: "claimed", id: r.orderId },
              ...queued(p),
            };
          // Back to the Schedule tab, where the answer shows straight away.
          // Answered from the Requests list: stay there. Otherwise back to the Schedule tab.
          const onList = p.stack.at(-1)?.name === "requests";
          return { ...p, sheet: null, requests, ...(onList ? {} : { stack: [{ name: "tabs" }] as Screen[], tab: "schedule" as Tab }), ...queued(p) };
        });
        // Same-day accepts show the "added to your route" sheet instead of a pop-up.
        if (!(status === "accepted" && id.startsWith("q-"))) popup(status === "accepted" ? "Accepted" : "Sent to dispatch", status === "accepted" ? "Dispatch can see it" : "They'll reassign it");
      },
      /** Dispatch sends an unassigned order to a driver as a same-day request. */
      sendOrderRequest: (orderId: string) =>
        set((p) => {
          const o = OPEN_POOL.find((x) => x.id === orderId)!;
          const id = `q-${orderId}`;
          if (p.requests.some((r) => r.id === id)) return p;
          const r: DeliveryRequest = { id, orderId, orderNo: o.orderNo, name: o.name, address: o.addressLine1, dateISO: ROUTE_ISO, dateLabel: "Today", time: o.windowStart, meals: o.meals, type: o.orderType, customerType: o.customerType, work: workOf(o), status: "pending", remindedAt: p.clock, sentAt: `Today ${fmtTime(p.clock)}` };
          const title = "New delivery for today";
          const body = `${o.name} · ${fmtWindow(o.windowStart, o.windowEnd)} · accept to add it to your route`;
          return {
            ...p,
            requests: [...p.requests, r],
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "request", title, body, requestId: id, priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "request", id }, schedule: true },
          };
        }),
      /** Stands in for another driver's phone accepting a request. */
      acceptAs: (orderId: string, by: string) => patch((p) => ({ claims: { ...p.claims, [orderId]: { by, at: p.clock } }, assignments: { ...p.assignments, [orderId]: [{ userId: by }] } })),
      /** Note A: dispatch re-orders the route; the driver gets the new order by push. */
      reorder: () =>
        set((p) => {
          const left = routeOf(p).filter((x) => p.stops[x.id].status === "queued");
          if (left.length < 2) return p;
          const [a1, b1] = left;
          const ids = routeOf(p).map((x) => x.id);
          const i = ids.indexOf(a1.id), j = ids.indexOf(b1.id);
          [ids[i], ids[j]] = [ids[j], ids[i]];
          const title = "Route updated";
          const body = `${b1.name} is now before ${a1.name}`;
          return {
            ...p,
            order: ids,
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "route", title, body, priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "tabs" } },
          };
        }),
      setVehicle: (stopId: string, vehicleId: string) =>
        patch((p) => {
          const vehicleFor = { ...p.vehicleFor };
          if (vehicleId === DEFAULT_VEHICLE_ID) delete vehicleFor[stopId];
          else vehicleFor[stopId] = vehicleId;
          return { vehicleFor };
        }),
      /** #53: actual counts + photo. A pickup stop is done when collected; on a delivery it's an add-on. */
      /** Missing items aren't noted here: the collect screen opens the problem flow for them (Oct 21 2026). */
      collectReusables: (id: string, counts: Record<string, number>, photos: number) =>
        set((p) => {
          const stop = findStop(p, id);
          // Collected during the delivery at the same address: it's done, but the driver stays on that delivery.
          const alongside = !!pickupDelivery(p, stop);
          const pickup = stop.kind === "pickup" && !alongside;
          const st = p.stops[id];
          return {
            ...p,
            clock: p.clock + (pickup ? 6 : 0),
            stops: {
              ...p.stops,
              [id]: { ...st, collected: counts, collectPhotos: photos, returnsCollected: true, ...(stop.kind === "pickup" ? { status: "delivered" as const, deliveredAt: p.clock + (pickup ? 5 : 0), deliveredAway: p.awayFromAddress } : {}) },
            },
            stack: pickup ? [{ name: "tabs" }] : p.stack.filter((x) => x.name !== "collect"),
            tab: pickup ? "today" : p.tab,
            sheet: pickup ? { name: "delivered", id } : null,
            ...queued(p),
          };
        }),
      /** #65 nice-to-have: the lead marks other staff in and out at the stop. */
      markStaff: (stopId: string, userId: string) =>
        patch((p) => {
          const cur = p.attendance[stopId]?.[userId] ?? {};
          const next = cur.in == null ? { in: p.clock } : cur.out == null ? { ...cur, out: p.clock } : cur;
          return { attendance: { ...p.attendance, [stopId]: { ...p.attendance[stopId], [userId]: next } } };
        }),

      /* ---- Dispatch-side simulations (guide panel) ---- */
      /** #15 / #31: push + inbox entry. High priority for cancels and time changes. */
      notify: (m: Omit<Msg, "id" | "at" | "from">, open?: Screen) =>
        set((p) => ({
          ...p,
          inbox: [{ ...m, id: `m${++msgSeq}`, at: p.clock, from: "dispatch" }, ...p.inbox],
          push: { id: pushSeq++, title: m.title, body: m.body ?? "", tone: m.priority === "high" ? "high" : "medium", open },
        })),
      changeTime: (id: string, mins: number) =>
        set((p) => {
          const stop = findStop(p, id);
          const prev = p.changes[id];
          const base = { start: prev?.prevStart ?? stop.windowStart, end: prev?.prevEnd ?? stop.windowEnd };
          const change = { windowStart: stop.windowStart + mins, windowEnd: stop.windowEnd + mins, prevStart: base.start, prevEnd: base.end, at: p.clock };
          const title = `New time · ${stop.name}`;
          const body = `${fmtWindow(change.windowStart, change.windowEnd)} (was ${fmtWindow(base.start, base.end)})`;
          return {
            ...p,
            changes: { ...p.changes, [id]: change },
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "time", title, body, stopId: id, priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "stop", id } },
          };
        }),
      cancelOrder: (id: string) =>
        set((p) => {
          const stop = findStop(p, id);
          const title = `Cancelled · ${stop.name}`;
          const body = p.pickupDone ? "Don't deliver. Bring the food back to the kitchen." : "Removed from your route. Don't load it.";
          return {
            ...p,
            stops: { ...p.stops, [id]: { ...p.stops[id], status: "cancelled", cancelledAt: p.clock } },
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "cancel", title, body, stopId: id, priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "stop", id } },
          };
        }),
      /** #19: dispatch sends a new delivery request. */
      sendRequest: () =>
        set((p) => {
          if (p.requests.some((r) => r.id === "r6")) return p;
          const r: DeliveryRequest = { id: "r6", orderNo: "ORD-3158", name: "Lumen Studio", address: "500 Terry A Francois Blvd", dateISO: "2026-10-09", dateLabel: "Fri, Oct 9", time: 12 * 60 + 45, meals: 16, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "pending", sentAt: `Today ${fmtTime(p.clock)}`, remindedAt: p.clock };
          const title = "New delivery request";
          const body = `${r.name} · ${r.dateLabel} · ~${fmtTime(r.time)}`;
          return {
            ...p,
            requests: [...p.requests, r],
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: "request", title, body, requestId: r.id, priority: "high" }, ...p.inbox],
            push: { id: pushSeq++, title, body, tone: "high", open: { name: "request", id: r.id }, schedule: true },
          };
        }),
      /** #74: SFK office marks a stop for a driver without the app. */
      /** Reusables pickup: ask dispatch to skip it. It stays on the route until dispatch decides. */
      requestSkip: (id: string, reason: string) => {
        patch((p) => ({
          sheet: null,
          stops: { ...p.stops, [id]: { ...p.stops[id], skip: { reason, at: p.clock, status: "pending" } } },
          inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "you", kind: "reply", title: `Asked to skip the pickup at ${findStop(p, id).name}`, body: reason, stopId: id, priority: "medium" }, ...p.inbox],
        }));
        toast("Sent to dispatch · keep it on your route until they reply");
      },
      /** Dispatch view: approve (the pickup drops off the route) or decline (it stays) a skip request. */
      decideSkip: (id: string, ok: boolean) =>
        set((p) => {
          const st = p.stops[id];
          if (!st.skip) return p;
          const name = findStop(p, id).name;
          return {
            ...p,
            stops: { ...p.stops, [id]: { ...st, skip: { ...st.skip, status: ok ? "approved" : "declined", decidedAt: p.clock }, ...(ok ? { status: "cancelled" as const, cancelledAt: p.clock } : {}) } },
            inbox: [{ id: `m${++msgSeq}`, at: p.clock, from: "dispatch", kind: ok ? "cancel" : "info", title: ok ? `Pickup skipped · ${name}` : `Please still pick up at ${name}`, body: ok ? "Dispatch took it off your route." : "Dispatch needs this pickup today.", stopId: id, priority: "high" }, ...p.inbox],
            ...queued(p),
          };
        }),
      officeDeliver: (id: string) =>
        set((p) => ({
          ...p,
          stops: { ...p.stops, [id]: { ...p.stops[id], status: "delivered", deliveredAt: p.clock, officeOverride: true, handoff: "handed", receivedBy: "Marked at SFK office" } },
        })),
      resetDemo: () =>
        set(() => {
          return initial();
        }),
      jump: (fn: (s: State) => Partial<State>) => patch(fn),
    }),
    [patch, patchStop, toast, popup],
  );

  return { s, a: actions };
}

type Ctx = ReturnType<typeof useAppState>;
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const v = useAppState();
  return <AppCtx.Provider value={v}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

type RouteState = Pick<State, "claims" | "stops" | "loaded" | "pickupDone" | "run"> & Partial<Pick<State, "changes" | "order">>;

/**
 * The driver's route: assigned stops, then orders they claimed, in claim order (numbered on).
 * Dispatch time changes (#15) are applied here, so every screen shows the new window.
 */
export function routeOf(s: Pick<State, "claims"> & Partial<Pick<State, "changes" | "order">>): Stop[] {
  const mine = OPEN_POOL.filter((o) => s.claims[o.id]?.by === DRIVER.id).sort((a, b) => s.claims[a.id].at - s.claims[b.id].at);
  const withChange = (x: Stop) => {
    const c = s.changes?.[x.id];
    return c ? { ...x, windowStart: c.windowStart, windowEnd: c.windowEnd, guestReadyTime: x.guestReadyTime && x.guestReadyTime + (c.windowStart - c.prevStart) } : x;
  };
  // Reusables pickup stops wait for the Reusable pickup sprint (src/data/sprints.ts).
  const all = [...STOPS, ...mine].filter((x) => x.kind !== "pickup" || isOn("reusables")).map(withChange);
  // Dispatch re-order (note A). Anything not in the saved order (e.g. accepted later) keeps its place at the end.
  const order = s.order;
  if (order) all.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
  // Deliveries grouped by kitchen pickup (stable within a run), then reusable pickups (#39: deprioritised in every route).
  const deliveries = all.filter((x) => x.kind !== "pickup").sort((a, b) => runOf(a) - runOf(b));
  const sorted = [...deliveries, ...all.filter((x) => x.kind === "pickup")];
  return sorted.map((x, i) => ({ ...x, seq: i + 1 }));
}

/** Stops still to deliver or done: cancelled ones drop out of counts and the loading list. */
export function liveRoute(s: Parameters<typeof routeOf>[0] & Pick<State, "stops">) {
  return routeOf(s).filter((x) => s.stops[x.id].status !== "cancelled");
}

const openStatus = (st: StopState) => st.status !== "delivered" && st.status !== "cancelled";

/**
 * A reusables pickup at the same address as a delivery still to do is picked up during that delivery
 * (Oct 21 2026). Returns that delivery, or undefined once the pickup is done or the delivery is (then the
 * pickup is its own stop again).
 */
export function pickupDelivery(s: Parameters<typeof liveRoute>[0], pickup: Stop): Stop | undefined {
  if (pickup.kind !== "pickup" || !openStatus(s.stops[pickup.id])) return undefined;
  return liveRoute(s).find((x) => x.kind !== "pickup" && sameAddress(x, pickup) && openStatus(s.stops[x.id]));
}

/** Reusables pickups riding along with this delivery. */
export function pickupsAt(s: Parameters<typeof liveRoute>[0], delivery: Stop): Stop[] {
  return liveRoute(s).filter((x) => x.kind === "pickup" && pickupDelivery(s, x)?.id === delivery.id);
}

/** #22: minutes since the route was loaded, and where that sits against SFK's food-safety limit. */
export function foodSafety(s: Pick<State, "pickupAt" | "clock">, limit: number, warn: number) {
  if (s.pickupAt == null) return null;
  const mins = Math.max(0, s.clock - s.pickupAt);
  return { mins, left: limit - mins, level: mins >= limit ? ("over" as const) : mins >= limit - warn ? ("warn" as const) : ("ok" as const) };
}

/** #25: translate with the driver's language. */
export function useT() {
  const lang = useApp().s.lang;
  return (text: string) => translate(lang, text);
}

export { DISPATCH };

export function useRoute() {
  return routeOf(useApp().s);
}

/** Any order by id: a route stop (with its route number) or an open order not yet claimed. */
export function findStop(s: Pick<State, "claims"> & Partial<Pick<State, "changes" | "order">>, id: string): Stop {
  return routeOf(s).find((x) => x.id === id) ?? OPEN_POOL.find((x) => x.id === id)!;
}

/**
 * The stop the driver should act on next (first not-delivered stop in sequence).
 * A stop with a reported problem is with dispatch, so the route moves past it; it stays open
 * (and comes back as "next" once it's the only one left) in case dispatch says to deliver after all.
 */
export function nextStop(s: Pick<State, "claims" | "stops"> & Partial<Pick<State, "changes" | "order">>) {
  // A pickup riding along with a delivery isn't a stop of its own while that delivery is still to do.
  const open = routeOf(s).filter((x) => openStatus(s.stops[x.id]) && !pickupDelivery(s, x));
  return open.find((x) => !s.stops[x.id].issue) ?? open[0];
}

/** Deliveries loaded on the current kitchen pickup (cancelled ones drop out). */
export function runStops(s: Parameters<typeof liveRoute>[0] & Pick<State, "run">, run = s.run) {
  return liveRoute(s).filter((x) => x.kind !== "pickup" && x.bags.length > 0 && runOf(x) === run);
}

/**
 * #9 Where the kitchen load picks up: a scanned package not fully checked, else the scanner for the next slip,
 * else the last package (its screen carries the "Loaded · start route" slide). There's no overview page.
 */
export function loadStep(s: Parameters<typeof runStops>[0] & Pick<State, "scanned" | "bagChecks">): Screen {
  const route = runStops(s);
  const checked = (x: Stop) => x.bags.every((b) => s.bagChecks[b.id]);
  const open = route.find((x) => s.scanned[x.id] && !checked(x));
  if (open) return { name: "package", id: open.id };
  if (route.some((x) => !s.scanned[x.id])) return { name: "scan" };
  return route.length ? { name: "package", id: route[route.length - 1].id } : { name: "scan" };
}

/**
 * Every packing slip the driver may scan today (Oct 20 2026): this pickup's orders first, then later pickups'.
 * A slip that isn't in this list isn't on their route, and the scanner stops them there.
 */
export function slipsToday(s: Parameters<typeof liveRoute>[0] & Pick<State, "run" | "pickupDone">) {
  return liveRoute(s).filter((x) => x.kind !== "pickup" && x.bags.length > 0 && (runOf(x) > s.run || (runOf(x) === s.run && !s.pickupDone)));
}

/** Whether a stop's food is in the vehicle: an earlier run, or this run once it's loaded. Reusables pickups need no load. */
export function isLoaded(s: Pick<State, "run" | "pickupDone">, stop: Stop) {
  return stop.kind === "pickup" || runOf(stop) < s.run || (runOf(stop) === s.run && s.pickupDone);
}

/** A claimed order that isn't in the vehicle yet. Before the main pickup, it simply joins that checklist. */
export function needsKitchenRun(s: RouteState, id: string) {
  return s.pickupDone && !!s.claims[id] && !s.loaded[id];
}

/** Where the drive to a stop starts: the previous stop if it's done, otherwise the kitchen. */
export function legStart(s: RouteState, stop: Stop): string {
  const prev = routeOf(s)[stop.seq - 2];
  // The first stop of each kitchen pickup starts from the kitchen.
  if (s.loaded[stop.id] === "kitchen-run" || !prev || (stop.kind !== "pickup" && runOf(prev) !== runOf(stop))) return "k";
  // A stop left with a reported problem still counts as where the driver came from.
  return s.stops[prev.id].status === "delivered" || s.stops[prev.id].issue ? prev.id : "k";
}

/** The signed-in driver's assignment on a stop, or undefined if dispatch took them off it. */
export function myAssignment(s: Pick<State, "assignments">, stopId: string) {
  return s.assignments[stopId]?.find((x) => x.userId === DRIVER.id);
}

/** Everyone else on the stop, with their staff record. */
export function crewOn(s: Pick<State, "assignments">, stopId: string) {
  return (s.assignments[stopId] ?? [])
    .filter((x) => x.userId !== DRIVER.id)
    .map((x) => ({ ...x, staff: STAFF.find((m) => m.id === x.userId)! }));
}

/**
 * Whether a staff member can take this stop. Marcus is checked against the availability he
 * saved on his phone; everyone else falls back to the static `isAvailable` prop.
 */
export function isStaffAvailable(s: Pick<State, "availability">, m: StaffMember, stop: Stop) {
  if (m.id === DRIVER.id) return coversWindow(dayOf(s.availability, ROUTE_ISO), stop.windowStart, stop.windowEnd);
  return m.isAvailable !== false;
}

/* ---------------- Workflow position (for StepTrack) ---------------- */

export const CLAIM_STEPS = ["Accept", "Pick up", "Deliver", "Confirm"];
export const ROUTE_STEPS = ["Pick up", "Deliver", "Confirm"];

/** Which workflow steps apply to a stop, and which one the driver is on. Same-day requests add "Accept". */
export function stopSteps(s: RouteState, stop: Stop) {
  const claimable = OPEN_POOL.some((o) => o.id === stop.id);
  const steps = claimable ? CLAIM_STEPS : ROUTE_STEPS;
  const st = s.stops[stop.id];
  const phase =
    claimable && !s.claims[stop.id]
      ? "Accept"
      : st.status === "delivered" || st.status === "cancelled"
        ? null
        : !isLoaded(s, stop) || needsKitchenRun(s, stop.id)
          ? "Pick up"
          : st.status === "arrived"
            ? "Confirm"
            : "Deliver";
  return { steps, current: phase ? steps.indexOf(phase) : steps.length };
}

/** The vehicle dispatch set for a stop, or the driver's default (#79). */
export function vehicleOf(s: Pick<State, "vehicleFor">, stopId: string) {
  return s.vehicleFor[stopId] ?? DEFAULT_VEHICLE_ID;
}
