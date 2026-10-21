import { useEffect, useState } from "react";
import { ArrowUp, Compass, CornerUpLeft, CornerUpRight, MapPin, Search, Split, Volume2, X } from "lucide-react";
import { findStop, legStart, liveRoute, useApp } from "../store";
import { KITCHEN, driveBetween, fmtTime, legBetween, runOf } from "../data/route";
import type { LngLat } from "../data/geo";
import { cn } from "../components/ui";
import { MapView, along, type Pin } from "../components/MapView";

/**
 * #3 navigation (Oct 21 2026): turn-by-turn hands off to Google Maps, so this screen IS Google Maps in the prototype:
 * green turn card (next turn + "Then"), blue route and chevron, round map buttons, current speed, and the white ETA
 * sheet with exit and routes. Turns come from the real leg geometry. iOS's "◀ SFK Driver" in the status bar (App.tsx)
 * goes back to the app, where Home has "Slide when you arrive". At the end Google's "You've arrived" sheet shows.
 */

const GREEN = "#1B7D3F"; // Google Maps navigation banner
const GREEN_DARK = "#0F5E2E";
const font = { fontFamily: '"Google Sans", Roboto, "Helvetica Neue", Arial, sans-serif' };

/* Distance in miles between two points (equirectangular is plenty across a few blocks). */
const rad = (d: number) => (d * Math.PI) / 180;
const miles = (a: LngLat, b: LngLat) => Math.hypot(rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2)), rad(b[1] - a[1])) * 3959;
const heading = (a: LngLat, b: LngLat) => (Math.atan2(rad(b[0] - a[0]) * Math.cos(rad(a[1])), rad(b[1] - a[1])) * 180) / Math.PI;

type Turn = { dir: "left" | "right" | "arrive"; at: number }; // `at` = miles from the driver

/** The turns still ahead on the remaining polyline: a bend of more than 35° counts as a turn. */
function turnsAhead(rest: LngLat[]): Turn[] {
  const out: Turn[] = [];
  let d = 0;
  for (let i = 1; i < rest.length; i++) {
    d += miles(rest[i - 1], rest[i]);
    if (i < rest.length - 1) {
      let delta = heading(rest[i], rest[i + 1]) - heading(rest[i - 1], rest[i]);
      delta = ((delta + 540) % 360) - 180;
      if (Math.abs(delta) > 35 && miles(rest[i], rest[i + 1]) > 0.01) out.push({ dir: delta > 0 ? "right" : "left", at: d });
    }
  }
  out.push({ dir: "arrive", at: d });
  return out;
}

/** Google style: feet under a tenth of a mile (rounded to 50), else one decimal. */
const fmtDist = (mi: number) => (mi < 0.1 ? `${Math.max(50, Math.round((mi * 5280) / 50) * 50)} ft` : `${mi.toFixed(1)} mi`);

const TurnIcon = ({ dir, className }: { dir: Turn["dir"] | "straight"; className?: string }) => {
  const I = dir === "left" ? CornerUpLeft : dir === "right" ? CornerUpRight : dir === "arrive" ? MapPin : ArrowUp;
  return <I className={className} strokeWidth={2.6} />;
};

/** `id` = a stop, or "k" for the drive back to the kitchen before a later pickup (Oct 21 2026). */
export function Navigate({ id }: { id: string }) {
  const { s, a } = useApp();
  const toKitchen = id === "k";
  // Back to the kitchen: from the last stop of the pickup before this one.
  const from = toKitchen ? ([...liveRoute(s)].reverse().find((x) => x.kind !== "pickup" && runOf(x) < s.run)?.id ?? "k") : null;
  const kitchenDrive = from ? driveBetween(from, "k") : null;
  const stop = toKitchen
    ? { id: "k", seq: 0, name: KITCHEN.name, addressLine1: KITCHEN.addressLine1, at: KITCHEN.at, driveMins: kitchenDrive!.mins, miles: kitchenDrive!.miles }
    : findStop(s, id);
  const leg = toKitchen ? legBetween(from!, "k") : legBetween(legStart(s, findStop(s, id)), id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setProgress((p) => (p >= 1 ? 1 : +(p + 0.01).toFixed(2))), 90);
    return () => window.clearInterval(t);
  }, []);

  const minsLeft = Math.max(1, Math.round(stop.driveMins * (1 - progress)));
  const milesLeft = stop.miles * (1 - progress);
  const eta = s.clock + minsLeft;
  const arrived = progress >= 1;
  const street = stop.addressLine1.replace(/^\d+\s*/, ""); // "88 King St" → "King St"

  const turns = turnsAhead(along(leg, progress).rest);
  const next = turns[0];
  const then = turns[1];
  const speed = arrived ? 0 : 18 + Math.round(10 * Math.abs(Math.sin(progress * 9))); // mph, just for the gauge

  const pins: Pin[] = [{ id: stop.id, at: stop.at, label: String(stop.seq), state: "active" }];
  const exit = () => a.jump(() => ({ stack: [{ name: "tabs" }], tab: "today", sheet: null })); // leaving Google Maps → the app

  return (
    <div className="relative h-full overflow-hidden bg-[#F1F3F4]" style={font}>
      <div className="absolute inset-0">
        <MapView look="google" pins={pins} leg={leg} progress={progress} follow padding={{ top: 220, bottom: 200, left: 40, right: 40 }} recenterClassName="bottom-[150px] left-4" />
      </div>

      {/* Turn card: big arrow + distance + street, with the following turn tucked underneath. */}
      <div className="absolute inset-x-2 top-2">
        <div className="rounded-[20px] px-4 pb-4 pt-3.5 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]" style={{ background: GREEN }}>
          {arrived ? (
            <div className="flex items-center gap-3">
              <MapPin className="size-9 shrink-0" strokeWidth={2.4} />
              <span className="min-w-0">
                <span className="block truncate text-[26px] font-medium leading-tight">{stop.addressLine1}</span>
                <span className="block text-[15px] text-white/85">Destination is on the right</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <TurnIcon dir={next.dir} className="size-11 shrink-0" />
              <span className="min-w-0">
                <span className="nums block text-[28px] font-medium leading-none">{fmtDist(next.at)}</span>
                <span className="mt-1 block truncate text-[19px] leading-tight">{next.dir === "arrive" ? `${stop.addressLine1}` : next.dir === "left" ? "Turn left" : "Turn right"}</span>
              </span>
            </div>
          )}
        </div>
        {!arrived && then && (
          <div className="ml-3 inline-flex items-center gap-1.5 rounded-b-xl px-3.5 py-1.5 text-[15px] font-medium text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]" style={{ background: GREEN_DARK }}>
            Then <TurnIcon dir={then.dir} className="size-5" />
          </div>
        )}
      </div>

      {/* Round map buttons on the right, as in Google Maps. */}
      <div className="absolute right-3 top-[150px] flex flex-col gap-3">
        {[
          { I: Compass, label: "Compass", tone: "text-[#EA4335]" },
          { I: Search, label: "Search along route", tone: "text-[#3C4043]" },
          { I: Volume2, label: "Sound", tone: "text-[#3C4043]" },
        ].map(({ I, label, tone }) => (
          <button key={label} aria-label={label} onClick={() => a.toast(label)} className="grid size-12 place-items-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
            <I className={cn("size-[22px]", tone)} />
          </button>
        ))}
      </div>

      {/* Current speed, bottom left above the sheet. */}
      {!arrived && (
        <div className="absolute bottom-[140px] left-3 grid size-14 place-items-center rounded-full bg-white text-center leading-none text-[#202124] shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
          <span>
            <span className="nums block text-[20px] font-medium">{speed}</span>
            <span className="block text-[10px] text-[#5F6368]">mph</span>
          </span>
        </div>
      )}

      {/* Bottom sheet: exit · time / distance / arrival · route options. "You've arrived" at the end. */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-white px-4 pb-8 pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.18)]">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[#DADCE0]" />
        {arrived ? (
          <div>
            <div className="text-[22px] font-medium text-[#202124]">You've arrived</div>
            <div className="mt-0.5 truncate text-[15px] text-[#5F6368]">
              {stop.name} · {stop.addressLine1}
            </div>
            <button onClick={exit} className="mt-4 h-12 w-full rounded-full text-[15px] font-medium text-white" style={{ background: "#1A73E8" }}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={exit} aria-label="Exit navigation" className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F1F3F4] text-[#3C4043]">
              <X className="size-6" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="nums text-[26px] font-medium leading-tight text-[#188038]">{minsLeft} min</div>
              <div className="nums text-[15px] text-[#5F6368]">
                {milesLeft.toFixed(1)} mi · {fmtTime(eta)}
              </div>
            </div>
            <button onClick={() => a.toast("Route options")} aria-label="Route options" className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F1F3F4] text-[#3C4043]">
              <Split className="size-5" />
            </button>
          </div>
        )}
        {!arrived && <div className="mt-2 truncate text-center text-[13px] text-[#5F6368]">via {street} · {stop.name}</div>}
      </div>
    </div>
  );
}
