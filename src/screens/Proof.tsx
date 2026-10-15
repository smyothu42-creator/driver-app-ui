import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock, Flashlight, FlashlightOff, Plus, Recycle, X } from "lucide-react";
import { findStop, useApp, useT } from "../store";
import { SETTINGS, fmtTime } from "../data/route";
import { ActionBar, Button, Card, cn, SlideToConfirm, TopBar } from "../components/ui";
import { isOn } from "../data/sprints";

export function CameraScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const [flash, setFlash] = useState(0);
  const [torch, setTorch] = useState(false);
  const shots = s.stops[id].photos;

  const capture = () => {
    setFlash((f) => f + 1);
    a.addPhoto(id);
    window.setTimeout(() => {
      a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "camera"), ...(p.stack.some((x) => x.name === "proof") ? [] : [{ name: "proof" as const, id }])] }));
    }, 380);
  };

  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      {/* Full-bleed camera feed, same layout as the QR scanner. */}
      <div className="absolute inset-0">
        <ProofFeed torch={torch} door={stop.customerType === "individual"} />
      </div>

      {/* Framing corners + hint */}
      <div className="pointer-events-none absolute inset-x-6 bottom-[160px] top-[96px]">
        {(["left-0 top-0 rounded-tl-[22px] border-b-0 border-r-0", "right-0 top-0 rounded-tr-[22px] border-b-0 border-l-0", "bottom-0 left-0 rounded-bl-[22px] border-r-0 border-t-0", "bottom-0 right-0 rounded-br-[22px] border-l-0 border-t-0"] as const).map((c) => (
          <span key={c} className={cn("absolute size-10 border-[4px] border-white/90", c)} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[108px] flex justify-center px-6">
        <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur-md">
          {stop.customerType === "individual" ? "Show the bag and the door number" : "Show every bag and where you left it"}
        </span>
      </div>
      {flash > 0 && <div key={flash} className="anim-flash absolute inset-0 bg-white" />}

      {/* Top bar over the camera */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-2">
        <button aria-label="Close camera" onClick={a.back} className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-md">
          <X className="size-5" />
        </button>
        <span className="max-w-[60%] truncate rounded-full bg-black/45 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-md">{stop.name}</span>
        <button aria-label={torch ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torch} onClick={() => setTorch((v) => !v)} className={cn("grid size-11 place-items-center rounded-full backdrop-blur-md", torch ? "bg-white text-black" : "bg-black/45")}>
          {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
        </button>
      </div>

      {/* Shutter bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 pb-10 pt-10">
        <span className="w-16 text-[13px] font-semibold text-white/85">{shots > 0 ? `${shots}/3` : "Up to 3"}</span>
        <button aria-label="Take photo" onClick={capture} className="grid size-[76px] place-items-center rounded-full border-4 border-white">
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
export function PhotoThumb({ door, shot }: { door: boolean; shot: number }) {
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
        <ProofFeed torch={false} door={door} />
      </div>
    </div>
  );
}

/**
 * Camera feed stand-in, drawn to read like a phone photo: soft-focus kitchenette behind, a stone counter in
 * front, and the order on it (kraft bags with SFK labels and an insulated hot carrier) with contact shadows.
 * Individual orders show a bag at an apartment door instead.
 */
function ProofFeed({ torch, door }: { torch: boolean; door: boolean }) {
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
  const handoff = st.handoff ?? (stop.customerType === "family" ? "handed" : "left");
  // Delivery time is "now" plus the minute or two it takes to finish this screen (matches completeDelivery).
  const at = s.clock + 8;
  const lateBy = at - stop.windowEnd;
  const needsName = handoff === "handed" && !st.receivedBy?.trim();

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Proof of delivery" onBack={() => a.jump((p) => ({ stack: p.stack.filter((x) => x.name !== "proof") }))} />
      <div className="flex flex-1 flex-col space-y-5 overflow-y-auto overflow-x-hidden px-4 pt-4">
        {/* #4 marked on time or delayed. Delayed asks why, with presets. First thing on the screen. */}
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
                {["Kitchen was late", "Traffic", "Previous stop ran long", "Building access"].map((r) => (
                  <button
                    key={r}
                    onClick={() => a.updateStop(id, { delayReason: r })}
                    className={cn("h-10 rounded-full border px-3 text-[13px] font-semibold", st.delayReason === r ? "border-warning bg-card text-warning" : "border-warning-border bg-card/70 text-foreground")}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          {/* Up to 3 photos, all equal (no "main"); the X removes one. */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: st.photos }).map((_, i) => (
              <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
                <PhotoThumb door={stop.customerType === "individual"} shot={i} />
                <button onClick={() => a.removeOnePhoto(id)} aria-label={`Remove photo ${i + 1}`} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {st.photos < 3 && (
              <button
                onClick={() => a.push({ name: "camera", id })}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-control text-2xs font-semibold text-teal"
              >
                {st.photos === 0 ? <Camera className="size-6" /> : <Plus className="size-6" />}
                {st.photos === 0 ? "Take photo" : "Add another"}
              </button>
            )}
          </div>
        </section>


        {/* Full-width white panel from the handoff down to the bottom, rounded at the top (side borders sit just off-screen). */}
        <div className="-mx-[17px] flex-1 space-y-5 rounded-t-[28px] border border-b-0 border-border-strong bg-[#F9F9F7] px-[17px] pb-6 pt-5">
        <section>
          <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full border border-border-strong bg-white p-1">
            {(["left", "handed"] as const).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={handoff === v}
                onClick={() => a.updateStop(id, { handoff: v })}
                className={cn("h-11 rounded-full text-sm font-semibold transition-colors", handoff === v ? "bg-teal-deep text-white" : "text-foreground/70")}
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
              <div className="mt-2 grid auto-cols-fr grid-flow-col gap-2">
                {[stop.contact.name, ...(stop.backupContact ? [stop.backupContact.name] : []), "Security"].map((n) => (
                  <button key={n} onClick={() => a.updateStop(id, { receivedBy: n })} className={cn("h-11 min-w-0 truncate rounded-full border px-2 text-[13px] font-semibold", st.receivedBy === n ? "border-teal bg-teal-wash text-teal-deep" : "border-border-strong bg-white")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* #50 / #53: totes collected with this delivery are counted, not ticked. Hidden for now (Reusable pickup sprint). */}
        {isOn("reusables") && stop.reusables && (
          <Card onClick={() => a.push({ name: "collect", id })} className="flex items-center gap-3 p-4">
            <Recycle className="size-5 shrink-0 text-teal" />
            <span className="min-w-0 flex-1 text-[13px]">
              {st.collected ? `${stop.reusables.reduce((n, x) => n + (st.collected![x.id] ?? 0), 0)} of ${stop.reusables.reduce((n, x) => n + x.expected, 0)} reusables collected` : "Count the reusables you're collecting"}
            </span>
            <span className="text-sm font-semibold text-teal">{st.collected ? "Edit" : "Count"}</span>
          </Card>
        )}

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

        <section>
          <label className="text-overline mb-1.5 block px-1">Note for the customer (optional)</label>
          <textarea
            value={st.notes ?? ""}
            onChange={(e) => a.updateStop(id, { notes: e.target.value })}
            rows={3}
            placeholder="e.g. Left on the pantry counter, hot bags on the left"
            className="w-full rounded-xl border border-border-strong bg-white px-4 py-3 text-base outline-none focus:border-teal focus:bg-card focus:ring-2 focus:ring-teal/30"
          />
        </section>
        </div>
      </div>

      <ActionBar>
        {st.photos === 0 ? (
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id })}>
            <Camera /> {t("Take a photo to finish")}
          </Button>
        ) : needsName ? (
          // #12: "Delivered" is logged with who received it, so the slide waits for a name.
          <Button size="lg" variant="outline" className="w-full" disabled>
            Add who received it
          </Button>
        ) : (
          <>
            <SlideToConfirm
              label={s.awayFromAddress ? t("Slide to complete anyway") : t("Slide to complete delivery")}
              onConfirm={() => {
                if (!st.handoff) a.updateStop(id, { handoff });
                a.completeDelivery(id);
              }}
            />
          </>
        )}
      </ActionBar>
    </div>
  );
}
