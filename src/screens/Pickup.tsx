import { useState, type ReactNode } from "react";
import { Check, CheckCheck, Flame, Info, Lock, Minus, ScanLine, Snowflake, Truck } from "lucide-react";
import { findStop, runStops, useApp, vehicleOf, type State } from "../store";
import { KITCHEN, KITCHEN_READY, VEHICLES, fmtTime, fmtWindow, runOf, tempsOf, workOf, type Bag, type Stop } from "../data/route";
import { ActionBar, Button, Card, cn, SlideToConfirm, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #9 Kitchen load, one order at a time:
 *   scan any of today's packing slips → that order opens (PackageScreen) → check each item → scan the next → …
 *   → when every order on this pickup is checked: slide "loaded, start route".
 * Home lists this pickup's orders; each opens the same PackageScreen. Checks save on every tap, so a driver can
 * stop to go find something and pick up where they left off (Oct 20 2026).
 * Pickup is only the separate kitchen run for one claimed order.
 * ------------------------------------------------------------------ */

const loadable = (s: State) => runStops(s); // this kitchen pickup's orders (cancelled orders and reusables pickups have nothing to load)
export const checkedCount = (s: Pick<State, "bagChecks">, stop: Stop) => stop.bags.filter((b) => s.bagChecks[b.id]).length;
const checked = (s: Pick<State, "bagChecks">, stop: Stop) => checkedCount(s, stop) === stop.bags.length;

/** Where the load goes next: the scanned order still being checked, else the next one to scan, else done. */
function nextLoadStep(s: State) {
  const route = loadable(s);
  const open = route.find((x) => s.scanned[x.id] && !checked(s, x));
  const toScan = route.find((x) => !s.scanned[x.id]);
  return { route, open, toScan, done: route.every((x) => checked(s, x)) };
}

/** Bottom of the load screens: the one next action. */
function LoadActions({ current }: { current?: Stop }) {
  const { s, a } = useApp();
  const { open, toScan, done } = nextLoadStep(s);
  const later = current && runOf(current) > s.run; // a later pickup's order, opened early
  const unscanned = current && !later && !s.scanned[current.id];
  const left = current ? current.bags.length - checkedCount(s, current) : 0;
  const openPackage = (id: string) => a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "package" && x.name !== "scan"), { name: "package" as const, id }] }));
  const toScanner = (id?: string) => a.jump((p) => ({ stack: [...p.stack.filter((x) => x.name !== "package" && x.name !== "scan"), { name: "scan" as const, id }] }));
  // Mid-check: nothing to do down here yet, so no empty bar.
  if (!later && !unscanned && !done && left > 0) return null;

  return (
    <ActionBar>
      {later ? (
        <Button size="lg" variant="outline" className="w-full" onClick={a.openLoad}>
          Back to this pickup
        </Button>
      ) : unscanned ? (
        <Button size="lg" className="w-full" onClick={() => toScanner(current.id)}>
          <ScanLine /> Scan packing slip
        </Button>
      ) : done ? (
        <SlideToConfirm label="Loaded · start route" onConfirm={a.confirmPickup} />
      ) : left > 0 ? null : open && open.id !== current?.id ? (
        <Button size="lg" className="w-full" onClick={() => openPackage(open.id)}>
          <span className="truncate">
            Finish checking {open.seq}. {open.name}
          </span>
        </Button>
      ) : (
        toScan && (
          <Button size="lg" className="w-full" onClick={() => toScanner()}>
            <ScanLine /> Scan next packing slip
          </Button>
        )
      )}
    </ActionBar>
  );
}

/**
 * One order, opened by scanning its slip or from the list on Home. Hot / cold is shown once, for the whole order
 * (it matches the packaging type). Items: one row per person's meal, or each family-style main with its sides.
 */
export function PackageScreen({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const sfkVan = VEHICLES.find((v) => v.id === vehicleOf(s, stop.id))!;
  const later = runOf(stop) > s.run;
  const locked = later || !s.scanned[id];
  const done = checkedCount(s, stop);
  const total = stop.bags.length;
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [info, setInfo] = useState(false); // why scan first: behind the "i", not a banner
  const big = total > 8; // the "to check" filter only earns its space on long lists

  const shown = stop.bags.filter((b) => !onlyLeft || !s.bagChecks[b.id]);
  // Family style: each main with its sides, in the order the kitchen packed them.
  const groups = shown.reduce<{ name?: string; items: Bag[] }[]>((acc, b) => {
    const g = acc.find((x) => x.name === b.group);
    if (g) g.items.push(b);
    else acc.push({ name: b.group, items: [b] });
    return acc;
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={`${stop.seq}. ${stop.name}`}
        subtitle={`${stop.orderNo} · ${fmtWindow(stop.windowStart, stop.windowEnd)}`}
        onBack={a.back}
        right={
          locked && !later ? (
            <span className="relative">
              <button aria-label="Why scan the packing slip" aria-expanded={info} onClick={() => setInfo((v) => !v)} className={cn("grid size-10 place-items-center rounded-full hover:bg-teal-wash", info && "bg-teal-wash text-teal-deep")}>
                <Info className="size-5" />
              </button>
              {info && (
                <>
                  {/* Tap anywhere else to close. */}
                  <button aria-label="Close" onClick={() => setInfo(false)} className="fixed inset-0 z-30 cursor-default" />
                  <div role="tooltip" className="anim-fade absolute right-0 top-full z-40 mt-2 flex w-[260px] gap-2.5 rounded-2xl border border-border bg-card p-3.5 text-[13px] leading-snug text-foreground shadow-raised">
                    <ScanLine className="mt-0.5 size-4 shrink-0 text-teal" />
                    <span>
                      <b className="font-semibold">Scan this order's packing slip</b> to start checking. It confirms you have the right order.
                    </span>
                  </div>
                </>
              )}
            </span>
          ) : undefined
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Card className="overflow-hidden">
          {/* The order at a glance: hot / cold for the whole order (from its packaging), then what kind of order it is. */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <OrderTemp stop={stop} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{stop.orderType}</span>
              <span className="nums block truncate text-[13px] text-muted-foreground">
                {orderSize(stop)} · {stop.packaging}
              </span>
            </span>
            {sfkVan.owner === "sfk" && (
              <Chip className="border border-teal/30 text-teal-deep">
                <Truck /> {sfkVan.name}
              </Chip>
            )}
          </div>
          {!locked && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="nums text-[15px] font-semibold">
                  {done} <span className="text-muted-foreground">of {total} checked</span>
                </span>
                {/* Saved on every tap: leaving this screen never loses progress. */}
                <span className="flex items-center gap-1 text-[12px] font-semibold text-success">
                  <CheckCheck className="size-3.5" /> Saved
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>

        {later ? (
          <Banner icon={<Lock />}>
            <b className="font-semibold">For kitchen pickup {runOf(stop)}</b> · ready {fmtTime(KITCHEN_READY[runOf(stop)] ?? KITCHEN.readyAt)}. Load it then, not now.
          </Banner>
        ) : null}

        {big && !locked && (
          <div className="flex gap-2" role="group" aria-label="Show">
              {(
                [
                  [false, `All ${total}`],
                  [true, `To check ${total - done}`],
                ] as const
              ).map(([v, label]) => (
                <button key={label} onClick={() => setOnlyLeft(v)} aria-pressed={onlyLeft === v} className={cn("nums h-10 rounded-full border px-4 text-[13px] font-semibold", onlyLeft === v ? "border-teal-deep bg-teal-deep text-white" : "border-control text-foreground")}>
                  {label}
                </button>
              ))}
          </div>
        )}

        {/* Home-style list: grey title band(s), white rows with hairlines, edge to edge (no box). */}
        <div className="-mx-4 border-y border-border bg-white">
          {!groups.some((g) => g.name) && (
            <div className="nums border-b border-border bg-muted/60 px-4 py-2 text-[13px] font-semibold text-muted-foreground">{stop.customerType === "family" ? "What's in it" : `${total} ${total === 1 ? "meal" : "meals"}`}</div>
          )}
          {/* Select all: ticks every item in this order at once (or clears them all when everything is ticked). */}
          {!locked && (
            <button
              role="checkbox"
              aria-checked={done === total ? true : done > 0 ? "mixed" : false}
              onClick={() => a.setOrderLoaded(stop.bags.map((b) => b.id), done !== total)}
              className={cn("flex min-h-[56px] w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors duration-300", done === total && "bg-success-bg")}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", done === total ? "border-success bg-success text-white" : done > 0 ? "border-teal bg-teal text-white" : "border-teal bg-teal-wash")}>
                {done === total ? <Check className="size-4" strokeWidth={3} /> : done > 0 && <Minus className="size-4" strokeWidth={3} />}
              </span>
              <span className="flex-1 text-[15px] font-semibold">{done === total ? "Clear all" : "Select all"}</span>
              <span className="nums shrink-0 text-[13px] font-semibold text-muted-foreground">
                {done}/{total}
              </span>
            </button>
          )}
          {groups.length === 0 && <p className="px-4 py-6 text-center text-[15px] text-muted-foreground">Everything's checked</p>}
          {groups.map((g, i) => (
            <div key={g.name ?? "items"} className={i > 0 ? "border-t border-border" : undefined}>
              {g.name && (
                <div className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/60 px-4 py-2 text-muted-foreground">
                  <span className="truncate text-[13px] font-semibold">{g.name}</span>
                  <span className="nums shrink-0 text-[12px] font-semibold text-muted-foreground">
                    {stop.bags.filter((b) => b.group === g.name && s.bagChecks[b.id]).length}/{stop.bags.filter((b) => b.group === g.name).length}
                  </span>
                </div>
              )}
              <ul className="divide-y divide-border">
                {g.items.map((b) => {
                  const on = !!s.bagChecks[b.id];
                  return (
                    <li key={b.id}>
                      {locked ? (
                        // Before the slip is scanned: just what's in the order, no checkboxes yet.
                        <div className="flex min-h-[60px] w-full items-center px-4 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{b.label}</span>
                            <span className="block truncate text-[13px] text-muted-foreground">{b.detail}</span>
                          </span>
                        </div>
                      ) : (
                        <button role="checkbox" aria-checked={on} onClick={() => a.toggleBag(b.id)} className={cn("flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-300", on && "bg-success-bg")}>
                          <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-success bg-success text-white" : "border-teal bg-teal-wash")}>{on && <Check className="size-4" strokeWidth={3} />}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[15px] font-semibold", on && "text-muted-foreground")}>{b.label}</span>
                            <span className="block truncate text-[13px] text-muted-foreground">{b.detail}</span>
                          </span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <LoadActions current={stop} />
    </div>
  );
}

/** "24 meals" for individual-meal orders, "Serves 20" for family style. Never a bag count. */
export function orderSize(stop: Stop) {
  return stop.customerType === "family" ? `Serves ${stop.meals}` : `${stop.meals} ${stop.meals === 1 ? "meal" : "meals"}`;
}

/** Hot / cold for the whole order, shown once at the top of it. Matches the packaging type. */
export function OrderTemp({ stop, size = "lg" }: { stop: Stop; size?: "sm" | "lg" }) {
  const temps = tempsOf(stop);
  const hot = temps.includes("HOT");
  return (
    <span aria-label={temps.map((t) => (t === "HOT" ? "Hot" : "Cold")).join(" and ")} className={cn("grid shrink-0 place-items-center rounded-full", size === "lg" ? "size-11" : "size-9", hot ? "bg-coral-soft text-coral" : "bg-info-bg text-info")}>
      <span className="flex">
        {temps.map((t) => (t === "HOT" ? <Flame key={t} className={size === "lg" ? "size-5" : "size-4"} strokeWidth={2.2} /> : <Snowflake key={t} className={size === "lg" ? "size-5" : "size-4"} strokeWidth={2.2} />))}
      </span>
    </span>
  );
}

function Banner({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-info-border bg-info-bg p-3 text-[13px] text-info [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
      {icon}
      <span>{children}</span>
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
        <Banner icon={<Info />}>Kitchen has this order ready at the dispatch dock. Keep hot and cold in separate carriers.</Banner>

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
