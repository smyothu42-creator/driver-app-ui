import { Fragment, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, CheckCircle2, Package, Clock, Flashlight, FlashlightOff, Plus, Recycle, X } from "lucide-react";
import { findStop, pickupsAt, useApp, useT, type State } from "../store";
import type { Stop } from "../data/route";
import { SETTINGS, fmtTime } from "../data/route";
import { ActionBar, Button, cn, SlideToConfirm, TopBar } from "../components/ui";
import { isOn } from "../data/sprints";
import { JobList, stopJobs } from "./StopDetail";

/**
 * Oct 27 2026: the delivery camera. At a stop with reusables it takes two separate photos in a row, with a progress
 * bar like the stop page's: 1 Food drop-off → 2 Reusables. The step being shot is said in big type at the top, so the
 * driver can see at a glance which photo this is. After the last one it goes to Proof of delivery.
 * Opened with `kind` (from Proof's "Add another"), it takes just that photo and goes back.
 */
export function CameraScreen({ id, kind }: { id: string; kind?: PhotoKind }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const [flash, setFlash] = useState(0);
  const [torch, setTorch] = useState(false);
  const two = needsReusablesPhoto(s, stop);
  const [step, setStep] = useState<PhotoKind>(kind ?? (st.photos > 0 && two && !st.reusablePhotos ? "reusables" : "food"));
  const shots = step === "food" ? st.photos : (st.reusablePhotos ?? 0);
  const [saved, setSaved] = useState(false); // "Food photo saved" for a moment after moving on to the reusables

  const toProof = () => a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "camera"), ...(p.stack.some((x) => x.name === "proof") ? [] : [{ name: "proof" as const, id }])] }));
  const capture = () => {
    setFlash((f) => f + 1);
    if (step === "food") a.addPhoto(id);
    else a.updateStop(id, { reusablePhotos: Math.min(3, (st.reusablePhotos ?? 0) + 1) });
    window.setTimeout(() => {
      // Food first; then, at a stop with reusables still to photograph, straight on to that photo.
      if (!kind && step === "food" && two && !st.reusablePhotos) {
        setStep("reusables");
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
      } else toProof();
    }, 380);
  };

  const steps = [
    { key: "food" as const, label: "Food drop-off", Icon: Package, done: st.photos > 0 },
    { key: "reusables" as const, label: "Reusables", Icon: Recycle, done: (st.reusablePhotos ?? 0) > 0 },
  ];
  const hint =
    step === "reusables"
      ? "Just the reusables you collected, not the food"
      : stop.customerType === "individual"
        ? "Show the bag and the door number"
        : two
          ? "Just the food, where you left it"
          : "Show every bag and where you left it";

  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      {/* Full-bleed camera feed, same layout as the QR scanner. */}
      <div className="absolute inset-0">
        <ProofFeed torch={torch} scene={step === "reusables" ? "totes" : stop.customerType === "individual" ? "door" : "counter"} />
      </div>

      {/* Framing corners */}
      <div className="pointer-events-none absolute inset-x-6 bottom-[160px] top-[200px]">
        {(["left-0 top-0 rounded-tl-[22px] border-b-0 border-r-0", "right-0 top-0 rounded-tr-[22px] border-b-0 border-l-0", "bottom-0 left-0 rounded-bl-[22px] border-r-0 border-t-0", "bottom-0 right-0 rounded-br-[22px] border-l-0 border-t-0"] as const).map((c) => (
          <span key={c} className={cn("absolute size-10 border-[4px] border-white/90", c)} />
        ))}
      </div>
      {flash > 0 && <div key={flash} className="anim-flash absolute inset-0 bg-white" />}

      {/* Top: close, stop name, torch; then which photo this is, on a solid dark panel so it reads over any scene. */}
      <div className="absolute inset-x-0 top-0 bg-black/75 px-4 pb-4 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button aria-label="Close camera" onClick={a.back} className="grid size-11 place-items-center rounded-full bg-white/15">
            <X className="size-5" />
          </button>
          <span className="max-w-[60%] truncate text-[15px] font-semibold text-white/85">{stop.name}</span>
          <button aria-label={torch ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torch} onClick={() => setTorch((v) => !v)} className={cn("grid size-11 place-items-center rounded-full", torch ? "bg-white text-black" : "bg-white/15")}>
            {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
          </button>
        </div>
        {two && !kind && (
          // Same idea as the stop page's stage track: a line with each photo on it, done ones ticked, this one bright.
          <div className="mt-3 flex items-center gap-2 px-1" aria-label="Photos at this stop">
            {steps.map((x, i) => (
              <Fragment key={x.key}>
                {i > 0 && <span className={cn("h-0.5 flex-1 rounded-full", steps[0].done ? "bg-[#7fd1cc]" : "bg-white/25")} />}
                <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", x.key === step ? "text-white" : x.done ? "text-[#7fd1cc]" : "text-white/50")}>
                  <span className={cn("grid size-6 place-items-center rounded-full", x.key === step ? "bg-white text-black" : x.done ? "bg-[#7fd1cc] text-black" : "bg-white/20")}>
                    {x.done && x.key !== step ? <Check className="size-3.5" strokeWidth={3} /> : <x.Icon className="size-3.5" />}
                  </span>
                  {x.label}
                </span>
              </Fragment>
            ))}
          </div>
        )}
        <div className="mt-3 px-1">
          <div className="text-[22px] font-bold leading-tight">
            {two && !kind ? `Photo ${step === "food" ? 1 : 2} of 2 · ` : ""}
            {step === "food" ? "Food drop-off" : "Reusables"}
          </div>
          <div className="mt-0.5 text-[15px] text-white/80">{hint}</div>
        </div>
      </div>

      {saved && (
        <div className="anim-fade absolute inset-x-0 top-[216px] flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-success px-4 py-2 text-[15px] font-semibold">
            <CheckCircle2 className="size-4" /> Food photo saved
          </span>
        </div>
      )}

      {/* Shutter bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 pb-10 pt-10">
        <span className="w-16 text-[13px] font-semibold text-white/85">{shots > 0 ? `${shots}/3` : "Up to 3"}</span>
        <button aria-label={`Take ${step === "food" ? "food drop-off" : "reusables"} photo`} onClick={capture} className="grid size-[76px] place-items-center rounded-full border-4 border-white">
          <span className="size-[60px] rounded-full bg-white transition active:scale-90" />
        </button>
        <span className="w-16" />
      </div>
    </div>
  );
}

/**
 * A taken photo: the same scene as the camera (ProofFeed), drawn at phone size and scaled down to the thumbnail.
 * Each shot is framed a little differently, like real handheld photos.
 */
export function PhotoThumb({ door, shot, scene }: { door: boolean; shot: number; scene?: Scene }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frame = [{ x: 0, y: -90, r: 0 }, { x: -20, y: -105, r: -2 }, { x: 15, y: -80, r: 1.5 }][shot % 3];
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 h-[760px] w-[360px] origin-top-left" style={{ transform: `scale(${scale}) translate(${frame.x}px, ${frame.y}px) rotate(${frame.r}deg)` }}>
        <ProofFeed torch={false} scene={scene ?? (door ? "door" : "counter")} />
      </div>
    </div>
  );
}

/**
 * Camera feed stand-in, drawn to read like a phone photo: soft-focus kitchenette behind, a stone counter in
 * front, and the order on it (kraft bags with SFK labels and an insulated hot carrier) with contact shadows.
 * Individual orders show a bag at an apartment door instead.
 */
type Scene = "door" | "counter" | "totes";
function ProofFeed({ torch, scene }: { torch: boolean; scene: Scene }) {
  const door = scene === "door";
  const kraft = "repeating-linear-gradient(90deg, rgba(90,55,20,0.05) 0 1px, transparent 1px 5px)";
  const Bag = ({ className, tall }: { className: string; tall?: boolean }) => (
    <div className={cn("absolute", className)}>
      <div className={cn("relative w-[92px] rounded-[3px] shadow-[0_18px_24px_-8px_rgba(0,0,0,0.55)]", tall ? "h-[150px]" : "h-[124px]")} style={{ background: `${kraft}, linear-gradient(100deg, #b98c58 0%, #cfa673 45%, #b38452 100%)` }}>
        {/* folded, stapled top */}
        <div className="absolute inset-x-0 top-0 h-5 rounded-t-[3px] bg-[#a87b4b] shadow-[inset_0_-2px_0_rgba(60,35,10,0.25)]" />
        <div className="absolute left-1/2 top-2 h-1 w-3 -translate-x-1/2 rounded-sm bg-[#d8d8d8]" />
        {/* round SFK label */}
        <div className="absolute left-1/2 top-[44px] grid size-10 -translate-x-1/2 place-items-center rounded-full bg-[#F5E516] text-[10px] font-extrabold text-[#004045] shadow-[0_1px_2px_rgba(0,0,0,0.25)]">SFK</div>
        <div className="absolute inset-y-0 left-0 w-3 bg-[linear-gradient(90deg,rgba(0,0,0,0.18),transparent)]" />
      </div>
    </div>
  );
  return (
    <div className={cn("absolute inset-0 transition-[filter] duration-300", torch ? "brightness-125" : "brightness-[0.9]")}>
      {door ? (
        <>
          {/* hallway wall + apartment door */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #d9d4ca 0%, #cbc4b7 70%, #9d9384 70%, #8a8072 100%)" }} />
          <div className="absolute left-1/2 top-[90px] h-[440px] w-[210px] -translate-x-1/2 rounded-[3px] shadow-[inset_0_0_0_6px_#e9e4da,0_10px_30px_rgba(0,0,0,0.25)]" style={{ background: "linear-gradient(90deg, #5a4535, #6c5341 50%, #5a4535)" }}>
            <div className="absolute right-4 top-1/2 size-4 rounded-full bg-[#d4b26a] shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded bg-[#e9dfc9] px-2 py-0.5 text-[15px] font-bold tracking-wider text-[#3d2f24]">1207</div>
          </div>
          <Bag className="bottom-[170px] left-1/2 -translate-x-1/2" />
        </>
      ) : (
        <>
          {/* kitchenette: soft-focus cabinets and backsplash */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #e7e2d8 0%, #ddd6c9 55%, #cfc7b8 62%)" }} />
          <div className="absolute inset-x-[-10px] top-[40px] flex gap-2 blur-[2px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative h-[170px] flex-1 rounded-[4px] bg-[#f3efe7] shadow-[inset_0_-8px_14px_rgba(0,0,0,0.06)]">
                <span className={cn("absolute bottom-4 h-10 w-1.5 rounded-full bg-[#9b9488]", i % 2 ? "left-3" : "right-3")} />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 top-[230px] h-[150px] blur-[1.5px]" style={{ background: "repeating-linear-gradient(90deg, #e9e6df 0 46px, #dcd8cf 46px 48px), linear-gradient(#e9e6df, #e9e6df)" }} />
          {/* stone counter */}
          <div className="absolute inset-x-0 bottom-0 top-[378px]" style={{ background: "radial-gradient(ellipse at 40% 20%, rgba(255,255,255,0.35), transparent 60%), linear-gradient(180deg, #c9c4bb 0%, #b6b0a5 40%, #8e877c 100%)" }} />
          <div className="absolute inset-x-0 top-[374px] h-[6px] bg-[#e6e2da] shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
          {scene === "totes" ? (
            // Oct 27 2026: the reusables photo: empty totes stacked on the counter, lids beside them.
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="absolute left-[40px] h-[46px] w-[170px] rounded-[6px] shadow-[0_10px_16px_-6px_rgba(0,0,0,0.5)]" style={{ top: 330 - i * 40, background: "linear-gradient(180deg, #2a7b80 0%, #17585c 100%)" }}>
                  <div className="absolute inset-x-2 top-1.5 h-1 rounded-full bg-white/20" />
                  <div className="absolute bottom-2 left-3 rounded-[2px] bg-white px-1.5 text-[7px] font-bold text-[#004045]">SFK</div>
                </div>
              ))}
              <div className="absolute right-[24px] top-[340px] h-[34px] w-[110px] rounded-[5px] bg-[#1f6a6e] shadow-[0_10px_16px_-6px_rgba(0,0,0,0.5)]" />
              <div className="absolute right-[30px] top-[326px] h-[16px] w-[100px] rounded-[4px] bg-[#2a7b80]" />
            </>
          ) : (
          <>
          {/* the order on the counter */}
          <Bag className="left-[22px] top-[262px]" tall />
          <Bag className="left-[124px] top-[284px]" />
          {/* insulated hot carrier */}
          <div className="absolute right-[18px] top-[300px] h-[112px] w-[120px] rounded-[10px] shadow-[0_18px_24px_-8px_rgba(0,0,0,0.6)]" style={{ background: "linear-gradient(160deg, #1f5c60 0%, #0f4448 60%, #0a3538 100%)" }}>
            <div className="absolute -top-5 left-1/2 h-7 w-16 -translate-x-1/2 rounded-t-full border-[5px] border-b-0 border-[#0c3a3d]" />
            <div className="absolute inset-x-3 top-3 h-px bg-white/15" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-[3px] bg-white px-2 py-1 text-[8px] font-bold leading-tight text-[#004045]">SFK · HOT</div>
          </div>
          </>
          )}
        </>
      )}
      {/* lens vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,0.45) 100%)" }} />
    </div>
  );
}

export function ProofScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const handoff = st.handoff ?? "handed"; // Oct 27 2026: "Handed to someone" is the default for every order
  // Delivery time is "now" plus the minute or two it takes to finish this screen (matches completeDelivery).
  const at = s.clock + 8;
  const lateBy = at - stop.windowEnd;
  const needsName = handoff === "handed" && !st.receivedBy?.trim();
  const needsNote = lateBy > 0 && st.delayReason === "Other" && !st.delayNote?.trim();
  // Oct 26 2026: reusables to collect at this address (with this delivery, or a pickup riding along) come before
  // completing: the bottom button says "Collect reusables" until each one is marked collected or not collected.
  const toCollect = isOn("reusables")
    ? [...(stop.reusables && !st.collectResult ? [stop.id] : []), ...pickupsAt(s, stop).filter((x) => s.stops[x.id].status !== "delivered").map((x) => x.id)]
    : [];
  const two = needsReusablesPhoto(s, stop);
  const needsReusables = two && !st.reusablePhotos;

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Proof of delivery" onBack={() => a.jump((p) => ({ stack: p.stack.filter((x) => x.name !== "proof") }))} />
      <div className="flex flex-1 flex-col space-y-5 overflow-y-auto overflow-x-hidden px-4 pt-4">
        {/* Oct 26 2026: the same stage track as the stop page, so the driver sees where they are (and that Collect is next). */}
        <JobList id={stop.id} jobs={stopJobs(s, stop)} there />
        {/* Up to 3 photos each, all equal (no "main"); the X removes one. Oct 26 2026: above the on time / delayed box.
            Oct 27 2026: at a stop with reusables, the food and the reusables photos are separate, each labelled. */}
        <PhotoGroup id={id} kind="food" label={two ? "1 · Food drop-off" : undefined} />
        {two && <PhotoGroup id={id} kind="reusables" label="2 · Reusables" />}
        {/* #4 marked on time or delayed. Delayed asks why, with presets. */}
        <section>
          {lateBy <= 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[15px] font-semibold text-success">
              <CheckCircle2 className="size-5" /> {t("On time")} · window ends {fmtTime(stop.windowEnd)}
            </div>
          ) : (
            <div className="rounded-xl border border-warning-border bg-warning-bg p-3">
              <div className="nums flex items-center gap-2 text-[15px] font-semibold text-warning">
                <Clock className="size-5" /> Delayed · {lateBy} min past the window
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Kitchen was late", "Traffic", "Previous stop ran long", "Building access", "Other"].map((r) => (
                  <button
                    key={r}
                    onClick={() => a.updateStop(id, { delayReason: r })}
                    className={cn("h-10 rounded-full border px-3 text-[13px] font-semibold", st.delayReason === r ? "border-warning bg-card text-warning" : "border-warning-border bg-card/70 text-foreground")}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {/* "Other" needs a few words so dispatch knows what held the stop up. */}
              {st.delayReason === "Other" && (
                <textarea
                  value={st.delayNote ?? ""}
                  onChange={(e) => a.updateStop(id, { delayNote: e.target.value })}
                  rows={2}
                  autoFocus
                  placeholder="What held you up?"
                  aria-label="Delay reason"
                  className="mt-2 w-full resize-none rounded-2xl border border-warning-border bg-card px-4 py-3 text-base font-normal text-foreground outline-none focus:border-warning focus:ring-2 focus:ring-warning/30"
                />
              )}
            </div>
          )}
        </section>



        {/* Oct 26 2026: handoff, reusables card and customer note removed (asked elsewhere: Check drop-off, Collect). */}
        {/* Oct 26 2026: an optional note for dispatch (only dispatch sees it). */}
        <section>
          <label className="text-overline mb-1.5 block px-1">Note for dispatch (optional)</label>
          <textarea
            value={st.dispatchNote ?? ""}
            onChange={(e) => a.updateStop(id, { dispatchNote: e.target.value })}
            rows={3}
            placeholder="e.g. Front desk asked for a later drop next week"
            className="w-full resize-none rounded-xl border border-border-strong bg-white px-4 py-3 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
          />
        </section>
        {/* #13 / #75: location is logged with "Delivered". Too far from the address warns here and flags dispatch. */}
        {s.awayFromAddress ? (
          <div className="flex gap-3 rounded-xl border-2 border-warning-border bg-warning-bg p-3 text-warning">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span className="text-[13px]">
              <b className="block text-[15px] font-semibold">You're 0.4 mi from {stop.addressLine1}</b>
              Delivering more than {SETTINGS.deliveredRadiusMi === 0.1 ? "a block" : `${SETTINGS.deliveredRadiusMi} mi`} away flags dispatch. Check you're at the right stop.
            </span>
          </div>
        ) : null /* "At the address · location logged" note hidden for now; the location is still logged (#75). */}

      </div>

      <ActionBar>
        {st.photos === 0 ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id })}>
            <Camera /> {two ? t("Take the food photo") : t("Take a photo to finish")}
          </Button>
        ) : needsNote ? (
          // #4: "Other" delay reason needs a few words before the slide unlocks.
          <Button size="lg" variant="outline" className="w-full" disabled>
            Say what held you up
          </Button>
        ) : needsName ? (
          // #12: "Delivered" is logged with who received it, so the slide waits for a name (asked in Check drop-off).
          <Button size="lg" variant="outline" className="w-full" onClick={() => a.openSheet({ name: "dropCheck", id })}>
            Add who received it
          </Button>
        ) : toCollect.length > 0 ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "collect", id: toCollect[0] })}>
            <Recycle /> {t("Collect reusables")}
          </Button>
        ) : needsReusables ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id, kind: "reusables" })}>
            <Recycle /> {t("Take the reusables photo")}
          </Button>
        ) : (
          <>
            <SlideToConfirm
              label={s.awayFromAddress ? t("Slide to complete anyway") : t("Slide to complete delivery")}
              onConfirm={() => {
                if (!st.handoff) a.updateStop(id, { handoff });
                // The reusables photos go with each order collected here (History shows them with the pickup).
                if (st.reusablePhotos) for (const x of reusableIds(s, stop)) if (s.stops[x].collectResult === "collected") a.updateStop(x, { collectPhotos: st.reusablePhotos });
                a.completeDelivery(id);
              }}
            />
          </>
        )}
      </ActionBar>
    </div>
  );
}

/**
 * Left at drop-off / Handed to someone, and who received it. Oct 26 2026: also asked in Check drop-off (where the
 * driver puts the order down); both read and write the same answer on the stop.
 */
export function HandoffPicker({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const st = s.stops[id];
  const handoff = st.handoff ?? "handed"; // Oct 27 2026: "Handed to someone" is the default for every order
  return (
    <section>
      <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full border border-border-strong bg-white p-1">
        {(["handed", "left"] as const).map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={handoff === v}
            onClick={() => a.updateStop(id, { handoff: v })}
            className={cn("h-11 rounded-full text-[15px] font-semibold transition-colors", handoff === v ? "bg-teal-deep text-white" : "text-foreground/70")}
          >
            {v === "handed" ? "Handed to someone" : "Left at drop-off"}
          </button>
        ))}
      </div>
      {handoff === "handed" && (
        <div className="mt-3">
          <label className="text-overline mb-1.5 block">{t("Who received it?")}</label>
          <input
            value={st.receivedBy ?? ""}
            onChange={(e) => a.updateStop(id, { receivedBy: e.target.value })}
            placeholder="Name"
            className="h-12 w-full rounded-xl border border-border-strong bg-white px-4 text-base outline-none focus:border-teal focus:bg-card focus:ring-2 focus:ring-teal/30"
          />
        </div>
      )}
    </section>
  );
}

export type PhotoKind = "food" | "reusables";

/** Orders whose reusables are collected at this delivery: its own, and pickups riding along. */
const reusableIds = (s: State, stop: Stop) => (isOn("reusables") && stop.kind !== "pickup" ? [...(stop.reusables?.length ? [stop.id] : []), ...pickupsAt(s, stop).map((x) => x.id)] : []);

/**
 * Oct 27 2026: reusables are picked up at this delivery and not all marked "not collected", so the stop needs a
 * second, separate photo of them after the food photo.
 */
export function needsReusablesPhoto(s: State, stop: Stop) {
  const ids = reusableIds(s, stop);
  return ids.length > 0 && ids.some((x) => s.stops[x].collectResult !== "not_collected");
}

/** One kind of photo on Proof of delivery: its label, the thumbnails (X removes one) and Add another. */
function PhotoGroup({ id, kind, label }: { id: string; kind: PhotoKind; label?: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const n = kind === "food" ? st.photos : (st.reusablePhotos ?? 0);
  const remove = () => (kind === "food" ? a.removeOnePhoto(id) : a.updateStop(id, { reusablePhotos: Math.max(0, n - 1) }));
  return (
    <section>
      {label && (
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[15px] font-bold">
          {kind === "food" ? <Package className="size-4 text-teal" /> : <Recycle className="size-4 text-teal" />} {label}
          {n > 0 && <CheckCircle2 className="ml-auto size-5 text-success" aria-label="Taken" />}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
            <PhotoThumb door={stop.customerType === "individual"} scene={kind === "reusables" ? "totes" : undefined} shot={i} />
            <button onClick={remove} aria-label={`Remove photo ${i + 1}`} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {n < 3 && (
          <button
            onClick={() => a.push({ name: "camera", id, kind })}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-control text-2xs font-semibold text-teal"
          >
            {n === 0 ? <Camera className="size-6" /> : <Plus className="size-6" />}
            {n === 0 ? "Take photo" : "Add another"}
          </button>
        )}
      </div>
    </section>
  );
}
