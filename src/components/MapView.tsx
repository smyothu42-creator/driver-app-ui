import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed } from "lucide-react";
import type { LngLat } from "../data/geo";
import { cn } from "./ui";

export type Pin = { id: string; at: LngLat; label: string; title?: string; state: "done" | "active" | "todo" | "kitchen" };

/* ------------------------------------------------------------------
 * Real, draggable map (MapLibre GL + OpenFreeMap vector tiles, no API key).
 * The layout borrows from Uber Eats (quiet base map, one bold route line,
 * round pins, a name pill on the selected stop, recenter after panning);
 * the colors are SFK's: cream land, teal water, teal-deep route, coral for "next".
 * Production would swap the tile source for Mapbox / Google; the props stay the same.
 * ------------------------------------------------------------------ */

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type Palette = typeof SFK;
const SFK = {
  land: "#F3EEDF",
  landuse: "#EFE8D5",
  park: "#DCEBCF",
  water: "#CFE5E3",
  building: "#E8E0CA",
  casing: "#E3DBC5",
  road: "#FFFFFF",
  highway: "#FBF6CB", // SFK yellow wash, so freeways read without shouting
  rail: "#D9D1BB",
  label: "#8A8677",
  waterLabel: "#5E8F8C",
  route: "#004045",
  routeFaint: "#007078",
  routeDone: "#B9B29E",
  routeCasing: "#FFFFFF",
};
/** Google Maps navigation look (Oct 21 2026): turn-by-turn hands off to Google Maps, so its screen looks like it. */
const GOOGLE: Palette = {
  land: "#F1F3F4",
  landuse: "#ECEFF1",
  park: "#CDEBD3",
  water: "#AADAFF",
  building: "#E3E5E8",
  casing: "#D5D8DC",
  road: "#FFFFFF",
  highway: "#FDE293",
  rail: "#D2D5D9",
  label: "#5F6368",
  waterLabel: "#3C7BC6",
  route: "#4C8DF6",
  routeFaint: "#4C8DF6",
  routeDone: "#BDC1C6",
  routeCasing: "#1A5FCC",
};

/** Recolor the stock Positron style into the SFK palette. Layer ids are Positron's. */
function theme(style: StyleSpecification, C: Palette): StyleSpecification {
  const layers = style.layers
    .filter((l) => !l.id.startsWith("boundary") && !l.id.includes("shield"))
    .map((l) => {
      const paint = { ...(l as { paint?: Record<string, unknown> }).paint };
      const id = l.id;
      if (l.type === "background") paint["background-color"] = C.land;
      else if (id === "park" || id === "landcover_wood") paint["fill-color"] = C.park;
      else if (id === "water") paint["fill-color"] = C.water;
      else if (id === "waterway") paint["line-color"] = C.water;
      else if (id.startsWith("landuse")) paint["fill-color"] = C.landuse;
      else if (id === "building") {
        paint["fill-color"] = C.building;
        paint["fill-outline-color"] = C.casing;
      } else if (l.type === "line" && id.includes("casing")) paint["line-color"] = C.casing;
      else if (l.type === "line" && id.includes("motorway")) paint["line-color"] = C.highway;
      else if (l.type === "line" && id.startsWith("railway")) paint["line-color"] = C.rail;
      else if (l.type === "line" && (id.startsWith("highway") || id.startsWith("road"))) paint["line-color"] = C.road;
      else if (l.type === "symbol") {
        paint["text-color"] = id.startsWith("water") ? C.waterLabel : C.label;
        paint["text-halo-color"] = C.land;
      }
      return { ...l, paint } as typeof l;
    });
  return { ...style, layers };
}

// Offline / blocked tiles: still show the route and pins on plain cream.
const fallback = (C: Palette): StyleSpecification => ({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": C.land } }] });

const stylePromises: Partial<Record<"sfk" | "google", Promise<StyleSpecification>>> = {};
const loadStyle = (look: "sfk" | "google") => {
  const P = look === "google" ? GOOGLE : SFK;
  return (stylePromises[look] ??= fetch(STYLE_URL)
    .then((r) => r.json())
    .then((s) => theme(s, P))
    .catch(() => fallback(P)));
};

/* ---------------- geometry helpers ---------------- */

const toRad = (d: number) => (d * Math.PI) / 180;
function dist(a: LngLat, b: LngLat) {
  // Equirectangular is plenty accurate across a few city blocks.
  const x = toRad(b[0] - a[0]) * Math.cos(toRad((a[1] + b[1]) / 2));
  const y = toRad(b[1] - a[1]);
  return Math.hypot(x, y);
}
function bearing(a: LngLat, b: LngLat) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Point `t` (0–1) of the way along a polyline, its heading, and the part still to drive. */
export function along(line: LngLat[], t: number) {
  const seg = line.slice(1).map((p, i) => dist(line[i], p));
  const total = seg.reduce((n, d) => n + d, 0);
  let left = total * Math.min(1, Math.max(0, t));
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, left / seg[i]) : 0;
      const a = line[i];
      const b = line[i + 1];
      const at: LngLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      return { at, heading: bearing(a, b), rest: [at, ...line.slice(i + 1)] };
    }
    left -= seg[i];
  }
  return { at: line[0], heading: 0, rest: line };
}

const lines = (legs: { coords: LngLat[]; done?: boolean }[]) => ({
  type: "FeatureCollection" as const,
  features: legs.map((l) => ({ type: "Feature" as const, properties: { done: !!l.done }, geometry: { type: "LineString" as const, coordinates: l.coords } })),
});

/* ---------------- markers (plain DOM, styled with the same Tailwind tokens) ---------------- */

function pinEl(p: Pin, selected: boolean, onClick?: (id: string) => void, google = false) {
  const el = document.createElement("button");
  if (google) {
    // Google's red destination pin.
    el.tabIndex = -1;
    el.className = "pointer-events-none";
    el.innerHTML = `<svg viewBox="0 0 24 34" width="30" height="42" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 34 12 34s12-13.5 12-22.3C24 5.2 18.6 0 12 0Z" fill="#EA4335" stroke="#B31412" stroke-width="1"/><circle cx="12" cy="11.5" r="4.3" fill="#7F1210"/></svg>`;
    return el;
  }
  el.setAttribute("aria-label", p.title ? `Stop ${p.label}: ${p.title}` : p.label);
  if (onClick) el.addEventListener("click", (e) => (e.stopPropagation(), onClick(p.id)));
  else el.tabIndex = -1;

  if (p.state === "kitchen") {
    el.className = "grid size-9 place-items-center rounded-xl border-[2.5px] border-teal-deep bg-yellow text-xs font-extrabold text-teal-deep shadow-[0_2px_8px_rgba(0,64,69,.3)]";
    el.textContent = "SF";
    return el;
  }
  const fill = { done: "bg-success text-white", active: "bg-coral text-white", todo: "bg-card text-teal-deep" }[p.state];
  const dot = `<span class="nums grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${fill}">${p.state === "done" ? "✓" : p.label}</span>`;
  if (selected && p.title) {
    // Uber-style name pill on the selected stop, with a small pointer underneath.
    el.className = "anim-fade relative flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-[13px] font-semibold text-foreground shadow-[0_4px_14px_rgba(0,64,69,.28)] ring-2 ring-teal-deep";
    el.innerHTML = `${dot}<span class="max-w-[140px] truncate">${p.title}</span><span class="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 bg-card ring-2 ring-teal-deep [clip-path:polygon(100%_0,100%_100%,0_100%)]"></span>`;
  } else {
    el.className = cn("grid place-items-center rounded-full p-[3px] shadow-[0_2px_8px_rgba(0,64,69,.3)]", p.state === "todo" ? "bg-teal-deep" : "bg-white");
    el.innerHTML = dot;
  }
  return el;
}

function driverEl(nav: boolean, google = false) {
  const el = document.createElement("div");
  el.className = "pointer-events-none relative grid size-6 place-items-center";
  if (google) {
    // Google's blue navigation chevron with a white edge.
    el.innerHTML = `<svg viewBox="0 0 24 24" class="relative size-10" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M12 2.5 20.5 21 12 16.8 3.5 21Z" fill="#4285F4" stroke="white" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
    return el;
  }
  el.innerHTML = nav
    ? // Heading arrow while navigating; rotated via the marker's rotation.
      `<span class="anim-pulse absolute size-6 rounded-full bg-teal/40"></span><svg viewBox="0 0 24 24" class="relative size-8 drop-shadow-[0_2px_4px_rgba(0,64,69,.45)]"><path d="M12 2 20 21 12 16.5 4 21Z" fill="#007078" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`
    : `<span class="anim-pulse absolute size-6 rounded-full bg-teal/40"></span><span class="relative size-[18px] rounded-full border-[3px] border-white bg-teal shadow-[0_1px_4px_rgba(0,64,69,.4)]"></span>`;
  return el;
}

/* ---------------- component ---------------- */

type Padding = { top: number; bottom: number; left: number; right: number };

export function MapView({
  pins,
  route,
  leg,
  progress = 0,
  driverAt,
  showDriver = true,
  focus,
  follow = false,
  selectedId,
  onPinClick,
  padding = { top: 60, bottom: 60, left: 40, right: 40 },
  recenterClassName = "bottom-4 right-4",
  className,
  look = "sfk",
}: {
  pins: Pin[];
  /** Whole day's legs in order; finished legs go gray. */
  route?: { coords: LngLat[]; done?: boolean }[];
  /** The leg being driven now (bold line, driver moves along it by `progress`). */
  leg?: LngLat[];
  progress?: number;
  driverAt?: LngLat;
  showDriver?: boolean;
  /** Static, non-draggable thumbnail centred here (stop details header). */
  focus?: LngLat;
  /** Turn-by-turn camera: follows the driver, tilted and rotated to the heading. */
  follow?: boolean;
  selectedId?: string;
  onPinClick?: (id: string) => void;
  /** Space taken by overlays, so fitting and following keep things visible. */
  padding?: Padding;
  recenterClassName?: string;
  className?: string;
  /** "google": Google Maps colours, blue route, blue chevron and red destination pin. */
  look?: "sfk" | "google";
}) {
  const google = look === "google";
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const driver = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  // True once the user pans/zooms by hand: stop auto-camera and offer Recenter (as Uber does).
  const [userMoved, setUserMoved] = useState(false);

  const interactive = !focus;
  const nav = leg ? along(leg, progress) : null;
  const driverPos = nav?.at ?? driverAt;

  /* create once */
  useEffect(() => {
    let dead = false;
    const C = google ? GOOGLE : SFK;
    loadStyle(look).then((style) => {
      if (dead || !box.current) return;
      const m = new maplibregl.Map({
        container: box.current,
        style,
        center: focus ?? pins[0]?.at ?? [-122.405, 37.785],
        zoom: focus ? 15.2 : 13,
        interactive,
        attributionControl: false,
        dragRotate: false, // keep north-up while browsing; navigation rotates programmatically
        pitchWithRotate: false,
        fadeDuration: 0,
      });
      m.touchZoomRotate.disableRotation();
      // Map credit hidden in the prototype UI (Oct 15 2026). The data licence (OpenStreetMap ODbL, OpenMapTiles) still
      // requires visible attribution in the real app, e.g. on an About / Legal screen. Credit is listed in the README.
      m.on("movestart", (e: unknown) => (e as { originalEvent?: Event }).originalEvent && setUserMoved(true));
      m.on("load", () => {
        m.addSource("route", { type: "geojson", data: lines([]) });
        m.addSource("leg", { type: "geojson", data: lines([]) });
        m.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["case", ["get", "done"], C.routeDone, C.routeFaint],
            "line-width": 4,
            "line-opacity": ["case", ["get", "done"], 0.7, 0.55],
            "line-dasharray": [0.6, 1.8],
          },
        });
        m.addLayer({ id: "leg-casing", type: "line", source: "leg", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.routeCasing, "line-width": google ? 13 : 10 } });
        m.addLayer({ id: "leg", type: "line", source: "leg", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.route, "line-width": google ? 9 : 6 } });
        box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        setReady(true);
      });
      map.current = m;
    });
    return () => {
      dead = true;
      // Stop any in-flight camera animation first, or MapLibre can render one more frame after remove().
      map.current?.stop();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* data: route + leg */
  const routeKey = JSON.stringify(route?.map((r) => [r.coords.length, r.done]));
  useEffect(() => {
    if (!ready) return;
    (map.current!.getSource("route") as GeoJSONSource).setData(lines(route ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routeKey]);

  useEffect(() => {
    if (!ready) return;
    // Only the part still ahead is drawn, so the line "shrinks" behind the driver.
    (map.current!.getSource("leg") as GeoJSONSource).setData(lines(nav ? [{ coords: nav.rest }] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, leg, progress]);

  /* pins */
  const pinsKey = JSON.stringify(pins) + selectedId;
  useEffect(() => {
    if (!ready) return;
    markers.current.forEach((mk) => mk.remove());
    // Selected pin is added last so it sits above the others.
    const ordered = [...pins].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    markers.current = ordered.map((p) =>
      new maplibregl.Marker({ element: pinEl(p, p.id === selectedId, interactive ? onPinClick : undefined, google), anchor: google || (p.id === selectedId && p.title) ? "bottom" : "center", offset: p.id === selectedId && p.title ? [0, -6] : [0, 0] })
        .setLngLat(p.at)
        .addTo(map.current!),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinsKey]);

  /* driver marker */
  useEffect(() => {
    if (!ready) return;
    driver.current?.remove();
    driver.current = showDriver && driverPos ? new maplibregl.Marker({ element: driverEl(!!follow, google), rotationAlignment: "map" }).setLngLat(driverPos).addTo(map.current!) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, showDriver, follow]);

  useEffect(() => {
    if (!driver.current || !driverPos) return;
    driver.current.setLngLat(driverPos);
    if (follow && nav) driver.current.setRotation(nav.heading);
  });

  /* camera */
  const fitAll = (animate: boolean) => {
    const m = map.current;
    if (!m) return;
    if (focus) return m.jumpTo({ center: focus, zoom: 15.2, padding }); // padding lets a card overlap the map without hiding the pin
    const pts = [...pins.map((p) => p.at), ...(driverPos ? [driverPos] : []), ...(leg ?? [])];
    if (!pts.length) return;
    const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    m.fitBounds(b, { padding, maxZoom: 15.5, duration: animate ? 600 : 0, bearing: 0, pitch: 0 });
  };

  useEffect(() => {
    if (ready && !follow) fitAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Fly to the selected stop (carousel swipe or pin tap), unless the user is exploring by hand.
  const lastSelected = useRef(selectedId);
  useEffect(() => {
    if (!ready || lastSelected.current === selectedId) return; // first load shows the overview instead
    lastSelected.current = selectedId;
    const p = pins.find((x) => x.id === selectedId);
    if (p && !follow && !focus) map.current!.easeTo({ center: p.at, duration: 500, padding });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  // Turn-by-turn camera: driver low on screen, map tilted and turned to the heading.
  useEffect(() => {
    if (!ready || !follow || !nav || userMoved) return;
    map.current!.easeTo({ center: nav.at, zoom: 16.3, pitch: 55, bearing: nav.heading, padding, duration: 300, easing: (t: number) => t });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, follow, progress, userMoved]);

  return (
    <div
      className={cn("sfk-map relative h-full w-full overflow-hidden bg-[#F3EEDF]", className)}
      style={{ "--map-attrib-bottom": `${focus ? 0 : Math.max(0, padding.bottom - 24)}px` } as React.CSSProperties}
    >
      <div ref={box} className="absolute inset-0" aria-label="Route map" role="region" />
      {interactive && userMoved && (
        <button
          onClick={() => {
            setUserMoved(false);
            if (!follow) fitAll(true);
          }}
          className={cn("anim-fade absolute z-10 flex h-11 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-semibold text-teal-deep shadow-raised", recenterClassName)}
        >
          <LocateFixed className="size-4" /> Recenter
        </button>
      )}
    </div>
  );
}
