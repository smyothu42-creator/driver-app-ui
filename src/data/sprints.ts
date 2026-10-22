/* ------------------------------------------------------------------
 * Design timeline gate (SFK Design Sprint Plan, 3 weeks from Oct 13 2026).
 * Only the feature areas in LIVE are shown. Everything else stays in the code
 * but shows "Coming soon" in the app and is left out of the flow guide.
 * Add an area to LIVE to reveal it.
 *   Sprint 1 (Oct 13): Route & stop (Wed Oct 14), Kitchen load (Wed Oct 14), Drop-off + crew (Thu Oct 15)
 *   Sprint 2 (Oct 19): Schedule & assignment (shown Oct 19, due Tue Oct 20), Reusable pickup, Notifications
 *   Sprint 3 (Oct 26): Login, profile & duty (incl. language)
 * ------------------------------------------------------------------ */

export type Area = "route" | "kitchen" | "dropoff" | "team" | "schedule" | "reusables" | "notifications" | "profile" | "unplanned";

export const LIVE: ReadonlySet<Area> = new Set<Area>(["route", "kitchen", "dropoff", "schedule", "reusables", "notifications"]);

export interface AreaInfo {
  feature: string;
  sprint: number | null; // null = not in the 3-week plan
  due?: string; // when its flow + UI is due
}

export const AREAS: Record<Area, AreaInfo> = {
  route: { feature: "Route & stop", sprint: 1, due: "Wed, Oct 14" },
  kitchen: { feature: "Kitchen load", sprint: 1, due: "Wed, Oct 14" },
  dropoff: { feature: "Drop-off", sprint: 1, due: "Thu, Oct 15" },
  team: { feature: "Crew, roles & lead attendance", sprint: 1, due: "Thu, Oct 15" }, // split from Drop-off so it can stay hidden
  schedule: { feature: "Schedule & assignments", sprint: 2, due: "Tue, Oct 20" },
  reusables: { feature: "Reusable pickup", sprint: 2, due: "Wed, Oct 21" },
  notifications: { feature: "Notifications", sprint: 2, due: "Thu, Oct 22" },
  profile: { feature: "Login, profile & duty", sprint: 3, due: "Tue, Oct 27" },
  unplanned: { feature: "Delivery history", sprint: null },
};

/** Which area each screen or tab belongs to. Screens not listed are part of Route & stop or plumbing (sign-in, permissions). */
const SCREEN_AREA: Record<string, Area> = {
  scan: "kitchen",
  pickup: "kitchen",
  package: "kitchen",
  publicPage: "kitchen",
  camera: "dropoff",
  proof: "dropoff",
  problem: "dropoff",
  collect: "reusables",
  schedule: "schedule",
  request: "schedule",
  requests: "schedule",
  availability: "schedule",
  inbox: "notifications",
  me: "profile",
  vehicle: "profile",
  tracking: "profile",
  history: "unplanned",
};

export const isOn = (area: Area) => LIVE.has(area);

/** The hidden area behind a screen or tab name, or null when it is shown. */
export function hiddenArea(name: string): Area | null {
  const area = SCREEN_AREA[name];
  return area && !isOn(area) ? area : null;
}

/** Back-compat: the hidden feature behind a screen or tab, or null when shown. */
export function laterFor(name: string): AreaInfo | null {
  const area = hiddenArea(name);
  return area ? AREAS[area] : null;
}
