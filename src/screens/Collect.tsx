import { useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Download, Minus, Plus, Recycle } from "lucide-react";
import { findStop, useApp } from "../store";
import { ActionBar, Button, Card, cn, SectionLabel, SlideToConfirm, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Reusable pickups (#48–53, #83).
 *   The expected count comes with the order. The driver records what was actually collected and takes a photo.
 *   Anything short opens the problem flow next, already filled in with what's missing (Oct 21 2026).
 *   Counts start at 0 so the driver actually counts; "Matches expected" fills them in one tap.
 *   The packing list can be downloaded on the phone.
 * Used for a pickup stop (completes the stop) and for totes collected with a delivery (#50).
 * ------------------------------------------------------------------ */
export function CollectScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const items = stop.reusables ?? [];
  const st = s.stops[id];
  const [counts, setCounts] = useState<Record<string, number>>(st.collected ?? Object.fromEntries(items.map((x) => [x.id, 0])));
  const [photos, setPhotos] = useState(st.collectPhotos ?? 0);
  const [touched, setTouched] = useState(!!st.collected);
  const pickup = stop.kind === "pickup";

  const set = (itemId: string, n: number) => {
    setTouched(true);
    setCounts({ ...counts, [itemId]: Math.max(0, Math.min(99, n)) });
  };
  const shortList = items.filter((x) => (counts[x.id] ?? 0) < x.expected).map((x) => `${x.expected - (counts[x.id] ?? 0)} ${x.label.toLowerCase()}`);
  const total = items.reduce((n, x) => n + (counts[x.id] ?? 0), 0);
  const expected = items.reduce((n, x) => n + x.expected, 0);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Collect reusables" subtitle={`${stop.name} · ${stop.orderNo}`} onBack={a.back} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* #83 packing list, mobile download */}
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-wash text-teal">
            <Recycle className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Packing list</span>
            <span className="nums block text-2xs text-muted-foreground">{expected} items expected</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => a.openSheet({ name: "packingList", id })}>
            <Download /> Open
          </Button>
        </Card>

        <section>
          <SectionLabel
            action={
              <button
                onClick={() => {
                  setTouched(true);
                  setCounts(Object.fromEntries(items.map((x) => [x.id, x.expected])));
                }}
                className="h-10 rounded-full border border-control bg-card px-3.5 text-[13px] font-semibold text-teal"
              >
                Matches expected
              </button>
            }
          >
            Count what you collected
          </SectionLabel>
          <Card className="divide-y divide-border">
            {items.map((x) => {
              const n = counts[x.id] ?? 0;
              const short = touched && n < x.expected;
              return (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{x.label}</span>
                    <span className={cn("nums block text-2xs", short ? "font-semibold text-warning" : "text-muted-foreground")}>
                      Expected {x.expected}
                      {short && ` · ${x.expected - n} short`}
                    </span>
                  </span>
                  <button aria-label={`One less ${x.label}`} onClick={() => set(x.id, n - 1)} className="grid size-12 place-items-center rounded-full border border-control bg-card">
                    <Minus className="size-5" />
                  </button>
                  <span className="nums w-8 text-center text-2xl font-bold">{n}</span>
                  <button aria-label={`One more ${x.label}`} onClick={() => set(x.id, n + 1)} className="grid size-12 place-items-center rounded-full border border-control bg-card">
                    <Plus className="size-5" />
                  </button>
                </div>
              );
            })}
          </Card>
        </section>

        <section>
          <SectionLabel>Photo</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: photos }).map((_, i) => (
              <div key={i} className="grid aspect-[3/4] place-items-center rounded-xl bg-teal-deep/80 text-white">
                <CheckCircle2 className="size-7" />
              </div>
            ))}
            {photos < 3 && (
              <button onClick={() => setPhotos(photos + 1)} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-control text-2xs font-semibold text-teal">
                <Camera className="size-6" /> {photos ? "Add another" : "Take photo"}
              </button>
            )}
          </div>
          <p className="mt-2 px-1 text-2xs text-muted-foreground">Show everything you collected together, so it can be checked against the expected count.</p>
        </section>

        {touched && shortList.length > 0 && (
          <div className="flex gap-3 rounded-xl border border-warning-border bg-warning-bg p-3 text-warning">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span className="text-[13px]">
              <b className="block text-[15px] font-semibold">Short: {shortList.join(", ")}</b>
              After you finish, you'll report what's missing so dispatch can follow up.
            </span>
          </div>
        )}
      </div>

      <ActionBar>
        {!touched ? (
          <Button size="lg" variant="outline" className="w-full" disabled>
            Count the items first
          </Button>
        ) : photos === 0 ? (
          <Button size="lg" className="w-full" onClick={() => setPhotos(1)}>
            <Camera /> Take a photo to finish
          </Button>
        ) : (
          <SlideToConfirm
            label={pickup ? `Slide · collected ${total} of ${expected}` : `Slide · ${total} of ${expected} collected`}
            onConfirm={() => {
              a.collectReusables(id, counts, photos);
              // Missing items go straight into the problem flow, pre-filled with what's short.
              if (shortList.length) a.jump((p) => ({ sheet: null, stack: [...p.stack.filter((x) => x.name !== "collect"), { name: "problem" as const, id, reusables: shortList }] }));
            }}
          />
        )}
      </ActionBar>
    </div>
  );
}
