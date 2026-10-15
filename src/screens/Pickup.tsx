import type { ReactNode } from "react";
import { Check, Flame, Info, QrCode, Snowflake, Truck } from "lucide-react";
import { findStop, runStops, useApp, vehicleOf, type State } from "../store";
import { KITCHEN, VEHICLES, fmtWindow, workOf, type Stop } from "../data/route";
import { ActionBar, Button, Card, cn, SlideToConfirm, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #9 Kitchen load, one package at a time:
 *   scan a package's QR → its items show (PackageScreen) → check each item → scan the next package → …
 *   → when every package is checked: slide "loaded, in transit".
 * There's no overview page (removed Oct 15 2026): entry points go through `openLoad` to the scanner or the open package.
 * Pickup is only the separate kitchen run for one claimed order.
 * ------------------------------------------------------------------ */

const loadable = (s: State) => runStops(s); // this kitchen pickup's packages (cancelled orders and reusables pickups have nothing to load)
const checked = (s: State, stop: Stop) => stop.bags.every((b) => s.bagChecks[b.id]);

/** Where the load goes next: the scanned package still being checked, else the next one to scan, else done. */
function nextLoadStep(s: State) {
  const route = loadable(s);
  const open = route.find((x) => s.scanned[x.id] && !checked(s, x));
  const toScan = route.find((x) => !s.scanned[x.id]);
  return { route, open, toScan, done: route.every((x) => checked(s, x)) };
}

/** Bottom of the load screens: the one next action, then a way to report a problem. */
function LoadActions({ current }: { current?: Stop }) {
  const { s, a } = useApp();
  const { open, toScan, done } = nextLoadStep(s);
  const busy = current && !checked(s, current); // this package isn't fully checked yet
  const openPackage = (id: string) => a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "package" && x.name !== "scan"), { name: "package" as const, id }] }));
  const toScanner = () => a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "package" && x.name !== "scan"), { name: "scan" as const }] }));

  return (
    <ActionBar>
      {done ? (
        <SlideToConfirm label="Loaded · start route" onConfirm={a.confirmPickup} />
      ) : busy ? (
        <Button size="lg" variant="outline" className="w-full" disabled>
          Check every item to continue
        </Button>
      ) : open && open.id !== current?.id ? (
        <Button size="lg" className="w-full" onClick={() => openPackage(open.id)}>
          <span className="truncate">
            Finish checking {open.seq}. {open.name}
          </span>
        </Button>
      ) : (
        toScan && (
          <Button size="lg" className="w-full" onClick={toScanner}>
            <QrCode /> Scan next package
          </Button>
        )
      )}
      <button onClick={() => a.toast("Kitchen lead notified about a missing item")} className="w-full py-1 text-center text-sm font-semibold text-danger">
        Something missing or damaged?
      </button>
    </ActionBar>
  );
}

/** Shown right after a package's QR is scanned: what's inside, to check item by item. */
export function PackageScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const sfkVan = VEHICLES.find((v) => v.id === vehicleOf(s, stop.id))!;
  const left = stop.bags.filter((b) => !s.bagChecks[b.id]).length;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={`${stop.seq}. ${stop.name}`} subtitle={`${stop.orderNo} · ${fmtWindow(stop.windowStart, stop.windowEnd)}`} onBack={a.back} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <TempChips stop={stop} />
            {sfkVan.owner === "sfk" && (
              <Chip className="border border-teal/30 text-teal-deep">
                <Truck /> {sfkVan.name}
              </Chip>
            )}
          </div>
          <div className="px-4 pb-1 pt-3 text-[13px] font-semibold text-muted-foreground">{left === 0 ? "Everything's here" : "Check what's inside"}</div>
          {/* One row per item in the package. */}
          <ul className="divide-y divide-border">
            {stop.bags.map((b) => {
              const on = !!s.bagChecks[b.id];
              return (
                <li key={b.id}>
                  <button role="checkbox" aria-checked={on} onClick={() => a.toggleBag(b.id)} className={cn("flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-300", on && "bg-success-bg")}>
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-success bg-success text-white" : "border-teal bg-teal-wash")}>{on && <Check className="size-4" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[15px] font-semibold", on && "text-muted-foreground")}>{b.label}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{b.detail}</span>
                    </span>
                    {b.temp === "HOT" ? <Flame className="size-4 shrink-0 text-coral" aria-label="Hot" /> : <Snowflake className="size-4 shrink-0 text-info" aria-label="Cold" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <LoadActions current={stop} />
    </div>
  );
}

/** A separate kitchen run for one claimed order: one row to tick, then slide to start. */
export function Pickup({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const done = checked(s, stop);
  const sfkVan = VEHICLES.find((v) => v.id === vehicleOf(s, stop.id))!;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={`Load stop ${stop.seq}`} subtitle={`${KITCHEN.dock} · claimed order ${stop.orderNo}`} onBack={a.back} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex gap-2.5 rounded-xl border border-info-border bg-info-bg p-3 text-[13px] text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>Kitchen has this order ready at the dispatch dock. Keep hot and cold in separate carriers.</span>
        </div>

        <Card className="overflow-hidden">
          <button
            onClick={() => a.setOrderLoaded(stop.bags.map((b) => b.id), !done)}
            className={cn("flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-300", done && "bg-success-bg")}
          >
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full transition-colors", done ? "bg-success text-white" : "border-2 border-teal")}>
              {done && <Check className="size-4" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn("truncate text-[15px] font-semibold", done && "text-muted-foreground")}>
                  {stop.seq}. {stop.name}
                </span>
                <span className="nums shrink-0 text-[13px] font-semibold text-teal-deep">{fmtWindow(stop.windowStart, stop.windowEnd)}</span>
              </span>
              <span className="nums block truncate text-[13px] text-muted-foreground">
                {stop.orderNo} · {stop.orderType}
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                <TempChips stop={stop} />
                {/* #79: a delivery dispatch moved to an SFK vehicle is loaded there. */}
                {sfkVan.owner === "sfk" && (
                  <Chip className="border border-teal/30 text-teal-deep">
                    <Truck /> {sfkVan.name}
                  </Chip>
                )}
                <span className={cn("ml-auto shrink-0 text-2xs font-semibold", done ? "text-success" : "text-teal")}>{done ? "Loaded" : "Tap when loaded"}</span>
              </span>
            </span>
          </button>
        </Card>
      </div>

      {done && (
        <ActionBar>
          <SlideToConfirm label="Loaded · start route" onConfirm={() => a.confirmClaimPickup(id)} />
        </ActionBar>
      )}
    </div>
  );
}

/** Hot / cold in the same quiet style as Today's route: coloured icon + grey word, no background. */
function TempChips({ stop }: { stop: Stop }) {
  return (
    <span className="flex items-center gap-3">
      {workOf(stop)
        .filter((w) => w !== "reusables")
        .map((w) => (
          <span key={w} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
            {w === "hot" ? <Flame className="size-3.5 text-coral" strokeWidth={2.2} /> : <Snowflake className="size-3.5 text-info" strokeWidth={2.2} />}
            {w === "hot" ? "Hot" : "Cold"}
          </span>
        ))}
    </span>
  );
}

/** Small filled chip for the load screens: icon + word. */
function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-2xs font-semibold [&_svg]:size-3.5", className)}>{children}</span>;
}
