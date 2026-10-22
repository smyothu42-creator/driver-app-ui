import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Flashlight, FlashlightOff, Lock, Phone, RotateCw, ScanLine, Truck, X } from "lucide-react";
import { findStop, slipsToday, useApp } from "../store";
import { DISPATCH, DRIVER, fmtTime, fmtWindow, runOf, workOf, type Stop } from "../data/route";
import { Button, cn } from "../components/ui";

/* ------------------------------------------------------------------
 * #9 Scan a packing slip at the kitchen (Oct 20 2026): any slip the driver delivers today, in any order.
 * The sheet lists those orders; whichever slip is scanned opens that order (PackageScreen) to check.
 * A slip that isn't on the driver's route stops here: "This isn't on your route. Discuss with dispatch."
 * Laid out like a native code scanner (Amazon Flex, DoorDash, iOS Camera): full-bleed camera,
 * dimmed frame around a clear scan window, and a bottom sheet.
 * ------------------------------------------------------------------ */
const WINDOW = 250; // px, scan window size
const WINDOW_TOP = "38%"; // middle of the screen above the bottom sheet
/** Prototype stand-in for a slip from another driver's route, to show the check. */
const OTHER_ROUTE_SLIP = { orderNo: "ORD-3188", name: "Bayside Dental", seq: 2 };

export function ScanScreen({ id }: { id?: string }) {
  const { s, a } = useApp();
  const slips = slipsToday(s);
  const now = slips.filter((x) => runOf(x) === s.run);
  // Opened from an order: the camera is reading that order's slip. Otherwise the next one not scanned yet.
  const target = slips.find((x) => x.id === id) ?? now.find((x) => !s.scanned[x.id]);
  // Same word as everywhere else at the kitchen: an order is "loaded" once every meal in it is ticked.
  const loadedNow = now.filter((x) => x.bags.every((b) => s.bagChecks[b.id])).length;
  // A slip already scanned never needs the capture button again.
  const next = target && !s.scanned[target.id] ? target : now.find((x) => !s.scanned[x.id]);
  const [torch, setTorch] = useState(false);
  const [wrong, setWrong] = useState(false);

  // Prototype: tapping the camera or an order stands in for the camera reading that slip's QR.
  const scan = (x: Stop) => {
    navigator.vibrate?.(40); // haptic confirm on real phones
    a.scanSlip(x.id);
    a.jump((p) => ({ stack: [...p.stack.filter((y) => y.name !== "scan" && y.name !== "package"), { name: "package" as const, id: x.id }] }));
    a.popup("Slip scanned", `${x.orderNo} · ${x.name}`);
  };
  // Not on this driver's route: no way forward from here except dispatch.
  const scanOther = () => {
    navigator.vibrate?.([60, 80, 60]);
    setWrong(true);
  };

  const shownSlip: Stop | undefined = wrong ? { ...(slips[0] ?? findStop(s, "s1")), ...OTHER_ROUTE_SLIP } : (target ?? slips[0]);

  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      {/* Camera feed: the slip lying on a steel pass counter at the kitchen dock. */}
      <button onClick={() => !wrong && next && scan(next)} aria-label="Simulate scanning a packing slip" className="absolute inset-0 block cursor-default">
        {shownSlip && <CameraFeed slip={shownSlip} torch={torch} />}
      </button>

      {/* Dim everything outside the scan window. */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: WINDOW, height: WINDOW, top: WINDOW_TOP }}>
        <div className="absolute inset-0 rounded-[28px] shadow-[0_0_0_2000px_rgba(0,0,0,0.58)]" />
        <Corners locked={false} wrong={wrong} />
        {!wrong && <div className="anim-scanline absolute inset-x-5 top-3 h-0.5 rounded-full bg-yellow shadow-[0_0_14px_3px_rgba(245,229,22,0.55)]" />}
      </div>

      {/* Top bar over the camera */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-2">
        <button aria-label="Close scanner" onClick={a.back} className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-md">
          <X className="size-5" />
        </button>
        <span className="rounded-full bg-black/45 px-3.5 py-1.5 text-[15px] font-semibold backdrop-blur-md">Scan packing slip</span>
        <button aria-label={torch ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torch} onClick={() => setTorch((v) => !v)} className={cn("grid size-11 place-items-center rounded-full backdrop-blur-md", torch ? "bg-white text-black" : "bg-black/45")}>
          {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
        </button>
      </div>

      {/* Hint just under the window */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center px-6" style={{ top: `calc(${WINDOW_TOP} + ${WINDOW / 2 + 14}px)` }}>
        <span className={cn("rounded-full px-4 py-2 text-[15px] font-semibold backdrop-blur-md", wrong ? "bg-danger text-white" : "bg-black/55")}>{wrong ? "Not on your route" : "Fit the QR code inside the frame"}</span>
      </div>

      {/* Bottom sheet: today's orders to scan, or the "not on your route" stop. */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-card px-5 pb-8 pt-3 text-foreground shadow-raised">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
        {wrong ? (
          <div role="alert">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-danger-bg text-danger">
                <AlertTriangle className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-bold leading-tight tracking-tight">This isn't on your route</span>
                <span className="nums mt-1 block text-[15px] leading-snug text-muted-foreground">Slip {OTHER_ROUTE_SLIP.orderNo}. Discuss with dispatch before you load it.</span>
              </span>
            </div>
            <Button size="lg" className="mt-5 w-full" onClick={() => a.toast(`Calling ${DISPATCH.name}…`)}>
              <Phone /> Call dispatch
            </Button>
            <Button size="lg" variant="outline" className="mt-2 w-full" onClick={() => setWrong(false)}>
              <ScanLine /> Scan another slip
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold tracking-tight">Today's packing slips</span>
              <span className={cn("nums shrink-0 text-[13px] font-semibold", now.length && loadedNow === now.length ? "text-success" : "text-muted-foreground")}>
                {loadedNow} of {now.length} loaded
              </span>
            </div>
            {next ? (
              // Prototype: stands in for the camera reading the slip's QR (tapping the camera does the same).
              <Button size="lg" className="mt-4 w-full" onClick={() => scan(next)}>
                <ScanLine /> Capture QR code
              </Button>
            ) : (
              now.length > 0 && (
                <Button size="lg" className="mt-4 w-full" onClick={a.openLoad}>
                  <ClipboardList /> Check what's inside
                </Button>
              )
            )}
            {/* Prototype only: shows what happens when a slip from someone else's route is scanned. */}
            <button onClick={scanOther} className="mt-3 w-full rounded-xl border border-dashed border-control py-2 text-center text-[13px] font-semibold text-muted-foreground">
              Demo: scan a slip that's not on your route
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Corner brackets of the scan window; they turn green when a code is read. */
function Corners({ locked, wrong }: { locked: boolean; wrong?: boolean }) {
  const c = cn("absolute size-12 border-[5px] transition-colors duration-200", wrong ? "border-danger" : locked ? "border-success" : "border-white");
  return (
    <div className={cn("absolute inset-0 transition-transform duration-200", locked && "scale-[0.94]")}>
      <span className={cn(c, "left-0 top-0 rounded-tl-[28px] border-b-0 border-r-0")} />
      <span className={cn(c, "right-0 top-0 rounded-tr-[28px] border-b-0 border-l-0")} />
      <span className={cn(c, "bottom-0 left-0 rounded-bl-[28px] border-r-0 border-t-0")} />
      <span className={cn(c, "bottom-0 right-0 rounded-br-[28px] border-l-0 border-t-0")} />
    </div>
  );
}

/** Stand-in for the live camera: brushed steel counter, kraft bags at the edges, the slip in perspective. */
function CameraFeed({ slip, torch }: { slip: Stop; torch: boolean }) {
  const kraft = "repeating-linear-gradient(90deg, rgba(90,55,20,0.05) 0 1px, transparent 1px 6px)"; // corrugation ribs
  return (
    <div className={cn("absolute inset-0 transition-[filter] duration-300", torch ? "brightness-125" : "brightness-[0.85]")}>
      {/* Steel pass counter at the kitchen dock */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(92deg, rgba(255,255,255,0.035) 0 2px, rgba(0,0,0,0.04) 2px 5px), linear-gradient(170deg, #8d9498 0%, #6c7377 45%, #4b5155 100%)",
        }}
      />
      {/* Around it on the counter: another catering box and stacks of meal containers, slightly soft (depth of field) */}
      <div className="absolute -right-24 -top-10 h-56 w-48 rotate-[14deg] rounded-md blur-[4px]" style={{ background: `${kraft}, linear-gradient(200deg, #c99f6b, #a5794a)` }} />
      <MealBox className="-left-14 top-[6%] rotate-[-12deg] blur-[2.5px]" />
      <MealBox className="-left-10 top-[9%] rotate-[-8deg] blur-[2.5px]" />
      <MealBox className="-right-16 bottom-[30%] rotate-[18deg] blur-[3px]" />

      {/* The catering box, seen from above at a slight tilt, with the packing slip label stuck on its lid. QR centred on the scan window. */}
      <div className="absolute left-1/2" style={{ top: WINDOW_TOP, transform: "translate(-50%, -50%) perspective(900px) rotateX(14deg) rotateZ(-5deg)" }}>
        <div className="relative h-[380px] w-[320px]">
          {/* front face of the box, in shade */}
          <div className="absolute inset-x-0 top-full h-[52px] rounded-b-[6px] shadow-[0_26px_40px_rgba(0,0,0,0.6)]" style={{ background: `${kraft}, linear-gradient(180deg, #8f6639, #7a5530)` }}>
            <div className="pt-3 text-center text-[13px] font-bold tracking-[0.3em] text-[rgba(40,24,10,0.55)]">SUPERFINE KITCHEN</div>
          </div>
          {/* lid */}
          <div className="absolute inset-0 rounded-t-[6px]" style={{ background: `${kraft}, linear-gradient(165deg, #d6b07e 0%, #c69d69 50%, #b48852 100%)` }}>
            <div className="absolute inset-0 rounded-t-[6px] shadow-[inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-2px_0_rgba(60,35,10,0.35),inset_8px_0_12px_rgba(60,35,10,0.1)]" />
            {/* lid seam where the two flaps meet */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-[rgba(70,40,15,0.4)]" />
            {/* this-side-up arrows */}
            <div className="absolute left-4 top-4 flex gap-1 text-[rgba(60,38,18,0.45)]" aria-hidden>
              {[0, 1].map((i) => (
                <svg key={i} width="13" height="17" viewBox="0 0 16 20" fill="currentColor">
                  <path d="M8 0 L16 8 H11 V20 H5 V8 H0 Z" />
                </svg>
              ))}
            </div>
            {/* packing tape over the seam */}
            <div className="absolute inset-y-0 left-1/2 w-[64px] -translate-x-1/2 bg-[linear-gradient(90deg,rgba(255,240,210,0.2),rgba(255,248,230,0.36)_40%,rgba(255,240,210,0.18))] shadow-[inset_1px_0_0_rgba(255,255,255,0.3),inset_-1px_0_0_rgba(80,50,20,0.18)]" />
            {/* the label */}
            <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 rotate-[1.5deg]">
              <PackingSlip stop={slip} />
            </div>
          </div>
        </div>
      </div>

      {/* Overhead light falloff */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 27%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  );
}

/** A compostable meal container (two stacked), as seen around the catering box. */
function MealBox({ className }: { className?: string }) {
  return (
    <div className={cn("absolute h-28 w-40", className)} aria-hidden>
      <div className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[16px] bg-[#cfccc0]" />
      <div className="absolute inset-0 rounded-[16px] bg-[#efece3] shadow-[inset_0_-6px_10px_rgba(0,0,0,0.08)]">
        <div className="absolute inset-3 rounded-[11px] border border-black/10" />
        <div className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f5f63]/80" />
      </div>
    </div>
  );
}

/** The packing slip as a printed thermal label stuck on the box. */
function PackingSlip({ stop }: { stop: Stop }) {
  return (
    <div className="relative w-[250px] rounded-[6px] bg-[#f7f5ef] px-4 pb-3 pt-3 text-[#1d1f1e] shadow-[0_2px_3px_rgba(0,0,0,0.25),0_6px_12px_rgba(60,35,10,0.18)]" style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
      {/* soft glare from the overhead light */}
      <div className="pointer-events-none absolute inset-0 rounded-[6px] bg-[linear-gradient(125deg,rgba(255,255,255,0.35),transparent_35%)]" />
      <div className="flex items-start justify-between border-b border-dashed border-black/30 pb-1.5">
        <div>
          <div className="text-[10px] font-bold tracking-wide">SUPERFINE KITCHEN</div>
          <div className="text-[9px] opacity-70">PACKING SLIP · DOCK B</div>
        </div>
        <div className="nums text-right text-[10px] font-bold">STOP {stop.seq}</div>
      </div>
      <div className="nums mt-1.5 text-[13px] font-bold">{stop.orderNo}</div>
      <div className="truncate text-[11px]">{stop.name}</div>
      <div className="my-2 flex justify-center">
        <QrMark seed={stop.orderNo} size={150} />
      </div>
      <ul className="space-y-0.5 border-t border-dashed border-black/30 pt-1.5 text-[9px] opacity-80">
        <li className="flex justify-between gap-2">
          <span className="truncate">{stop.orderType.toUpperCase()}</span>
          <span>{workOf(stop).filter((w) => w !== "reusables").map((w) => w.toUpperCase()).join(" + ")}</span>
        </li>
        <li className="truncate">WINDOW {fmtWindow(stop.windowStart, stop.windowEnd)}</li>
      </ul>
    </div>
  );
}

/** A believable QR code: three finder squares, timing rows and seeded modules. Not scannable. */
function QrMark({ seed, size }: { seed: string; size: number }) {
  const N = 25;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
    const finder = (x: number, y: number) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
    const out: [number, number][] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (finder(x, y)) continue;
        const on = y === 6 || x === 6 ? (x + y) % 2 === 0 : rand() > 0.52;
        if (on) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const F = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x} y={y} width={7} height={7} fill="#111" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#f7f5ef" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${N + 2} ${N + 2}`} shapeRendering="crispEdges" aria-hidden>
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />
      ))}
      <F x={0} y={0} />
      <F x={N - 7} y={0} />
      <F x={0} y={N - 7} />
    </svg>
  );
}

/* ------------------------------------------------------------------
 * #10 The packing-slip QR still opens the public delivery page (#57: progress bar + ETA),
 * plus an "Are you a driver?" button into the app for arrival and drop.
 * Shown as a mobile browser so it's clear this is the web page, not the app.
 * ------------------------------------------------------------------ */
const STEPS = ["Confirmed", "Being prepared", "Out for delivery", "Arriving", "Delivered"];

export function PublicPage({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const step = st.status === "delivered" ? 4 : st.status === "arrived" || st.status === "en_route" ? 3 : s.pickupDone ? 2 : 1;
  const eta = s.clock + stop.driveMins;
  const canDrive = st.status !== "delivered" && st.status !== "cancelled";

  const imDriver = () => {
    // Signed out: sign in first, then land on this stop (review: the QR link helps drivers find and sign in to the app).
    if (!s.signedIn) {
      a.jump(() => ({ afterSignIn: { name: "stop", id }, stack: [{ name: "signin" }] }));
      return;
    }
    // Opens the app on this stop. If they were driving to it, this counts as arriving.
    if (s.pickupDone && (st.status === "queued" || st.status === "en_route")) a.arrive(id, st.status === "en_route" ? 0 : stop.driveMins);
    else a.jump(() => ({ stack: [{ name: "tabs" }, { name: "stop", id }] }));
  };

  return (
    <div className="flex h-full flex-col bg-[#F2F2F7]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-black/10 bg-[#F9F9F9] px-3 py-2">
        <button onClick={a.back} aria-label="Close browser" className="grid size-9 place-items-center rounded-full text-[#007AFF]">
          <X className="size-5" />
        </button>
        <div className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-black/5 text-[13px] text-black/70">
          <Lock className="size-3" /> superfinekitchen.com/d/{stop.orderNo.toLowerCase()}
        </div>
        <RotateCw className="size-4 text-[#007AFF]" />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="text-2xs font-bold uppercase tracking-wide text-teal">Superfine Kitchen</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{st.status === "delivered" ? "Delivered" : st.status === "cancelled" ? "Cancelled" : step >= 3 ? "Arriving soon" : step === 2 ? "Out for delivery" : "Being prepared"}</h1>
          <p className="nums text-[13px] text-muted-foreground">
            {stop.name} · {stop.orderNo} · window {fmtWindow(stop.windowStart, stop.windowEnd)}
          </p>
          <ol className="mt-4 flex gap-1" aria-label="Delivery progress">
            {STEPS.map((l, i) => (
              <li key={l} className="flex flex-1 flex-col gap-1">
                <span className={cn("h-1.5 rounded-full", i <= step ? "bg-teal" : "bg-muted")} />
                <span className={cn("text-2xs font-semibold leading-tight", i <= step ? "text-teal-deep" : "text-muted-foreground")}>{l}</span>
              </li>
            ))}
          </ol>
          {st.status !== "delivered" && step >= 2 && (
            <div className="mt-4 rounded-xl bg-teal-wash p-3">
              <div className="text-2xs font-semibold text-muted-foreground">Estimated arrival</div>
              <div className="nums text-2xl font-bold text-teal-deep">{fmtTime(eta)}</div>
            </div>
          )}
          {st.status === "delivered" && (
            <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-success">
              <CheckCircle2 className="size-4" /> Delivered {fmtTime(st.deliveredAt!)}
            </p>
          )}
        </div>
      </div>

      {canDrive && (
        <div className="border-t border-black/10 bg-card px-4 pb-8 pt-3">
          <button onClick={imDriver} data-dark-surface className="flex h-16 w-full items-center gap-3 rounded-2xl bg-teal-deep px-4 text-left text-white active:scale-[0.99]">
            <Truck className="size-6 text-yellow" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Are you a driver?</span>
              <span className="block text-2xs text-white/70">{s.signedIn ? `Open in the SFK Driver app · signed in as ${DRIVER.first}` : "Sign in to the SFK Driver app to mark arrival and drop"}</span>
            </span>
            <ChevronRight className="size-5 text-white/70" />
          </button>
          {!s.signedIn && (
            <button onClick={() => a.toast("Opens the App Store / Google Play link for SFK drivers")} className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-teal">
              Don't have the app? Get it here
            </button>
          )}
        </div>
      )}
    </div>
  );
}
