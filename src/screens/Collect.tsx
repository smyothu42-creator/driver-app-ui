import { useEffect, useState } from "react";
import { Camera, Check, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { findStop, useApp } from "../store";
import { ActionBar, Button, cn, SegmentBar, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Reusable pickups (#48–53, #83). Reworked Oct 22 2026 from SFK's review of this screen:
 *   - Counts start at 0 so the driver actually counts; tap the number to type a big count. "All 3 collected" fills
 *     them in one tap (a clear button, not a status pill).
 *   - Each item says where it stands from its count: "0 of 3", "Short by 1", "Matches ✓", "1 over".
 *   - A count that doesn't match asks why (Customer didn't have them / Damaged / Other); "Can't collect" is the way out
 *     when there's nothing to take.
 *   - Both steps say Required, then ✓. The button names its action ("Confirm collection"); the line above it says
 *     what's still missing.
 *   - The count is a draft on the stop, so Back never loses it.
 *   - No packing-list card here (it repeated "Expected"); the list stays on the stop screen.
 * Used for a pickup stop (completes the stop) and for totes collected with a delivery (#50).
 * ------------------------------------------------------------------ */

const MISMATCH = ["Customer didn't have them", "Damaged", "Other"];
const NONE = ["Nothing to collect", "Nobody there", "Couldn't get in", "Other"];

export function CollectScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const items = stop.reusables ?? [];
  const st = s.stops[id];
  const pickup = stop.kind === "pickup";
  const draft = st.collectDraft;
  const [counts, setCounts] = useState<Record<string, number>>(draft?.counts ?? st.collected ?? Object.fromEntries(items.map((x) => [x.id, 0])));
  const [photos, setPhotos] = useState(draft?.photos ?? st.collectPhotos ?? 0);
  const [touched, setTouched] = useState(!!draft || !!st.collected);
  const [reason, setReason] = useState<string | null>(draft?.reason ?? null);
  const [note, setNote] = useState(draft?.note ?? "");
  const [none, setNone] = useState(draft?.none ?? false); // "Can't collect": nothing to take

  // Save the draft on every change, so leaving and coming back keeps the count, photo and reason.
  useEffect(() => {
    if (touched || photos || none) a.updateStop(id, { collectDraft: { counts, photos, reason, note, none } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, photos, reason, note, none, touched]);

  const set = (itemId: string, n: number) => {
    setTouched(true);
    setCounts({ ...counts, [itemId]: Math.max(0, Math.min(999, Number.isFinite(n) ? n : 0)) });
  };
  const total = items.reduce((n, x) => n + (counts[x.id] ?? 0), 0);
  const expected = items.reduce((n, x) => n + x.expected, 0);
  const matches = items.every((x) => (counts[x.id] ?? 0) === x.expected);
  const counted = touched;
  const needsReason = counted && !matches;
  const reasonOk = !needsReason || (!!reason && (reason !== "Other" || note.trim().length > 0));
  const countDone = counted && reasonOk;
  const photoDone = photos > 0;
  const ready = none ? !!reason && (reason !== "Other" || note.trim().length > 0) : countDone && photoDone;

  // Totes collected with a delivery: where this sits in that delivery (setup → photo → totes → confirm).
  const steps = pickup ? [] : [...(stop.setup ? ["Setup"] : []), "Photo", "Totes", "Confirm"];
  const stepAt = steps.indexOf("Totes");
  const title = items.length === 1 && /tote/i.test(items[0].label) ? "Count totes" : "Count reusables";
  const where = stop.returns ?? stop.dropoffNotes;

  // Everything still missing, in one line above the button: "Count totes and take a photo to continue".
  const todo = none
    ? [!reason ? "pick why you can't collect" : reason === "Other" && !note.trim() ? "add a few words for dispatch" : null]
    : [!counted ? title.toLowerCase() : null, counted && !reasonOk ? (reason === "Other" ? "add a few words about the difference" : "pick why the count doesn't match") : null, !photoDone ? "take a photo" : null];
  const parts = todo.filter(Boolean) as string[];
  const missing = parts.length ? `${parts.join(" and ").replace(/^./, (c) => c.toUpperCase())} to continue` : "";

  const confirm = () => {
    const why = reason === "Other" ? note.trim() : reason;
    a.collectReusables(id, none ? Object.fromEntries(items.map((x) => [x.id, 0])) : counts, none ? 0 : photos, none ? `Can't collect: ${why}` : needsReason ? why ?? undefined : undefined);
    a.toast(none ? "Nothing collected · sent to dispatch" : matches ? `Collected all ${expected}` : `Collected ${total} of ${expected} · sent`);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Where to find them matters more than the order number; the number stays for calls to support. */}
      <TopBar title="Collect reusables" subtitle={`${stop.name}${stop.addressLine2 ? ` · ${stop.addressLine2}` : ""} · ${stop.orderNo}`} onBack={a.back} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {stepAt >= 0 && (
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

        {where && (
          <p className="flex items-start gap-2 text-[15px] leading-snug text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-teal" /> {where}
          </p>
        )}

        {none ? (
          <Section n={1} title="Why can't you collect?" done={!!reason}>
            <div className="space-y-2 p-4">
              <Choices options={NONE} value={reason} onChange={setReason} />
              {reason === "Other" && <Note value={note} onChange={setNote} placeholder="What happened?" />}
            </div>
          </Section>
        ) : (
          <>
            <Section n={1} title={title} done={countDone}>
              <div className="divide-y divide-border">
                {items.map((x) => {
                  const n = counts[x.id] ?? 0;
                  const status =
                    n === x.expected
                      ? { text: "Matches ✓", cls: "text-success" }
                      : n > x.expected
                        ? { text: `${n - x.expected} over expected`, cls: "text-warning" }
                        : n === 0 && !counted
                          ? { text: `0 of ${x.expected}`, cls: "text-muted-foreground" }
                          : { text: `Short by ${x.expected - n}`, cls: "text-warning" };
                  return (
                    <div key={x.id} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold leading-snug">{x.label}</span>
                        <span className="nums mt-0.5 block text-[13px]">
                          <span className="text-muted-foreground">Expected {x.expected} · </span>
                          <span className={cn("font-semibold", status.cls)}>{status.text}</span>
                        </span>
                      </span>
                      <button aria-label={`One less ${x.label}`} onClick={() => set(x.id, n - 1)} className="grid size-12 shrink-0 place-items-center rounded-full border border-border-strong bg-card active:bg-muted">
                        <Minus className="size-5" />
                      </button>
                      {/* Tap the number to type it, for big counts. */}
                      <input
                        aria-label={`${x.label} collected`}
                        inputMode="numeric"
                        value={n}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set(x.id, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                        className="nums h-12 w-12 shrink-0 rounded-xl border border-transparent bg-transparent text-center text-2xl font-bold outline-none focus:border-teal focus:bg-teal-wash/40"
                      />
                      <button aria-label={`One more ${x.label}`} onClick={() => set(x.id, n + 1)} className="grid size-12 shrink-0 place-items-center rounded-full border border-border-strong bg-card active:bg-muted">
                        <Plus className="size-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* One-tap shortcut, written as what it does. Gone once everything matches. */}
              {!(counted && matches) && (
                <div className="border-t border-border p-3">
                  <button
                    onClick={() => {
                      setTouched(true);
                      setCounts(Object.fromEntries(items.map((x) => [x.id, x.expected])));
                      setReason(null);
                    }}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-wash text-[15px] font-semibold text-teal-deep active:bg-teal-soft"
                  >
                    <Check className="size-4" strokeWidth={3} /> {items.length === 1 ? `All ${expected} collected` : `All ${expected} collected (everything expected)`}
                  </button>
                </div>
              )}
              {needsReason && (
                <div className="space-y-2 border-t border-border bg-warning-bg/50 p-4">
                  <p className="nums text-[13px] font-semibold text-warning">
                    {total} of {expected} · why doesn't it match?
                  </p>
                  <Choices options={MISMATCH} value={reason} onChange={setReason} />
                  {reason === "Other" && <Note value={note} onChange={setNote} placeholder="What's different?" />}
                </div>
              )}
            </Section>

            <Section n={2} title="Photo" done={photoDone}>
              <div className="p-4">
                {/* The instruction comes before the camera, not after the shot. */}
                <p className="mb-3 text-[15px] leading-snug text-foreground/80">Lay everything you collected together, so dispatch can check the count.</p>
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
          </>
        )}

        {/* The way out, so a driver is never stuck on this screen. */}
        <button
          onClick={() => {
            setNone(!none);
            setReason(null);
            setNote("");
          }}
          className="mx-auto block h-11 px-3 text-[15px] font-semibold text-teal"
        >
          {none ? "Back to counting" : "Can't collect anything?"}
        </button>
      </div>

      <ActionBar>
        {!ready && <p className="text-center text-[13px] font-medium text-muted-foreground">{missing}</p>}
        <Button size="lg" className="w-full disabled:border disabled:border-border-strong disabled:bg-muted disabled:text-foreground/55 disabled:opacity-100" disabled={!ready} onClick={confirm}>
          {none ? "Confirm: nothing collected" : "Confirm collection"}
        </Button>
      </ActionBar>
    </div>
  );
}

/** A numbered step with its requirement on the right: "Required" until it's done, then ✓ Done. Stronger card edge for daylight. */
function Section({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <span className={cn("nums grid size-6 place-items-center rounded-full text-[13px]", done ? "bg-success text-white" : "bg-teal-deep text-white")}>{done ? <Check className="size-3.5" strokeWidth={3} /> : n}</span>
          {title}
        </h2>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold", done ? "bg-success-bg text-success" : "bg-muted text-muted-foreground")}>{done ? "Done" : "Required"}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-card shadow-[0_1px_4px_rgba(0,0,0,0.06)]">{children}</div>
    </section>
  );
}

function Choices({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="space-y-2">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-3 text-left text-[15px] font-semibold", value === o ? "border-teal bg-teal-wash text-teal-deep" : "border-border-strong")}>
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", value === o ? "border-teal" : "border-control")}>{value === o && <span className="size-2.5 rounded-full bg-teal" />}</span>
          {o}
        </button>
      ))}
    </div>
  );
}

function Note({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border border-border-strong bg-card px-3 py-2.5 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
    />
  );
}
