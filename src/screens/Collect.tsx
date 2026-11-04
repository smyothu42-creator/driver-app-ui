import { useEffect, useState } from "react";
import { Camera, Check, Headphones, Plus, RotateCcw, X } from "lucide-react";
import { findStop, pickupDelivery, useApp } from "../store";
import { DISPATCH, fmtWindow, windowStatus } from "../data/route";
import { ItemList, ItemRow, PackingListButton, StageCard, StageTrack } from "./StopDetail";
import { PhotoThumb } from "./Proof";
import { Camera as CameraFill, CheckSquare as CheckSquareFill, Recycle as RecycleFill } from "@phosphor-icons/react";
import { ActionBar, Button, cn, SegmentBar, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Reusable pickups (#48–53, #83). Reworked Oct 26 2026 from SFK's review: the reusables packing-slip data is rough,
 * so the driver no longer counts each item against an expected number. Instead:
 *   1. What to collect: the original order (number, date, type), what went out with it, and the pickup note.
 *   2. Collected / Not collected, with notes for dispatch (optional when collected, required when not).
 *   3. A photo of what was collected (only when collected). Nov 4 2026: taken on its own camera step, like Proof of
 *      delivery; it comes back to this page to check before confirming.
 * The answer is a draft on the stop, so Back never loses it.
 * Used for a pickup stop (completes the stop) and for totes collected with a delivery (#50).
 * ------------------------------------------------------------------ */

type Result = "collected" | "not_collected";

export function CollectScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const items = stop.reusables ?? [];
  const st = s.stops[id];
  const pickup = stop.kind === "pickup";
  const draft = st.collectDraft;
  // Oct 26 2026: open any time from the stop's "Reusable pickup" button to see what's to collect, but it can only be
  // marked on site (at this stop, or at the delivery a pickup rides along with), like the order needing its slip scanned.
  const host = pickupDelivery(s, stop);
  const here = (host ? s.stops[host.id] : st).status;
  const canMark = here === "arrived" || here === "delivered" || st.status === "arrived";
  const [result, setResult] = useState<Result | null>(draft?.result ?? st.collectResult ?? null);
  const [photos] = useState(draft?.photos ?? st.collectPhotos ?? 0); // set by the camera step (draft), read when this page opens
  const [note, setNote] = useState(draft?.note ?? st.collectNote ?? "");

  // Save the draft on every change, so leaving and coming back keeps the answer, photo and notes.
  useEffect(() => {
    if (result || photos || note) a.updateStop(id, { collectDraft: { result, photos, note } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, photos, note]);

  const collected = result === "collected";
  const noteOk = result !== "not_collected" || note.trim().length > 0;
  const photoDone = photos > 0;
  const ready = canMark && !!result && noteOk && (!collected || photoDone);

  // Totes collected with a delivery: where this sits in that delivery (setup → photo → totes → confirm).
  const steps = pickup ? [] : [...(stop.setup ? ["Setup"] : []), "Photo", "Totes", "Confirm"];
  const stepAt = steps.indexOf("Totes");
  const where = stop.returns ?? stop.dropoffNotes;

  // What's still missing, in one line above the button.
  const missing = !canMark
    ? "You can mark this once you're at the stop"
    : !result
    ? "Say whether you collected them to continue"
    : !noteOk
      ? "Add a note for dispatch to continue"
      : collected && !photoDone
        ? "Take a photo to continue"
        : "";

  const confirm = () => {
    a.collectReusables(id, result!, collected ? photos : 0, note.trim() || undefined);
    a.toast(collected ? "Collected · sent to dispatch" : "Not collected · sent to dispatch");
  };

  // Nov 4 2026 (review): the same look as the stop page's stages: a grey header band with the recycle tile, full-width
  // rows (what to collect, then where it is), the Collected / Not collected switch in its own section, and the photo
  // as a separate camera step (like Proof of delivery), not taken inline on this page.
  const w = windowStatus(stop, s.clock);
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Where to find them matters more than the order number; the number stays for calls to support. */}
      <TopBar title="Collect reusables" subtitle={`${stop.name}${stop.addressLine2 ? ` · ${stop.addressLine2}` : ""} · ${stop.orderNo}`} onBack={a.back} tone="white" />
      {/* Nov 4 2026: this page's own progress bar (Collect → Take photo), fixed under the top bar like the stop page's. */}
      <div className="relative z-10 shrink-0 border-b border-border/60 bg-white px-5 pb-4 pt-2">
        <StageTrack
          stages={[
            { key: "collect", label: "Collect", icon: RecycleFill, done: !!result && noteOk },
            { key: "photo", label: result === "not_collected" ? "No photo needed" : "Take photo", icon: CameraFill, done: result === "not_collected" ? noteOk : photoDone },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        {stepAt >= 0 && canMark && (
          <div className="px-5 pb-4 pt-2">
            <div className="nums mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">
              <span className="text-teal-deep">
                Step {stepAt + 1} of {steps.length} · {steps[stepAt]}
              </span>
              <span className="text-muted-foreground">Next: {steps[stepAt + 1]}</span>
            </div>
            <SegmentBar done={stepAt} total={steps.length} track="bg-border" />
          </div>
        )}

        {/* What went out with the original order, and where to find it now. */}
        <StageCard stage="collect" icon={RecycleFill} title="What to collect" status="" done={false} action={<PackingListButton id={id} />} sub={pickup ? <span className="nums">Pickup window {fmtWindow(stop.windowStart, stop.windowEnd)}{w.state !== "upcoming" ? ` · ${w.text}` : ""}</span> : undefined}>
          {stop.fromOrder && (
            <p className="nums mb-2 mt-3 pl-[80px] pr-5 text-[15px] text-foreground/80">
              From order <b className="font-semibold text-teal-deep">{stop.fromOrder.orderNo}</b> · {stop.fromOrder.type} · {stop.fromOrder.date}
            </p>
          )}
          <ItemList>
            {items.map((x) => (
              <ItemRow key={x.id} on={false} count={x.expected} label={x.label} />
            ))}
          </ItemList>
          {/* Nov 4 2026: where to find them is the order's note (dispatch writes it), so it reads as a dispatch comment,
              the same bubble as on the stop page. */}
          {where && (
            <div className="flex items-start gap-3 px-5 pt-4">
              <span className="grid w-12 shrink-0 place-items-center">
                <span className="grid size-9 place-items-center rounded-full bg-teal-wash text-teal-deep">
                  <Headphones className="size-[18px]" />
                </span>
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-teal-deep">Dispatch · {DISPATCH.name}</p>
                <p className="mt-0.5 text-[15px] leading-snug text-foreground">{where}</p>
              </div>
            </div>
          )}
          <div className="h-4" />
        </StageCard>

        {/* Disabled (fieldset) until the driver is on site. */}
        <fieldset disabled={!canMark} className="min-w-0 disabled:opacity-60">
          <StageCard stage="result" icon={CheckSquareFill} title="Did you collect them?" status={result && noteOk ? "Done" : ""} done={!!result && noteOk}>
            <div className="space-y-3 px-5 py-4">
              {/* The same pill switch as "Handed to someone | Left at drop-off". */}
              <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full border border-border-strong bg-white p-1">
                {(
                  [
                    ["collected", "Collected", Check],
                    ["not_collected", "Not collected", X],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={result === v}
                    onClick={() => setResult(v)}
                    className={cn("flex h-12 items-center justify-center gap-2 rounded-full px-3 text-[15px] font-semibold transition-colors", result === v ? "bg-teal-deep text-white" : "text-foreground/70")}
                  >
                    <Icon className="size-5" strokeWidth={2.5} /> {label}
                  </button>
                ))}
              </div>
              {/* Nov 4 2026: the note box only shows for "Not collected", where it's required. */}
              {result === "not_collected" && (
                <label className="block text-[13px] font-semibold text-muted-foreground">
                  Notes for dispatch (required)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="What happened? e.g. nothing by the pantry door"
                    className="mt-1.5 w-full resize-none rounded-xl border border-border-strong bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
                  />
                </label>
              )}
            </div>
          </StageCard>

          {/* The photo, once it's been taken on the camera step: shown here to check before confirming. */}
          {collected && photoDone && (
            <StageCard stage="photo" icon={CameraFill} title="Photo" status="Done" done>
              <div className="px-5 py-4">
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: photos }).map((_, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                      <PhotoThumb door={false} shot={i} scene="totes" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="md" variant="outline" className="flex-1 gap-1.5 whitespace-nowrap px-3" onClick={() => (a.updateStop(id, { collectDraft: { result, note, photos: 0 } }), a.push({ name: "camera", id, kind: "collect" }))}>
                    <RotateCcw className="size-4" /> Retake
                  </Button>
                  {photos < 3 && (
                    <Button size="md" variant="outline" className="flex-1 gap-1.5 whitespace-nowrap px-3" onClick={() => a.push({ name: "camera", id, kind: "collect" })}>
                      <Plus className="size-4" /> Add another
                    </Button>
                  )}
                </div>
              </div>
            </StageCard>
          )}
        </fieldset>
      </div>

      <ActionBar>
        {collected && !photoDone && canMark ? (
          // The photo is its own step, on the camera (like Proof of delivery).
          <Button size="lg" className="w-full" onClick={() => a.push({ name: "camera", id, kind: "collect" })}>
            <Camera /> Take photo of what you collected
          </Button>
        ) : (
          <>
            {!ready && <p className="text-center text-[13px] font-medium text-muted-foreground">{missing}</p>}
            <Button size="lg" className="w-full disabled:border disabled:border-border-strong disabled:bg-muted disabled:text-foreground/55 disabled:opacity-100" disabled={!ready} onClick={confirm}>
              {result === "not_collected" ? "Confirm: not collected" : "Confirm collection"}
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}

