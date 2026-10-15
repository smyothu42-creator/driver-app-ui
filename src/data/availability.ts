/**
 * Driver availability (US-813).
 *
 * Stored sparsely, keyed by ISO date. A day with no entry is "available": every driver
 * starts with an open, unrestricted schedule and only records the days they restrict.
 * Dispatch reads this (via coversWindow) to gray out drivers in the assignment field.
 */

export type DayStatus = "available" | "unavailable" | "custom";

export interface DayAvailability {
  status: DayStatus;
  /** Time off the driver asked for that dispatch hasn't approved yet. Still a working day until approved. */
  requested?: boolean;
  start?: number; // minutes since midnight, only for "custom"
  end?: number;
}

export type Availability = Record<string, DayAvailability>;

export const OPEN_DAY: DayAvailability = { status: "available" };
export const DEFAULT_HOURS = { start: 8 * 60, end: 14 * 60 }; // 8 AM – 2 PM

export function dayOf(av: Availability, iso: string): DayAvailability {
  return av[iso] ?? OPEN_DAY;
}

/** True when the driver's day fully covers a delivery window (both in minutes since midnight). */
export function coversWindow(day: DayAvailability, start: number, end: number) {
  if (day.status === "available") return true;
  if (day.status === "unavailable") return !!day.requested;
  return (day.start ?? 0) <= start && (day.end ?? 24 * 60) >= end;
}

/* ---------------- Date helpers (local time, no library) ---------------- */

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday of the week containing d (routes run Mon–Fri, so weeks start Monday). */
export function startOfWeek(d: Date) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Calendar cells for a month, padded with nulls so day 1 lands on its weekday (Mon-first). */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const pad = (first.getDay() + 6) % 7;
  return [...Array<null>(pad).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
}

/** 6:00 AM – 10:00 PM in 30-minute steps, for the time window picker. */
export const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30);
