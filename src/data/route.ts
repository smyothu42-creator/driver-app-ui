import danielPhoto from "../assets/customer-daniel.jpg";
/**
 * Mock data for the driver prototype.
 *
 * Field names deliberately mirror the real Superfine schema
 * (superfine/packages/db/prisma/schema.prisma) so this prototype can be read as a
 * reference for development:
 *   Order    → orderNo, deliveryDateTime, guestReadyTime, deliveryInstructions,
 *              packagingType, dispatchReadyAt, dispatchedAt, deliveredAt
 *   Address  → addressLine1/2, city, instructions, instructionsFileUrl
 *   Delivery → assignedUserId (the driver), assignedDispatchCoordinatorId,
 *              deliveryOnTime, deliveryCompletedAt, deliveryNotes, deliveryImage
 */

import { LEGS, PLACES, type LngLat } from "./geo";
import { isOn } from "./sprints";

export type StopStatus = "queued" | "en_route" | "arrived" | "delivered" | "issue" | "cancelled";
export type Temp = "HOT" | "COLD";
export type CustomerType = "corporate" | "family" | "individual";

export interface Bag {
  id: string;
  label: string;
  temp: Temp;
  detail: string;
}

export interface Contact {
  name: string;
  role: string;
  phone: string;
}

/** A reusable item to collect, with the count that came with the order (#53). */
export interface Reusable {
  id: string;
  label: string;
  expected: number;
}

export interface Stop {
  id: string;
  /** Pickups sit on the route as their own stops, labelled separately from food deliveries (#51). */
  kind?: "delivery" | "pickup";
  /** Which kitchen pickup this order is loaded on: 1 = the first, 2 = back to the kitchen after delivering run 1. Default 1. */
  run?: number;
  seq: number;
  orderNo: string;
  customerType: CustomerType;
  orderType: string; // OrderType name in admin, e.g. "Daily Lunch", "Family Style"
  name: string; // company or person
  /** Profile photo from the customer profile (individuals). Companies show a logo tile instead. */
  photo?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  windowStart: number; // minutes since midnight
  windowEnd: number;
  guestReadyTime?: number; // family style: food must be set up by this time
  meals: number;
  packaging: string;
  /** What's in this order's package: shown as items to check after its QR is scanned, and used for hot / cold.
   * Never shown as a count (review Oct 14 2026: bag and container counts aren't stored reliably). */
  bags: Bag[];
  buildingNotes: string; // Address.instructions (saved once, reused every order)
  hasBuildingPhoto: boolean; // Address.instructionsFileUrl
  dropoffNotes: string; // Order.deliveryInstructions (this order only)
  setup?: string[]; // setup checklist on arrival (#11)
  /** Where the setup checklist comes from: a company default or this delivery address (#11, #29). */
  setupSource?: "company" | "address";
  /** Setup + serve stops log a service end time separately from "Delivered" (#12). */
  serve?: boolean;
  /** Delivery instructions as set fields (#38): parking and access are their own rows. */
  parking?: string;
  backupContact?: Contact; // #2
  returns?: string; // reusable packaging to collect
  reusables?: Reusable[]; // expected counts for a pickup, or collected along with a delivery (#50, #53)
  contact: Contact;
  /** Unassigned orders only: why dispatch opened it for claiming (shown to drivers). */
  openReason?: string;
  at: LngLat; // real coordinates (src/data/geo.ts)
  driveMins: number; // drive time from previous stop
  miles: number;
}

export const DRIVER = {
  id: "u-marcus",
  name: "Marcus Reyes",
  first: "Marcus",
  initials: "MR",
  phone: "(415) 555-0148",
  role: "DRIVER",
  type: "In-house", // #71: in-house or contracted, both use the app
};

export const DISPATCH: Contact = { name: "Alana Brooks", role: "Dispatch coordinator", phone: "(415) 555-0100" };
/** SFK people a driver can call from a stop ("SFK Team" sheet). Dispatch first. */
export const SFK_TEAM: (Contact & { tag: string })[] = [
  { ...DISPATCH, tag: "Dispatch" },
  { name: "Marco Diaz", role: "Kitchen lead · Superfine Kitchen", phone: "(415) 555-0110", tag: "Kitchen" },
  { name: "Renee Park", role: "Operations manager · SFK", phone: "(415) 555-0120", tag: "Operations" },
];

export const KITCHEN = {
  name: "Superfine Kitchen",
  addressLine1: "1650 Mission St",
  city: "San Francisco, CA 94103",
  readyAt: 11 * 60 + 12, // Order.dispatchReadyAt from the kitchen screen (first pickup)
  dock: "Dispatch dock · Bay 2",
  at: PLACES.k,
};

export const ROUTE_DATE = "Tue, Oct 6";
export const ROUTE_ISO = "2026-10-06"; // the prototype's "today"
export const ROUTE_ID = "R-1006-A";

/** Review Oct 14 2026: the type of work at a stop. One stop can be a delivery and a reusables pickup. */
export type Work = "hot" | "cold" | "reusables";
/** Kitchen pickup a stop is loaded on. Reusables pickups and same-day orders default to 1. */
export const runOf = (stop: Stop) => stop.run ?? 1;

/** When the kitchen has each pickup ready (Order.dispatchReadyAt per run). */
export const KITCHEN_READY: Record<number, number> = { 1: 11 * 60 + 12, 2: 12 * 60 + 40 };

/** The route's hot order. Only one per vehicle load, and it's delivered first. */
export function hotStop(route: Stop[]): Stop | undefined {
  return route.find((x) => x.bags.some((b) => b.temp === "HOT"));
}
export function workOf(stop: Stop): Work[] {
  const w: Work[] = [];
  if (stop.bags.some((b) => b.temp === "HOT")) w.push("hot");
  if (stop.bags.some((b) => b.temp === "COLD")) w.push("cold");
  // Reusables collection is hidden until the Reusable pickup sprint (src/data/sprints.ts).
  if (isOn("reusables") && (stop.kind === "pickup" || stop.reusables?.length)) w.push("reusables");
  return w;
}

/**
 * Delivery flow (SFK, Oct 15 2026):
 * - Most routes are 1–3 stops. Drivers load a few orders and deliver them in route order.
 * - Hot goes first, and there's only one hot order per vehicle, so the hot order is always stop 1.
 * - A reusables pickup can be at the same stop as a drop-off (s1 collects its totes) or later in the route (p1).
 * - A route can have more than one kitchen pickup: once run 1 is delivered, the driver goes back to load run 2.
 *   Each run has at most one hot order, and it's that run's first stop.
 */
export const STOPS: Stop[] = [
  {
    id: "s1",
    seq: 1,
    orderNo: "ORD-3104",
    customerType: "corporate",
    orderType: "Daily Lunch",
    name: "Neptune Corp",
    addressLine1: "550 Howard St",
    addressLine2: "Floor 3 · Pantry",
    city: "San Francisco, CA 94105",
    windowStart: 11 * 60 + 30,
    windowEnd: 12 * 60,
    meals: 24,
    packaging: "Reusable · Hot",
    bags: [
      { id: "b1", label: "Hot mains · names A–F", temp: "HOT", detail: "Lemon chicken, rice bowls" },
      { id: "b2", label: "Hot mains · names G–M", temp: "HOT", detail: "Lemon chicken, veggie curry" },
      { id: "b3", label: "Hot mains · names N–Z", temp: "HOT", detail: "Veggie curry, rice bowls" },
      { id: "b4", label: "Salads", temp: "COLD", detail: "Name-labelled, with dressings" },
    ],
    buildingNotes:
      "Check in at lobby security with your SFK badge. Use freight elevator B (left of the loading dock on Natoma St).",
    hasBuildingPhoto: true,
    dropoffNotes: "Place meals on the long pantry counter, sorted by name label. Hot bags on the left.",
    returns: "Collect yesterday's empty totes (by the pantry door).",
    reusables: [{ id: "s1-tote", label: "Empty reusable totes", expected: 3 }],
    setup: ["Lay meals on the pantry counter by name label", "Hot bags on the left, cold on the right", "Take the lids off the hot trays"],
    setupSource: "company",
    parking: "Loading dock on Natoma St, 20 min max",
    contact: { name: "Priya Nair", role: "Office manager · Neptune Corp", phone: "(415) 555-0192" },
    backupContact: { name: "Front desk", role: "Neptune Corp reception", phone: "(415) 555-0190" },
    at: PLACES.s1,
    driveMins: 9,
    miles: 2.9,
  },
  {
    id: "s2",
    seq: 2,
    orderNo: "ORD-3109",
    customerType: "family",
    orderType: "Family Style",
    name: "Mirendil Inc",
    addressLine1: "88 King St",
    addressLine2: "Suite 400 · Conf. room 4B",
    city: "San Francisco, CA 94107",
    windowStart: 12 * 60,
    windowEnd: 12 * 60 + 15,
    guestReadyTime: 12 * 60 + 15,
    meals: 20,
    packaging: "Compostable · Cold",
    bags: [
      { id: "b5", label: "Sandwich platters", temp: "COLD", detail: "Turkey, caprese, hummus wrap" },
      { id: "b6", label: "Grain bowls & salads", temp: "COLD", detail: "Farro bowl, Caesar, fruit" },
      { id: "b8", label: "Dressings & desserts", temp: "COLD", detail: "Cookies, brownies" },
      { id: "b7", label: "Plates, napkins & utensils", temp: "COLD", detail: "For the setup" },
    ],
    buildingNotes: "Street parking is tight. 15-min loading zone in front of the building on King St.",
    hasBuildingPhoto: false,
    dropoffNotes: "Team lunch for 20. Please set up in conference room 4B before 12:15. Ask front desk for Jordan.",
    setup: ["Set platters on the side table", "Lay out salads, dressings and desserts", "Put out plates, napkins and utensils"],
    setupSource: "address",
    serve: true,
    parking: "15-min loading zone in front, on King St",
    contact: { name: "Jordan Lee", role: "Event host · Mirendil Inc", phone: "(415) 555-0177" },
    backupContact: { name: "Casey Moore", role: "Office manager · Mirendil Inc", phone: "(415) 555-0171" },
    at: PLACES.s2,
    driveMins: 11,
    miles: 1.1,
  },
  {
    id: "s3",
    seq: 3,
    run: 2, // loaded on the second kitchen pickup
    orderNo: "ORD-3112",
    customerType: "individual",
    orderType: "Individual",
    name: "Daniel Kim",
    photo: danielPhoto, // stock portrait (randomuser.me) standing in for the customer's profile photo
    addressLine1: "201 Folsom St",
    addressLine2: "Apt 1207",
    city: "San Francisco, CA 94105",
    windowStart: 13 * 60,
    windowEnd: 13 * 60 + 30,
    meals: 2,
    packaging: "Disposable · Cold",
    bags: [{ id: "b9", label: "Meals for D. Kim", temp: "COLD", detail: "Poke bowl, side salad" }],
    buildingNotes: "Concierge desk in lobby, open 7am–10pm.",
    hasBuildingPhoto: false,
    dropoffNotes: "Leave with the concierge if I don't answer. Text when you arrive please!",
    parking: "Street parking on Folsom, or the lobby drop-off lane",
    contact: { name: "Daniel Kim", role: "Customer", phone: "(415) 555-0133" },
    backupContact: { name: "Concierge", role: "201 Folsom lobby", phone: "(415) 555-0130" },
    at: PLACES.s3,
    driveMins: 7,
    miles: 0.8,
  },
  {
    id: "p1",
    seq: 4,
    kind: "pickup",
    orderNo: "PU-2207",
    customerType: "corporate",
    orderType: "Reusables pickup",
    name: "Brightline Health",
    addressLine1: "1 Sansome St",
    addressLine2: "Floor 12 · Kitchenette",
    city: "San Francisco, CA 94104",
    windowStart: 13 * 60 + 45,
    windowEnd: 14 * 60 + 30,
    meals: 0,
    packaging: "Reusables",
    bags: [],
    buildingNotes: "Security desk in the lobby issues a pass. Freight elevator at the back.",
    hasBuildingPhoto: false,
    dropoffNotes: "Totes and trays are stacked by the kitchenette sink.",
    reusables: [
      { id: "p1-tote", label: "Insulated totes", expected: 6 },
      { id: "p1-tray", label: "Hot trays (full pans)", expected: 4 },
      { id: "p1-lid", label: "Tray lids", expected: 4 },
    ],
    parking: "Loading dock on Sutter St",
    contact: { name: "Nadia Flores", role: "Office manager · Brightline Health", phone: "(415) 555-0155" },
    at: PLACES.p1,
    driveMins: 5,
    miles: 0.7,
  },
];

/* ---------------- Staffing (US-814 multi-driver, US-815 role labels) ---------------- */

/** Hardcoded until the Dispatch Manager confirms the list. A label only: it changes no permissions. */
export type StaffRole = "Driver" | "Event Staff" | "Lead Event Staff";
export const STAFF_ROLES: StaffRole[] = ["Driver", "Event Staff", "Lead Event Staff"];

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  /** Stand-in for staff whose availability isn't modelled here. Marcus's comes from his Availability screen. */
  isAvailable?: boolean;
}

/** One person on a delivery. `role` missing = legacy assignment: render no badge and no placeholder. */
export interface Assignment {
  userId: string;
  role?: StaffRole;
}

export const STAFF: StaffMember[] = [
  { id: DRIVER.id, name: DRIVER.name, initials: DRIVER.initials },
  { id: "u-lena", name: "Lena Park", initials: "LP", isAvailable: true },
  { id: "u-tomas", name: "Tomás Rivera", initials: "TR", isAvailable: true },
  { id: "u-aisha", name: "Aisha Bello", initials: "AB", isAvailable: true },
  { id: "u-ken", name: "Ken Watanabe", initials: "KW", isAvailable: false },
  /** #74: a stand-in for a driver without the app. Their stops are marked at the SFK office. */
  { id: "u-appless", name: "Appless driver (office)", initials: "AD", isAvailable: true },
];

/** Mix of legacy (single driver, no role) and new (multi-driver, with roles) assignments. */
export const INITIAL_ASSIGNMENTS: Record<string, Assignment[]> = {
  s1: [{ userId: DRIVER.id }],
  s2: [
    { userId: DRIVER.id, role: "Lead Event Staff" },
    { userId: "u-lena", role: "Event Staff" },
    { userId: "u-tomas", role: "Event Staff" },
  ],
  s3: [{ userId: DRIVER.id, role: "Driver" }],
  p1: [{ userId: DRIVER.id }],
};

/* ---------------- Unassigned orders ----------------
 * Orders with no driver yet. Drivers don't browse these: dispatch sends one to a driver as a
 * request, and when the driver accepts it joins the end of today's route. `seq` is set then.
 */
export const OPEN_POOL: Stop[] = [
  {
    id: "o1",
    seq: 0,
    orderNo: "ORD-3121",
    customerType: "corporate",
    orderType: "Daily Lunch",
    name: "Lumen Studio",
    addressLine1: "500 Terry A Francois Blvd",
    addressLine2: "Floor 2 · Kitchen",
    city: "San Francisco, CA 94158",
    windowStart: 12 * 60 + 45,
    windowEnd: 13 * 60 + 15,
    meals: 16,
    packaging: "Reusable · Hot",
    bags: [
      { id: "b12", label: "Bag 1 of 2", temp: "HOT", detail: "Mains A–K · 8 meals" },
      { id: "b13", label: "Bag 2 of 2", temp: "HOT", detail: "Mains L–Z · 8 meals" },
    ],
    buildingNotes: "Loading zone on Terry A Francois Blvd. Front desk will buzz you up.",
    hasBuildingPhoto: false,
    dropoffNotes: "Leave on the kitchen counter by the windows.",
    contact: { name: "Mei Tan", role: "Office manager · Lumen Studio", phone: "(415) 555-0118" },
    openReason: "Original driver called in sick",
    at: PLACES.o1,
    driveMins: 6,
    miles: 2.1,
  },
  {
    id: "o2",
    seq: 0,
    orderNo: "ORD-3124",
    customerType: "corporate",
    orderType: "Daily Lunch",
    name: "Pinecrest Health",
    addressLine1: "345 Spear St",
    addressLine2: "Suite 700",
    city: "San Francisco, CA 94105",
    windowStart: 13 * 60,
    windowEnd: 13 * 60 + 30,
    meals: 6,
    packaging: "Disposable · Hot & Cold",
    bags: [
      { id: "b14", label: "Bag 1 of 2", temp: "HOT", detail: "Mains · 6 meals" },
      { id: "b15", label: "Bag 2 of 2", temp: "COLD", detail: "Salads & drinks" },
    ],
    buildingNotes: "Sign in at the lobby desk. Use the main elevators.",
    hasBuildingPhoto: false,
    dropoffNotes: "Late add-on. Hand to reception, they'll call the team.",
    contact: { name: "Ravi Shah", role: "Team lead · Pinecrest Health", phone: "(415) 555-0124" },
    openReason: "Late order after cutoff",
    at: PLACES.o2,
    driveMins: 7,
    miles: 2.9,
  },
  {
    id: "o3",
    seq: 0,
    orderNo: "ORD-3127",
    customerType: "corporate",
    orderType: "Daily Lunch",
    name: "Harbor & Co",
    addressLine1: "1 Ferry Building",
    addressLine2: "Suite 300",
    city: "San Francisco, CA 94111",
    windowStart: 12 * 60 + 30,
    windowEnd: 13 * 60,
    meals: 10,
    packaging: "Reusable · Hot",
    bags: [{ id: "b16", label: "Bag 1 of 1", temp: "HOT", detail: "Mains · 10 meals" }],
    buildingNotes: "Deliveries through the north entrance on the Embarcadero side.",
    hasBuildingPhoto: false,
    dropoffNotes: "Ask for Leo at the Suite 300 front desk.",
    contact: { name: "Leo Grant", role: "Operations · Harbor & Co", phone: "(415) 555-0127" },
    openReason: "Unassigned at dispatch",
    at: PLACES.o3,
    driveMins: 8,
    miles: 3.2,
  },
  {
    id: "o4",
    seq: 0,
    orderNo: "ORD-3126",
    customerType: "individual",
    orderType: "Individual",
    name: "Chris Nguyen",
    addressLine1: "88 Townsend St",
    addressLine2: "Unit 410",
    city: "San Francisco, CA 94107",
    windowStart: 12 * 60 + 45,
    windowEnd: 13 * 60 + 15,
    meals: 3,
    packaging: "Disposable · Cold",
    bags: [{ id: "b18", label: "Bag 1 of 1", temp: "HOT", detail: "3 meals · name label C. Nguyen" }],
    buildingNotes: "Front desk signs visitors in. Take the food up to the unit.",
    hasBuildingPhoto: false,
    dropoffNotes: "Baby sleeping, please knock softly. Don't ring the bell.",
    contact: { name: "Chris Nguyen", role: "Customer", phone: "(415) 555-0186" },
    openReason: "Late order after cutoff",
    at: PLACES.o4,
    driveMins: 5,
    miles: 2.4,
  },
];

/* ---------------- Settings SFK controls (scope doc "Settings SFK controls") ---------------- */
export const SETTINGS = {
  foodSafetyMins: 60, // time from loading before the food-safety limit (SFK ~1 h)
  foodSafetyWarnMins: 15, // warn this many minutes before the limit
  deliveredRadiusMi: 0.1, // "one block": further than this and "Delivered" warns + flags dispatch
  timeOffNoticeDays: 7, // #76 out of office must be at least X days ahead
  requestReminderHours: 4, // #18 reminder every X hours while a request is pending
  requestFlagHours: 48, // #18 dispatch is flagged this long before delivery if not accepted
  appVersion: "3.0.2",
};

/* ---------------- Vehicles (#64, #79) ---------------- */
export interface Vehicle {
  id: string;
  name: string;
  detail: string;
  owner: "driver" | "sfk";
}
export const VEHICLES: Vehicle[] = [
  { id: "v-own", name: "Your car", detail: "Default vehicle · 7ABC921", owner: "driver" },
  { id: "v-van1", name: "SFK Van 1", detail: "Ford Transit · 8KXM209", owner: "sfk" },
  { id: "v-van2", name: "SFK Van 2", detail: "Ford Transit · 8KXM214", owner: "sfk" },
];
export const DEFAULT_VEHICLE_ID = "v-own";
/** Free text only dispatch can edit; drivers read it (#64). */
export const STORAGE_DETAILS = "Fits 6 hot carriers + 2 cold boxes. Rear row folds flat. No chafing kits on the back seat.";

/* ---------------- Open hours (#16): set by dispatch, read-only for the driver ----------------
 * Minutes since midnight per weekday, Monday first. null = closed (no work sent that day).
 * Dispatch edits these on the dispatch page; the phone shows them under Schedule → Your open hours.
 */
export type OpenDay = { start: number; end: number } | null;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const OPEN_HOURS: OpenDay[] = [
  { start: 9 * 60 + 30, end: 14 * 60 + 30 },
  { start: 9 * 60 + 30, end: 14 * 60 + 30 },
  { start: 9 * 60 + 30, end: 14 * 60 + 30 },
  { start: 9 * 60 + 30, end: 14 * 60 + 30 },
  { start: 10 * 60, end: 13 * 60 + 30 },
  null,
  null,
];
/** Monday-first weekday index (0–6) of an ISO date. */
export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
};
export const fmtHours = (h: OpenDay) => (h ? `${fmtTime(h.start)} – ${fmtTime(h.end)}` : "Off");

/* ---------------- Delivery requests (#17–20, #77) ----------------
 * Every assignment is a request the driver confirms. Declining needs a reason.
 * Placeholders (#44, #70) are the driver's usual recurring route before the real order comes in.
 */
export type RequestStatus = "pending" | "accepted" | "declined";
export interface DeliveryRequest {
  id: string;
  /** Same-day request for an unassigned order: accepting adds it to today's route. */
  orderId?: string;
  orderNo: string;
  name: string;
  address: string;
  dateISO: string;
  dateLabel: string;
  /** Multi-day orders list every day (#20). `dayISOs` matches `days` one to one. */
  days?: string[];
  dayISOs?: string[];
  time: number; // rough time, minutes since midnight
  /** Kept for dispatch only. Review Oct 14 2026: counts aren't shown to drivers. */
  meals: number;
  type: string;
  customerType: CustomerType;
  /** Review Oct 14 2026: work type on every stop, so on every request too. */
  work: Work[];
  /** #18: last reminder sent (minutes since midnight today); the next one is SETTINGS.requestReminderHours later. */
  remindedAt?: number;
  role?: StaffRole;
  placeholder?: boolean;
  status: RequestStatus;
  sentAt: string;
  reason?: string;
}

export const REQUESTS: DeliveryRequest[] = [
  { id: "r1", orderNo: "ORD-3131", name: "Neptune Corp", address: "550 Howard St", dateISO: "2026-10-07", dateLabel: "Wed, Oct 7", time: 11 * 60 + 30, meals: 22, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Mon 4:10 PM" },
  { id: "r2", orderNo: "ORD-3140", name: "Brightline Health", address: "1 Sansome St", dateISO: "2026-10-07", dateLabel: "Wed, Oct 7", time: 12 * 60, meals: 40, type: "Family Style", customerType: "family", work: ["hot", "cold"], role: "Lead Event Staff", status: "pending", sentAt: "Mon 9:00 AM", remindedAt: 9 * 60 + 40 },
  { id: "r3", orderNo: "ORD-3135", name: "Halcyon Labs", address: "1 Market St", dateISO: "2026-10-08", dateLabel: "Thu, Oct 8", time: 12 * 60 + 30, meals: 14, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "pending", sentAt: "Today 8:15 AM", remindedAt: 9 * 60 + 40 },
  { id: "r4", orderNo: "ORD-3150", name: "Summit Partners offsite", address: "Fort Mason Center, Pier 2", dateISO: "2026-10-12", dateLabel: "Mon, Oct 12", days: ["Mon, Oct 12", "Tue, Oct 13", "Wed, Oct 14"], dayISOs: ["2026-10-12", "2026-10-13", "2026-10-14"], time: 11 * 60 + 45, meals: 60, type: "Family Style", customerType: "family", work: ["hot", "cold"], role: "Driver", status: "pending", sentAt: "Today 9:40 AM", remindedAt: 9 * 60 + 40 },
  { id: "r5", orderNo: "Usual route", name: "Neptune Corp", address: "550 Howard St", dateISO: "2026-10-09", dateLabel: "Fri, Oct 9", time: 11 * 60 + 30, meals: 0, type: "Daily Lunch", customerType: "corporate", work: ["hot"], placeholder: true, status: "accepted", sentAt: "Weekly plan" },
  // More accepted work so Coming up shows a real few weeks.
  { id: "r7", orderNo: "ORD-3162", name: "Cobalt Robotics", address: "185 Berry St", dateISO: "2026-10-07", dateLabel: "Wed, Oct 7", time: 13 * 60 + 15, meals: 18, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Mon 2:20 PM" },
  { id: "r8", orderNo: "ORD-3165", name: "Mission Bay Clinic", address: "1825 4th St", dateISO: "2026-10-08", dateLabel: "Thu, Oct 8", time: 10 * 60 + 45, meals: 12, type: "Breakfast", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Mon 3:05 PM" },
  { id: "r9", orderNo: "ORD-3167", name: "Harbor Analytics", address: "100 Pine St", dateISO: "2026-10-08", dateLabel: "Thu, Oct 8", time: 11 * 60 + 45, meals: 26, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Mon 3:05 PM" },
  { id: "r10", orderNo: "ORD-3170", name: "Redwood Design Co.", address: "690 5th St", dateISO: "2026-10-09", dateLabel: "Fri, Oct 9", time: 11 * 60, meals: 30, type: "Daily Lunch", customerType: "corporate", work: ["hot", "cold"], status: "accepted", sentAt: "Mon 5:30 PM" },
  { id: "r11", orderNo: "ORD-3171", name: "Golden Gate Montessori", address: "2340 Jackson St", dateISO: "2026-10-09", dateLabel: "Fri, Oct 9", time: 12 * 60 + 15, meals: 24, type: "Family Style", customerType: "family", work: ["hot"], status: "accepted", sentAt: "Mon 5:30 PM" },
  { id: "r12", orderNo: "ORD-3174", name: "Neptune Corp", address: "550 Howard St", dateISO: "2026-10-12", dateLabel: "Mon, Oct 12", time: 11 * 60 + 30, meals: 22, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Today 7:50 AM" },
  { id: "r13", orderNo: "ORD-3176", name: "Embarcadero Legal", address: "4 Embarcadero Center", dateISO: "2026-10-13", dateLabel: "Tue, Oct 13", time: 12 * 60 + 30, meals: 16, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Today 7:50 AM" },
  { id: "r14", orderNo: "ORD-3178", name: "Neptune Corp", address: "550 Howard St", dateISO: "2026-10-14", dateLabel: "Wed, Oct 14", time: 11 * 60 + 30, meals: 22, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Today 7:50 AM" },
  { id: "r15", orderNo: "ORD-3181", name: "Fogline Coffee HQ", address: "1 Ferry Building", dateISO: "2026-10-15", dateLabel: "Thu, Oct 15", time: 10 * 60, meals: 20, type: "Breakfast", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Today 8:05 AM" },
  { id: "r16", orderNo: "ORD-3183", name: "Brightline Health", address: "1 Sansome St", dateISO: "2026-10-15", dateLabel: "Thu, Oct 15", time: 12 * 60, meals: 38, type: "Family Style", customerType: "family", work: ["hot", "cold"], status: "accepted", sentAt: "Today 8:05 AM" },
  { id: "r17", orderNo: "ORD-3186", name: "Lumen Studio", address: "500 Terry A Francois Blvd", dateISO: "2026-10-16", dateLabel: "Fri, Oct 16", time: 12 * 60 + 45, meals: 16, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Today 8:05 AM" },
  { id: "r18", orderNo: "ORD-3190", name: "Neptune Corp", address: "550 Howard St", dateISO: "2026-10-19", dateLabel: "Mon, Oct 19", time: 11 * 60 + 30, meals: 22, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Today 8:30 AM" },
  { id: "r19", orderNo: "ORD-3192", name: "Halcyon Labs", address: "1 Market St", dateISO: "2026-10-20", dateLabel: "Tue, Oct 20", time: 12 * 60 + 30, meals: 14, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Today 8:30 AM" },
  { id: "r20", orderNo: "ORD-3195", name: "Presidio Sports Club", address: "1 Letterman Dr", dateISO: "2026-10-21", dateLabel: "Wed, Oct 21", time: 13 * 60, meals: 45, type: "Family Style", customerType: "family", work: ["hot", "cold"], status: "accepted", sentAt: "Today 8:30 AM" },
  // A busy day (Thu, Oct 15: five deliveries) so the time-off sheet shows "+2 more".
  { id: "r21", orderNo: "ORD-3197", name: "Cobalt Robotics", address: "185 Berry St", dateISO: "2026-10-15", dateLabel: "Thu, Oct 15", time: 11 * 60, meals: 18, type: "Daily Lunch", customerType: "corporate", work: ["cold"], status: "accepted", sentAt: "Today 8:40 AM" },
  { id: "r22", orderNo: "ORD-3198", name: "Harbor Analytics", address: "100 Pine St", dateISO: "2026-10-15", dateLabel: "Thu, Oct 15", time: 12 * 60 + 45, meals: 26, type: "Daily Lunch", customerType: "corporate", work: ["hot"], status: "accepted", sentAt: "Today 8:40 AM" },
  { id: "r23", orderNo: "ORD-3199", name: "Golden Gate Montessori", address: "2340 Jackson St", dateISO: "2026-10-15", dateLabel: "Thu, Oct 15", time: 13 * 60 + 30, meals: 24, type: "Family Style", customerType: "family", work: ["hot"], status: "accepted", sentAt: "Today 8:40 AM" },
];

export const PAST = [
  { date: "Mon, Oct 5", stops: 5, meals: 61, onTime: 5 },
  { date: "Fri, Oct 2", stops: 4, meals: 52, onTime: 3 },
  { date: "Thu, Oct 1", stops: 4, meals: 49, onTime: 4 },
];

export function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtWindow(a: number, b: number) {
  return `${fmtTime(a).replace(/ (AM|PM)$/, "")} – ${fmtTime(b)}`;
}

/** Street route between two places ("k" = kitchen). Straight line if this pair wasn't pre-routed. */
export function legBetween(from: string, to: string): LngLat[] {
  const at = (id: string) => (id === "k" ? KITCHEN.at : [...STOPS, ...OPEN_POOL].find((x) => x.id === id)!.at);
  return LEGS[`${from}-${to}`] ?? [at(from), at(to)];
}
