import { useEffect, useRef, useState } from "react";
import { Building, Camera, Check, CheckCircle2, Clock, Flashlight, FlashlightOff, Headphones, PackageMinus, PackageX, Phone, Plus, ThermometerSun, UserX, X } from "lucide-react";
import { findStop, nextStop, useApp, useT } from "../store";
import { DISPATCH, workOf } from "../data/route";
import { ActionBar, Button, Card, cn, IconChip, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #21 Problem flow. Step-by-step prompts and photos, then a prompt to call dispatch.
 *   1 What happened      one tap, grouped: can't deliver / order problem
 *   2 Before you send    things to try or details to pick (taps, no typing)
 *   3 Photo              required when the food or the order is the problem
 *   4 Sent               primary action: call dispatch
 * Short pickups of reusables (#53) reuse this flow from the stop.
 * ------------------------------------------------------------------ */

type Kind = "late" | "unsafe" | "access" | "nobody" | "short" | "wrong";

const KINDS: { group: string; items: { k: Kind; icon: typeof Clock; label: string; photo: boolean }[] }[] = [
  {
    group: "Can't deliver",
    items: [
      { k: "access", icon: Building, label: "Can't get in", photo: false },
      { k: "nobody", icon: UserX, label: "Nobody there to receive it", photo: false },
      { k: "late", icon: Clock, label: "Food is late", photo: false },
      { k: "unsafe", icon: ThermometerSun, label: "Food looks bad or unsafe", photo: true },
    ],
  },
  {
    group: "Order problem",
    items: [
      { k: "short", icon: PackageMinus, label: "Short · something's missing", photo: true },
      { k: "wrong", icon: PackageX, label: "Wrong items", photo: true },
    ],
  },
];
const ALL = KINDS.flatMap((g) => g.items);

export function ProblemFlow({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [lateBy, setLateBy] = useState<string | null>(null);
  const [bags, setBags] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState(0);
  const [camera, setCamera] = useState(false);

  const item = ALL.find((x) => x.k === kind);
  // A reusables pickup has no food: only access problems apply. Short counts are handled on the collect screen.
  const groups = stop.kind === "pickup" ? KINDS.slice(0, 1).map((g) => ({ ...g, items: g.items.filter((x) => x.k === "access" || x.k === "nobody") })) : KINDS;
  const backup = stop.backupContact;

  // Step 2 content per problem. Each "try" can be done right here with one tap.
  const tries: { key: string; label: string; action?: { label: string; run: () => void } }[] =
    kind === "access" || kind === "nobody"
      ? [
          { key: "contact", label: `Call ${stop.contact.name}`, action: { label: "Call", run: () => a.toast(`Calling ${stop.contact.name}…`) } },
          ...(backup ? [{ key: "backup", label: `Call ${backup.name} (backup)`, action: { label: "Call", run: () => a.toast(`Calling ${backup.name}…`) } }] : []),
          kind === "access" ? { key: "photo", label: "Checked the access notes and photo" } : { key: "wait", label: "Waited 5 minutes on site" },
        ]
      : kind === "unsafe"
        ? [
            { key: "separate", label: "Kept it separate. Not serving it" },
            { key: "temp", label: workOf(stop).includes("hot") ? "Checked hot bags are still closed" : "Checked cold bags are still closed" },
          ]
        : [];
  const needsBags = kind === "short" || kind === "wrong";
  // Bag counts aren't stored reliably (review Oct 14 2026), so the driver picks what's affected, not which bag.
  const affected = [...(workOf(stop).includes("hot") ? ["Hot food"] : []), ...(workOf(stop).includes("cold") ? ["Cold food"] : []), "Drinks or sides", "Utensils or plates"];
  const step2Ok = kind === "late" ? !!lateBy : needsBags ? Object.values(bags).some(Boolean) : tries.length === 0 || Object.values(tried).some(Boolean);

  const summary = [item?.label, lateBy && `about ${lateBy} late`, needsBags && Object.keys(bags).filter((k) => bags[k]).join(", ")].filter(Boolean).join(" · ");

  const send = () => {
    a.reportIssue(id, summary, photos);
    setStep(3);
  };

  const titles = ["What happened?", kind === "late" ? "How late?" : needsBags ? "What's affected?" : "Before you send", "Add a photo", "Sent to dispatch"];

  if (camera)
    return (
      <IssueCamera
        kind={kind ?? "late"}
        shots={photos}
        title={stop.name}
        onClose={() => setCamera(false)}
        onShot={() => {
          setPhotos((n) => Math.min(3, n + 1));
          window.setTimeout(() => setCamera(false), 380);
        }}
      />
    );

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t("Report a problem")} subtitle={`Stop ${stop.seq} · ${stop.name}`} onBack={step > 0 && step < 3 ? () => setStep(step - 1) : a.back} />

      {/* Progress: 4 short bars, so the driver knows how much is left. */}
      <div className="flex gap-1.5 px-4 pt-3" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-coral" : "bg-border-strong/60")} />
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <h1 className="text-2xl font-bold tracking-tight">{titles[step]}</h1>

        {step === 0 &&
          groups.map((g) => (
            <section key={g.group}>
              <div className="text-overline mb-2 px-1">{g.group}</div>
              <div className="space-y-2">
                {g.items.map(({ k, icon: I, label }) => (
                  <button
                    key={k}
                    onClick={() => {
                      setKind(k);
                      setStep(1);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-control bg-card px-4 text-left text-[15px] font-semibold active:bg-danger-bg"
                  >
                    <I className="size-5 shrink-0 text-danger" /> {label}
                  </button>
                ))}
              </div>
            </section>
          ))}

        {step === 1 && kind === "late" && (
          <div className="grid grid-cols-3 gap-2">
            {["10 min", "20 min", "30+ min"].map((v) => (
              <button key={v} onClick={() => setLateBy(v)} className={cn("h-14 rounded-2xl border text-base font-bold", lateBy === v ? "border-danger bg-danger-bg text-danger" : "border-control bg-card")}>
                {v}
              </button>
            ))}
          </div>
        )}

        {step === 1 && needsBags && (
          <Card className="divide-y divide-border">
            {affected.map((label) => {
              const on = !!bags[label];
              return (
                <button key={label} role="checkbox" aria-checked={on} onClick={() => setBags({ ...bags, [label]: !on })} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2", on ? "border-danger bg-danger text-white" : "border-control")}>{on && <Check className="size-4" strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
                </button>
              );
            })}
          </Card>
        )}

        {step === 1 && tries.length > 0 && (
          <Card className="divide-y divide-border">
            {tries.map((x) => {
              const on = !!tried[x.key];
              return (
                <div key={x.key} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <button role="checkbox" aria-checked={on} aria-label={x.label} onClick={() => setTried({ ...tried, [x.key]: !on })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2", on ? "border-teal bg-teal text-white" : "border-control")}>{on && <Check className="size-4" strokeWidth={3} />}</span>
                    <span className="text-sm font-semibold">{x.label}</span>
                  </button>
                  {x.action && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        x.action!.run();
                        setTried((p) => ({ ...p, [x.key]: true }));
                      }}
                    >
                      <Phone /> {x.action.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {step === 2 && (
          <>
            <p className="text-[15px] text-muted-foreground">{item?.photo ? "Required. Show the food." : "Optional. A photo helps dispatch decide faster."}</p>
            {/* Same as the delivery photo: real camera, realistic thumbnails, X removes one. */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: photos }).map((_, i) => (
                <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
                  <IssueThumb kind={kind ?? "late"} shot={i} />
                  <button onClick={() => setPhotos((n) => Math.max(0, n - 1))} aria-label={`Remove photo ${i + 1}`} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {photos < 3 && (
                <button onClick={() => setCamera(true)} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-control text-2xs font-semibold text-teal">
                  {photos ? <Plus className="size-6" /> : <Camera className="size-6" />} {photos ? "Add another" : "Take photo"}
                </button>
              )}
            </div>
            <Card className="p-4 text-[13px]">
              <div className="text-overline mb-1">Dispatch will see</div>
              <div className="font-semibold">{summary}</div>
              <div className="text-muted-foreground">
                {stop.name} · {stop.orderNo} · your location and time
              </div>
            </Card>
          </>
        )}

        {step === 3 && (
          <div className="pt-4 text-center">
            <IconChip tone="success" className="mx-auto size-16 rounded-full [&_svg]:size-8">
              <CheckCircle2 />
            </IconChip>
            <p className="mt-3 text-[15px] font-semibold">{summary}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {s.online ? `${DISPATCH.name} has it on the order now.` : "Saved on your phone. It sends when signal is back."} Call so you can decide together what to do with the food.
            </p>
          </div>
        )}
      </div>

      <ActionBar>
        {step === 1 && (
          <Button size="lg" className="w-full" disabled={!step2Ok} onClick={() => setStep(2)}>
            {step2Ok ? t("Next") : kind === "late" ? "Pick how late" : needsBags ? "Pick what's affected" : "Tick what you tried"}
          </Button>
        )}
        {step === 2 && (
          <Button size="lg" className="w-full" disabled={!!item?.photo && photos === 0} onClick={send}>
            {item?.photo && photos === 0 ? "Take a photo to send" : t("Send to dispatch")}
          </Button>
        )}
        {step === 3 && (
          <>
            <Button size="lg" variant="teal" className="w-full" onClick={() => a.toast(`Calling dispatch (${DISPATCH.name})…`)}>
              <Headphones /> {t("Call dispatch now")}
            </Button>
            {/* After reporting, the route moves past this stop: go to the Route tab, opened on the next stop. */}
            <Button size="md" variant="ghost" className="w-full" onClick={() => a.setTab("map")}>
              {(() => {
                const next = nextStop(s);
                // Food for the next stop isn't loaded yet: the kitchen pickup comes first.
                if (next && !s.pickupDone) return "Next · kitchen pickup";
                return next && next.id !== id ? `Next stop · ${next.name}` : "Go to route";
              })()}
            </Button>
          </>
        )}
        {step === 0 && <p className="text-center text-2xs text-muted-foreground">The customer isn't told automatically. Dispatch decides.</p>}
      </ActionBar>
    </div>
  );
}

/* ---------------- Problem photos ----------------
 * Same camera as the delivery photo (full-bleed feed, corner frame, flashlight, shutter), with a scene that matches
 * the problem: a spilled / opened container for food problems, an open bag with the slip for short or wrong orders,
 * and a closed, unlit entrance for access problems.
 */
function IssueCamera({ kind, shots, title, onClose, onShot }: { kind: Kind; shots: number; title: string; onClose: () => void; onShot: () => void }) {
  const [torch, setTorch] = useState(false);
  const [flash, setFlash] = useState(0);
  const hint = kind === "access" || kind === "nobody" ? "Show the entrance and what's blocking you" : kind === "short" || kind === "wrong" ? "Show the open bag and the slip" : "Show the food up close";
  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <IssueFeed kind={kind} torch={torch} />
      </div>
      <div className="pointer-events-none absolute inset-x-6 bottom-[160px] top-[96px]">
        {(["left-0 top-0 rounded-tl-[22px] border-b-0 border-r-0", "right-0 top-0 rounded-tr-[22px] border-b-0 border-l-0", "bottom-0 left-0 rounded-bl-[22px] border-r-0 border-t-0", "bottom-0 right-0 rounded-br-[22px] border-l-0 border-t-0"] as const).map((c) => (
          <span key={c} className={cn("absolute size-10 border-[4px] border-white/90", c)} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[108px] flex justify-center px-6">
        <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur-md">{hint}</span>
      </div>
      {flash > 0 && <div key={flash} className="anim-flash absolute inset-0 bg-white" />}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-2">
        <button aria-label="Close camera" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-md">
          <X className="size-5" />
        </button>
        <span className="max-w-[60%] truncate rounded-full bg-black/45 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-md">{title}</span>
        <button aria-label={torch ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torch} onClick={() => setTorch((v) => !v)} className={cn("grid size-11 place-items-center rounded-full backdrop-blur-md", torch ? "bg-white text-black" : "bg-black/45")}>
          {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 pb-10 pt-10">
        <span className="w-16 text-[13px] font-semibold text-white/85">{shots > 0 ? `${shots}/3` : "Up to 3"}</span>
        <button
          aria-label="Take photo"
          onClick={() => {
            setFlash((f) => f + 1);
            onShot();
          }}
          className="grid size-[76px] place-items-center rounded-full border-4 border-white"
        >
          <span className="size-[60px] rounded-full bg-white transition active:scale-90" />
        </button>
        <span className="w-16" />
      </div>
    </div>
  );
}

/** A taken problem photo: the camera scene drawn at phone size and scaled into the thumbnail, framed a little differently each time. */
function IssueThumb({ kind, shot }: { kind: Kind; shot: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frame = [{ x: 0, y: -110, r: 0 }, { x: -18, y: -125, r: -2 }, { x: 14, y: -100, r: 1.5 }][shot % 3];
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 h-[760px] w-[360px] origin-top-left" style={{ transform: `scale(${scale}) translate(${frame.x}px, ${frame.y}px) rotate(${frame.r}deg)` }}>
        <IssueFeed kind={kind} torch={false} />
      </div>
    </div>
  );
}

function IssueFeed({ kind, torch }: { kind: Kind; torch: boolean }) {
  const kraft = "repeating-linear-gradient(90deg, rgba(90,55,20,0.05) 0 1px, transparent 1px 5px)";
  const access = kind === "access" || kind === "nobody";
  const order = kind === "short" || kind === "wrong";
  return (
    <div className={cn("absolute inset-0 transition-[filter] duration-300", torch ? "brightness-125" : "brightness-[0.9]")}>
      {access ? (
        <>
          {/* Closed, unlit lobby entrance: glass doors, keypad, "after hours" sign */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #5b6065 0%, #474b50 62%, #8f8a82 62%, #7b766e 100%)" }} />
          <div className="absolute left-1/2 top-[110px] h-[370px] w-[250px] -translate-x-1/2 rounded-[2px] bg-[#2a2e33] shadow-[inset_0_0_0_8px_#9aa0a6]">
            <div className="absolute inset-y-2 left-1/2 w-1.5 -translate-x-1/2 bg-[#9aa0a6]" />
            <div className="absolute inset-2 bg-[linear-gradient(120deg,rgba(255,255,255,0.14),transparent_35%,transparent_60%,rgba(255,255,255,0.06))]" />
            <div className="absolute left-[30px] top-[150px] rounded-[2px] bg-white px-2 py-1 text-[10px] font-bold leading-tight text-[#2a2e33]">AFTER HOURS<br />USE INTERCOM</div>
            <div className="absolute right-[34px] top-[170px] h-5 w-1.5 rounded bg-[#c8ccd0]" />
            <div className="absolute left-[118px] top-[170px] h-5 w-1.5 rounded bg-[#c8ccd0]" />
          </div>
          <div className="absolute right-[20px] top-[250px] h-[64px] w-[40px] rounded-[4px] bg-[#c9ccd0] p-1.5 shadow-[0_4px_8px_rgba(0,0,0,0.35)]">
            <div className="h-3 rounded-[2px] bg-[#1b2a2c]" />
            <div className="mt-1 grid grid-cols-3 gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="h-2 rounded-[1px] bg-[#8e9297]" />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Close-up on a stone counter */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.3), transparent 60%), linear-gradient(180deg, #c9c4bb 0%, #b6b0a5 50%, #8e877c 100%)" }} />
          {order ? (
            <>
              {/* Open kraft bag, slip on top, containers pulled out (one item missing) */}
              <div className="absolute left-[30px] top-[220px] h-[200px] w-[170px] -rotate-6 rounded-[4px] shadow-[0_20px_26px_-8px_rgba(0,0,0,0.5)]" style={{ background: `${kraft}, linear-gradient(100deg, #b98c58, #cfa673 45%, #b38452)` }}>
                <div className="absolute inset-x-0 top-0 h-6 rounded-t-[4px] bg-[#8f6738]" />
                <div className="absolute left-1/2 top-[70px] grid size-12 -translate-x-1/2 place-items-center rounded-full bg-[#F5E516] text-[11px] font-extrabold text-[#004045]">SFK</div>
              </div>
              <div className="absolute right-[24px] top-[200px] w-[150px] rotate-3 rounded-[3px] bg-[#f7f5ef] p-2.5 font-mono text-[9px] leading-snug text-[#1d1f1e] shadow-[0_6px_14px_rgba(0,0,0,0.3)]">
                <div className="font-bold">PACKING SLIP</div>
                <div className="mt-1 border-t border-dashed border-black/30 pt-1">✓ MAINS A–F</div>
                <div>✓ SALADS</div>
                <div className="text-[#B24A2B]">✗ DESSERTS</div>
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="absolute h-[52px] w-[96px] rounded-[10px] bg-[#ece9e0] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.08),0_10px_14px_-6px_rgba(0,0,0,0.45)]" style={{ left: 60 + i * 110, top: 450 + i * 12 }}>
                  <div className="absolute inset-2 rounded-[7px] border border-black/10" />
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Opened clamshell with food tipped out, a sauce smear, the hot carrier behind */}
              <div className="absolute right-[24px] top-[160px] h-[120px] w-[130px] rounded-[12px] blur-[1.5px]" style={{ background: "linear-gradient(160deg, #1f5c60, #0a3538)" }} />
              <div className="absolute left-[40px] top-[300px] h-[150px] w-[220px] -rotate-6 rounded-[18px] bg-[#efece3] shadow-[0_18px_24px_-8px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-3 rounded-[12px] bg-[#e4dfd2]" />
                <div className="absolute left-6 top-6 h-14 w-24 rounded-full bg-[#d9b56a]" />
                <div className="absolute left-24 top-12 h-12 w-20 rounded-full bg-[#9a5a2e]" />
                <div className="absolute left-10 top-[84px] h-8 w-28 rounded-full bg-[#6f8f3d]" />
              </div>
              <div className="absolute left-[200px] top-[420px] h-[50px] w-[120px] rotate-12 rounded-[40%] bg-[#8a3f22]/70 blur-[1px]" />
              <div className="absolute left-[150px] top-[200px] h-[90px] w-[150px] rotate-[24deg] rounded-[16px] bg-[#f5f2ea]/90 shadow-[0_10px_16px_-6px_rgba(0,0,0,0.4)]" />
            </>
          )}
        </>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,0.45) 100%)" }} />
    </div>
  );
}
