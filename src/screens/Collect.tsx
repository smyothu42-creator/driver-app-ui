import { useEffect, useState } from "react";
import { Camera, Check, MapPin, Plus, RotateCcw, X } from "lucide-react";
import { findStop, pickupDelivery, useApp } from "../store";
import { ActionBar, Button, cn, SegmentBar, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Reusable pickups (#48–53, #83). Reworked Oct 26 2026 from SFK's review: the reusables packing-slip data is rough,
 * so the driver no longer counts each item against an expected number. Instead:
 *   1. What to collect: the original order (number, date, type), what went out with it, and the pickup note.
 *   2. Collected / Not collected, with notes for dispatch (optional when collected, required when not).
 *   3. A photo of what was collected (only when collected).
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
  const [photos, setPhotos] = useState(draft?.photos ?? st.collectPhotos ?? 0);
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

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Where to find them matters more than the order number; the number stays for calls to support. */}
      <TopBar title="Collect reusables" subtitle={`${stop.name}${stop.addressLine2 ? ` · ${stop.addressLine2}` : ""} · ${stop.orderNo}`} onBack={a.back} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {stepAt >= 0 && canMark && (
          <div>
            <div className="nums mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">
              <span className="text-teal-deep">
                Step {stepAt + 1} of {steps.length} · {steps[stepAt]}
              </span>
              <span className="text-muted-foreground">Next: {steps[stepAt + 1]}</span>
            </div>
            <SegmentBar done={stepAt} total={steps.length} track="bg-border" />
          </div>
        )}

        {/* The original order, as the packing slip has it: what went out, and where to find it now. */}
        <Section title="What to collect">
          {stop.fromOrder && (
            <div className="nums border-b border-border bg-muted/50 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground">
              From order {stop.fromOrder.orderNo} · {stop.fromOrder.type} · {stop.fromOrder.date}
            </div>
          )}
          <ul className="divide-y divide-border">
            {items.map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 px-4 py-3">
                <span className="nums w-8 shrink-0 text-[17px] font-bold text-teal-deep">{x.expected}×</span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{x.label}</span>
              </li>
            ))}
          </ul>
          {where && (
            <p className="flex items-start gap-2 border-t border-border px-4 py-3 text-[15px] leading-snug text-foreground/80">
              <MapPin className="mt-0.5 size-4 shrink-0 text-teal" /> {where}
            </p>
          )}
        </Section>

        {/* Disabled (fieldset) until the driver is on site. */}
        <fieldset disabled={!canMark} className="min-w-0 space-y-5 disabled:opacity-60">
        <Section n={1} title="Did you collect them?" done={!!result && noteOk}>
          <div className="space-y-3 p-4">
            <div role="radiogroup" className="grid grid-cols-2 gap-2.5">
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
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-[15px] font-semibold",
                    result === v ? (v === "collected" ? "border-success bg-success-bg text-success" : "border-warning-border bg-warning-bg text-warning") : "border-border-strong bg-card",
                  )}
                >
                  <Icon className="size-5" strokeWidth={2.5} /> {label}
                </button>
              ))}
            </div>
            <label className="block text-[13px] font-semibold text-muted-foreground">
              Notes for dispatch {result === "not_collected" ? "(required)" : "(optional)"}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={result === "not_collected" ? "What happened? e.g. nothing by the pantry door" : "Anything different? e.g. only 2 totes, one lid missing"}
                className="mt-1.5 w-full resize-none rounded-xl border border-border-strong bg-card px-3 py-2.5 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
              />
            </label>
          </div>
        </Section>

        {collected && (
          <Section n={2} title="Photo" done={photoDone}>
            <div className="p-4">
              {/* The instruction comes before the camera, not after the shot. */}
              <p className="mb-3 text-[15px] leading-snug text-foreground/80">{!pickup || host ? "Reusables only, not the food. " : ""}Lay everything you collected together, so dispatch can see what came back.</p>
              {photos === 0 ? (
                <button onClick={() => setPhotos(1)} className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal/40 bg-teal-wash/40 text-[15px] font-semibold text-teal-deep active:bg-teal-wash">
                  <Camera className="size-8" /> Take photo
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: photos }).map((_, i) => (
                      <div key={i} className="relative grid aspect-square place-items-center rounded-xl bg-teal-deep/85 text-white">
                        <Camera className="size-6 opacity-60" />
                        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-success">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="md" variant="outline" className="flex-1 gap-1.5 whitespace-nowrap px-3" onClick={() => setPhotos(Math.max(1, photos))}>
                      <RotateCcw className="size-4" /> Retake
                    </Button>
                    {photos < 3 && (
                      <Button size="md" variant="outline" className="flex-1 gap-1.5 whitespace-nowrap px-3" onClick={() => setPhotos(photos + 1)}>
                        <Plus className="size-4" /> Add another
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Section>
        )}
        </fieldset>
      </div>

      <ActionBar>
        {!ready && <p className="text-center text-[13px] font-medium text-muted-foreground">{missing}</p>}
        <Button size="lg" className="w-full disabled:border disabled:border-border-strong disabled:bg-muted disabled:text-foreground/55 disabled:opacity-100" disabled={!ready} onClick={confirm}>
          {result === "not_collected" ? "Confirm: not collected" : "Confirm collection"}
        </Button>
      </ActionBar>
    </div>
  );
}

/**
 * A card with a heading. Numbered steps show their requirement on the right: "Required" until done, then ✓ Done.
 * Without `n` it's information only (no badge). Stronger card edge for daylight.
 */
function Section({ n, title, done, children }: { n?: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          {n != null && <span className={cn("nums grid size-6 place-items-center rounded-full text-[13px]", done ? "bg-success text-white" : "bg-teal-deep text-white")}>{done ? <Check className="size-3.5" strokeWidth={3} /> : n}</span>}
          {title}
        </h2>
        {n != null && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold", done ? "bg-success-bg text-success" : "bg-muted text-muted-foreground")}>{done ? "Done" : "Required"}</span>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-card shadow-[0_1px_4px_rgba(0,0,0,0.06)]">{children}</div>
    </section>
  );
}
