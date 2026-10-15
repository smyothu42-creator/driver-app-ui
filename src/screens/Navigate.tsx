import { useEffect, useState } from "react";
import { ArrowUp, Car, CornerUpLeft, CornerUpRight, MapPin, MessageSquare, Phone, X } from "lucide-react";
import { findStop, legStart, liveRoute, useApp, useT } from "../store";
import { KITCHEN, fmtTime, legBetween } from "../data/route";
import { cn, SlideToConfirm, WorkTags } from "../components/ui";
import { MapView, type Pin } from "../components/MapView";

/**
 * #3 in-app navigation (chosen over a Google Maps hand-off, Oct 14 2026).
 * Turn card on top; the bottom panel keeps ETA, the stop's work + parking + drop-off note, and "slide when you arrive".
 */
export function Navigate({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const route = liveRoute(s);
  const stop = findStop(s, id);
  const leg = legBetween(legStart(s, stop), stop.id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setProgress((p) => (p >= 1 ? 1 : +(p + 0.01).toFixed(2))), 90);
    return () => window.clearInterval(t);
  }, []);

  const minsLeft = Math.max(0, Math.round(stop.driveMins * (1 - progress)));
  const milesLeft = (stop.miles * (1 - progress)).toFixed(1);
  const eta = s.clock + minsLeft;
  const late = eta > stop.windowEnd;
  const arriving = progress >= 0.95;
  // Prototype turns: a fixed sequence ending on the stop's own street.
  const street = stop.addressLine1.replace(/^\d+\s*/, "");
  const turn = progress < 0.35 ? { Icon: ArrowUp, text: "Continue on Mission St", dist: "0.6 mi" } : progress < 0.7 ? { Icon: CornerUpLeft, text: "Turn left onto 3rd St", dist: "800 ft" } : { Icon: CornerUpRight, text: `Turn right onto ${street}`, dist: "300 ft" };

  const pins: Pin[] = [
    { id: "k", at: KITCHEN.at, label: "SF", state: "kitchen" },
    ...route.map((x) => ({
      id: x.id,
      at: x.at,
      label: String(x.seq),
      state: (s.stops[x.id].status === "delivered" ? "done" : x.id === id ? "active" : "todo") as Pin["state"],
    })),
  ];

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0">
        {/* Camera follows the driver; padding keeps them above the bottom panel and below the turn card. */}
        <MapView pins={pins} leg={leg} progress={progress} follow padding={{ top: 200, bottom: 300, left: 40, right: 40 }} recenterClassName="bottom-[284px] left-1/2 -translate-x-1/2" />
      </div>

      {/* Next turn, readable at a glance. */}
      <div data-dark-surface className="absolute inset-x-3 top-3 flex items-center gap-3 rounded-2xl bg-teal-deep p-4 text-white shadow-raised">
        {arriving ? <MapPin className="size-10 shrink-0 text-yellow" /> : <turn.Icon className="size-10 shrink-0 text-yellow" strokeWidth={2.5} />}
        <div className="min-w-0 flex-1">
          {!arriving && <div className="nums text-2xl font-bold leading-none tracking-tight">{turn.dist}</div>}
          <div className="mt-1 truncate text-[15px] font-semibold">{arriving ? `Arriving at ${stop.name}` : turn.text}</div>
        </div>
      </div>

      <button onClick={a.back} aria-label="Exit navigation" className="absolute right-4 top-[104px] grid size-11 place-items-center rounded-full border border-control bg-card shadow-card">
        <X className="size-5" />
      </button>

      {/* Live share pill */}
      <div className="absolute left-4 top-[108px] flex items-center gap-2 rounded-full bg-card px-3 py-2 text-2xs font-semibold shadow-card">
        <span className="relative grid size-2 place-items-center">
          <span className="anim-pulse absolute size-2 rounded-full bg-success" />
          <span className="relative size-2 rounded-full bg-success" />
        </span>
        {t("Location shared with Dispatch")}
      </div>

      {/* Bottom panel */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-4 pb-8 pt-4 shadow-raised">
        {/* Glance: how long (big, coloured) and where to, side by side. Everything else is one quiet line below. */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={cn("nums text-[34px] font-bold leading-none tracking-tight", late ? "text-danger" : "text-success")}>
              {minsLeft} min
            </div>
            <div className="nums mt-1.5 text-[13px] text-muted-foreground">
              {late ? <span className="font-semibold text-danger">{t("Running late")} · </span> : null}
              {fmtTime(eta)} · {milesLeft} mi
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="truncate text-[17px] font-semibold leading-tight">{stop.name}</div>
          </div>
        </div>

        {/* Review Oct 14 2026: work type + parking stay visible while driving; the rest is in Instructions. */}
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <WorkTags stop={stop} variant="plain" />
          {stop.parking && (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Car className="size-4 shrink-0 text-teal-deep/70" />
              <span className="truncate">{stop.parking}</span>
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => a.openSheet({ name: "instructions", id })} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-control text-sm font-semibold">
            <MessageSquare className="size-4" /> {t("Instructions")}
          </button>
          <button onClick={() => a.openSheet({ name: "contact", id })} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-control text-sm font-semibold">
            <Phone className="size-4" /> {t("Call")}
          </button>
        </div>

        <div className="mt-3">
          <SlideToConfirm label={arriving ? t("I'm here") : t("Slide when you arrive")} tone={arriving ? "coral" : "teal"} onConfirm={() => a.arrive(id, stop.driveMins)} />
        </div>
      </div>
    </div>
  );
}
