import type { StopStatus, Work } from "./route";

/* ------------------------------------------------------------------
 * Nov 4 2026 (review: "how will dispatch move between drivers and view/request things when there's 40+
 * deliveries a day?"): a stand-in fleet for the full-screen dispatch board. Marcus's stops, requests and
 * availability stay live (shared with the phone); everyone else here is fixed demo data, read at 11:08 AM.
 * ------------------------------------------------------------------ */

export type Duty = "on" | "off" | "time_off";

export interface FleetDriver {
  id: string;
  name: string;
  first: string;
  initials: string;
  type: "In-house" | "Contracted" | "No app";
  duty: Duty;
  vehicle: string;
  phone: string;
  /** Shift hours for the day, minutes since midnight. */
  shift?: [number, number];
}

export interface FleetStop {
  id: string;
  orderNo: string;
  name: string;
  area: string;
  windowStart: number;
  windowEnd: number;
  work: Work[];
  meals: number;
  driverId: string;
  status: StopStatus;
  /** Live ETA for the stop the driver is driving to. */
  eta?: number;
  issue?: string;
}

/** Things dispatch has to act on that aren't modelled in the live state (Marcus's are computed from it). */
export interface FleetAlert {
  id: string;
  driverId: string;
  stopId?: string;
  kind: "late" | "issue" | "declined" | "time_off" | "no_answer";
  title: string;
  detail: string;
  action: string;
}

const H = (h: number, m = 0) => h * 60 + m;

export const FLEET: FleetDriver[] = [
  { id: "u-lena", name: "Lena Park", first: "Lena", initials: "LP", type: "In-house", duty: "on", vehicle: "SFK Van 2", phone: "(415) 555-0131", shift: [H(9, 30), H(15)] },
  { id: "u-tomas", name: "Tomás Rivera", first: "Tomás", initials: "TR", type: "In-house", duty: "on", vehicle: "2021 Honda Odyssey", phone: "(415) 555-0162", shift: [H(10), H(15, 30)] },
  { id: "u-aisha", name: "Aisha Bello", first: "Aisha", initials: "AB", type: "Contracted", duty: "on", vehicle: "2018 Ford Transit", phone: "(415) 555-0177", shift: [H(10), H(14, 30)] },
  { id: "u-diego", name: "Diego Morales", first: "Diego", initials: "DM", type: "Contracted", duty: "on", vehicle: "2020 Toyota RAV4", phone: "(415) 555-0189", shift: [H(10, 30), H(14)] },
  { id: "u-priya", name: "Priya Shah", first: "Priya", initials: "PS", type: "In-house", duty: "on", vehicle: "SFK Van 1", phone: "(415) 555-0124", shift: [H(9), H(14)] },
  { id: "u-jordan", name: "Jordan Lee", first: "Jordan", initials: "JL", type: "Contracted", duty: "off", vehicle: "2019 Subaru Outback", phone: "(415) 555-0146", shift: [H(12), H(16)] },
  { id: "u-appless", name: "Appless driver (office)", first: "Office", initials: "AD", type: "No app", duty: "on", vehicle: "SFK Van 3", phone: "(415) 555-0100", shift: [H(10), H(14)] },
  { id: "u-ken", name: "Ken Watanabe", first: "Ken", initials: "KW", type: "In-house", duty: "time_off", vehicle: "2017 Honda CR-V", phone: "(415) 555-0153" },
];

let n = 4100;
const stop = (driverId: string, name: string, area: string, ws: number, we: number, work: Work[], meals: number, status: StopStatus, extra: Partial<FleetStop> = {}): FleetStop => ({
  id: `f${n}`,
  orderNo: `ORD-${n++}`,
  name,
  area,
  windowStart: ws,
  windowEnd: we,
  work,
  meals,
  driverId,
  status,
  ...extra,
});

export const FLEET_STOPS: FleetStop[] = [
  // Lena: busy morning, on time.
  stop("u-lena", "Atlas Robotics", "SoMa", H(10, 30), H(11), ["hot"], 24, "delivered"),
  stop("u-lena", "Fernway Bank", "FiDi", H(10, 45), H(11, 15), ["cold"], 12, "delivered"),
  stop("u-lena", "Quarry Labs", "Mission Bay", H(11, 15), H(11, 45), ["hot", "reusables"], 30, "en_route", { eta: H(11, 22) }),
  stop("u-lena", "Bluebird Health", "Dogpatch", H(12), H(12, 30), ["hot"], 18, "queued"),
  stop("u-lena", "Sora Design", "Potrero Hill", H(12, 30), H(13), ["cold"], 9, "queued"),
  stop("u-lena", "Verity Legal", "SoMa", H(13, 15), H(13, 45), ["reusables"], 0, "queued"),
  // Tomás
  stop("u-tomas", "Northwind Capital", "FiDi", H(10, 45), H(11, 15), ["hot"], 40, "delivered"),
  stop("u-tomas", "Kestrel AI", "SoMa", H(11, 30), H(12), ["hot", "cold"], 22, "en_route", { eta: H(11, 34) }),
  stop("u-tomas", "Juniper School", "Hayes Valley", H(12), H(12, 30), ["hot"], 60, "queued"),
  stop("u-tomas", "Ocean Ave Clinic", "Ingleside", H(12, 45), H(13, 15), ["cold"], 14, "queued"),
  stop("u-tomas", "Granite Partners", "FiDi", H(13, 30), H(14), ["reusables"], 0, "queued"),
  // Aisha
  stop("u-aisha", "Marble Media", "Union Sq", H(10, 30), H(11), ["cold"], 16, "delivered"),
  stop("u-aisha", "Helio Solar", "SoMa", H(11), H(11, 30), ["hot"], 28, "arrived"),
  stop("u-aisha", "Cedar & Pine", "Nob Hill", H(11, 45), H(12, 15), ["hot"], 11, "queued"),
  stop("u-aisha", "Tidewater Co", "Embarcadero", H(12, 15), H(12, 45), ["hot", "reusables"], 35, "queued"),
  stop("u-aisha", "Ivy Pediatrics", "Pac Heights", H(13), H(13, 30), ["cold"], 8, "queued"),
  stop("u-aisha", "Lattice Games", "SoMa", H(13, 30), H(14), ["hot"], 20, "queued"),
  // Diego: running late on his first open stop.
  stop("u-diego", "Harbor Analytics", "Embarcadero", H(11), H(11, 15), ["hot"], 26, "en_route", { eta: H(11, 24) }),
  stop("u-diego", "Redwood Design Co.", "Jackson Sq", H(11, 45), H(12, 15), ["cold"], 10, "queued"),
  stop("u-diego", "Mission Bay Clinic", "Mission Bay", H(12, 30), H(13), ["hot"], 32, "queued"),
  stop("u-diego", "Halcyon Labs", "Dogpatch", H(13), H(13, 30), ["hot", "reusables"], 18, "queued"),
  // Priya: one stop with an issue.
  stop("u-priya", "Cobalt Robotics", "SoMa", H(10), H(10, 30), ["hot"], 22, "delivered"),
  stop("u-priya", "Oak & Ivy", "Hayes Valley", H(10, 45), H(11, 15), ["cold"], 15, "issue", { issue: "Building locked, no answer at the front desk" }),
  stop("u-priya", "Summit Health", "Civic Center", H(11, 30), H(12), ["hot"], 44, "queued"),
  stop("u-priya", "Polaris Bio", "Mission Bay", H(12, 15), H(12, 45), ["hot"], 27, "queued"),
  stop("u-priya", "Brightline Health", "FiDi", H(13), H(13, 30), ["reusables"], 0, "queued"),
  // Jordan: starts at noon, not on duty yet.
  stop("u-jordan", "Saffron Studio", "Mission", H(12, 30), H(13), ["hot"], 19, "queued"),
  stop("u-jordan", "Fog City Law", "FiDi", H(13), H(13, 30), ["cold"], 12, "queued"),
  stop("u-jordan", "Waverly Group", "Marina", H(13, 45), H(14, 15), ["hot"], 33, "queued"),
  stop("u-jordan", "Pier 70 Works", "Dogpatch", H(14, 30), H(15), ["reusables"], 0, "queued"),
  // Office (appless driver): marked from the office.
  stop("u-appless", "Golden Gate Dental", "Marina", H(10, 30), H(11), ["cold"], 9, "delivered"),
  stop("u-appless", "Presidio Trust", "Presidio", H(11, 15), H(11, 45), ["hot"], 36, "en_route"),
  stop("u-appless", "Lands End Café", "Richmond", H(12, 15), H(12, 45), ["hot"], 14, "queued"),
  stop("u-appless", "Sunset Rec", "Sunset", H(13), H(13, 30), ["cold"], 25, "queued"),
  // Ken is on time off: his one stop needs a new driver.
  stop("u-ken", "Twin Peaks Realty", "Noe Valley", H(12), H(12, 30), ["hot"], 13, "queued"),
];

/** Ken's stop has no-one able to drive it. The board shows it as unassigned. */
export const UNCOVERED = new Set(FLEET_STOPS.filter((x) => x.driverId === "u-ken").map((x) => x.id));

export const FLEET_ALERTS: FleetAlert[] = [
  { id: "a-late", driverId: "u-diego", stopId: FLEET_STOPS.find((x) => x.name === "Harbor Analytics")!.id, kind: "late", title: "Diego · 9 min late", detail: "Harbor Analytics · window ends 11:15 AM · ETA 11:24 AM", action: "Tell customer" },
  { id: "a-issue", driverId: "u-priya", stopId: FLEET_STOPS.find((x) => x.name === "Oak & Ivy")!.id, kind: "issue", title: "Priya · can't get in", detail: "Oak & Ivy · “Building locked, no answer at the front desk”", action: "Call customer" },
  { id: "a-ken", driverId: "u-ken", stopId: [...UNCOVERED][0], kind: "time_off", title: "Ken is off today", detail: "Twin Peaks Realty · 12:00 – 12:30 PM has no driver", action: "Reassign" },
  { id: "a-jordan", driverId: "u-jordan", kind: "declined", title: "Jordan declined Fri, Oct 9", detail: "Waverly Group · “Car's in the shop Friday”", action: "Send to someone else" },
  { id: "a-aisha", driverId: "u-aisha", kind: "no_answer", title: "Aisha hasn't answered", detail: "Thu, Oct 8 · Juniper School · sent 2 days ago", action: "Remind" },
];
