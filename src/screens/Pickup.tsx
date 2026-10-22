import { useState, type ReactNode } from "react";
import { Check, CheckCheck, ChevronDown, Flame, Info, Lock, Minus, ScanLine, Snowflake, Truck } from "lucide-react";
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
 * Individual-meal orders can also be counted By dish ("9× Lemon chicken rice bowl"), with the names one tap away.
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
  // Oct 22 2026, like the kitchen board's Order / Item views: count by dish ("3 lemon chicken bowls") or go name by name.
  // Both views tick the same meals, so the driver can switch back and forth without losing anything.
  const [view, setViewState] = useState<"name" | "dish">(lastView);
  const setView = (v: "name" | "dish") => setViewState((lastView = v));
  const [openDish, setOpenDish] = useState<string | null>(null);
  const [info, setInfo] = useState(false); // why scan first: behind the "i", not a banner
  const big = total > 8; // the "to check" filter only earns its space on long lists

  const shown = stop.bags.filter((b) => !onlyLeft || !s.bagChecks[b.id]);
  // Individual-meal orders: one dish per meal (the detail line), modifiers kept ("no cilantro" is its own row so it's counted apart).
  // Most first, like a kitchen tally. Only offered when some dish repeats; family style is already grouped by main.
  const dishes = Object.values(
    stop.bags.reduce<Record<string, { name: string; items: Bag[] }>>((acc, b) => {
      (acc[b.detail] ??= { name: b.detail, items: [] }).items.push(b);
      return acc;
    }, {}),
  ).sort((x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name));
  const canGroup = stop.customerType !== "family" && dishes.length < total;
  const byDish = canGroup && view === "dish" && !locked; // before the scan it's just the plain list
  // Family style: each main with its sides, in the order the kitchen packed them.
  const groups = shown.reduce<{ name?: string; items: Bag[] }[]>((acc, b) => {
    const g = acc.find((x) => x.name === b.group);
    if (g) g.items.push(b);
    else acc.push({ name: b.group, items: [b] });
    return acc;
  }, []);

  return (
    // White page (Oct 22 2026), with a white top bar and status bar to match.
    <div className="flex h-full flex-col bg-white">
      <TopBar
        title={`${stop.seq}. ${stop.name}`}
        subtitle={`${stop.orderNo} · ${fmtWindow(stop.windowStart, stop.windowEnd)}`}
        onBack={a.back}
        tone="mint"
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
        {/* Same teal stroke and soft shadow as Home's Dock / Ready in card. */}
        <Card className="overflow-hidden !border-teal/25 !shadow-[0_1px_6px_rgba(0,64,69,0.05)]">
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
                  {done} <span className="text-muted-foreground">of {total} loaded</span>
                </span>
                {/* Saved on every tap: leaving this screen never loses progress. */}
                <span className="flex items-center gap-1 text-[13px] font-semibold text-success">
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

        {/* By dish / By name on the left (By dish first: it's the default), All / To load on the right: the same compact tabs as the Schedule filter. */}
        {(canGroup || big) && !locked && (
          <div className="flex items-center justify-between gap-2">
            {canGroup ? (
              <Segmented label="Group by" value={view} onChange={setView} options={[["dish", "By dish"], ["name", "By name"]]} />
            ) : (
              <span />
            )}
            {big && <Segmented label="Show" value={onlyLeft ? "left" : "all"} onChange={(v) => setOnlyLeft(v === "left")} options={[["all", `All ${total}`], ["left", `To load ${total - done}`]]} />}
          </div>
        )}

        {/* White list with hairlines, edge to edge (no box); the Select all row and family-style group headers are grey (Oct 22 2026). */}
        <div className="-mx-4 border-y border-border bg-white">
          {/* Select all: ticks every item in this order at once (or clears them all when everything is ticked).
              The one grey band in the list (Schedule's day-band grey), so it reads as a header, not an item. */}
          {!locked && (
            <button
              role="checkbox"
              aria-checked={done === total ? true : done > 0 ? "mixed" : false}
              onClick={() => a.setOrderLoaded(stop.bags.map((b) => b.id), done !== total)}
              className={cn("flex min-h-[56px] w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors duration-300", done === total ? "bg-success-bg" : "bg-muted/60")}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", done === total ? "border-success bg-success text-white" : done > 0 ? "border-teal bg-teal text-white" : "border-teal bg-white")}>
                {done === total ? <Check className="size-4" strokeWidth={3} /> : done > 0 && <Minus className="size-4" strokeWidth={3} />}
              </span>
              <span className="flex-1 text-[15px] font-semibold">{done === total ? "Clear all" : "Select all"}</span>
              <span className="nums shrink-0 text-[13px] font-semibold text-muted-foreground">
                {done}/{total}
              </span>
            </button>
          )}
          {groups.length === 0 && <p className="px-4 py-6 text-center text-[15px] text-muted-foreground">Everything's loaded</p>}
          {byDish ? (
            <ul className="divide-y divide-border">
              {dishes
                .filter((d) => !onlyLeft || d.items.some((b) => !s.bagChecks[b.id]))
                .map((d) => {
                  const got = d.items.filter((b) => s.bagChecks[b.id]).length;
                  const all = got === d.items.length;
                  const open = openDish === d.name;
                  return (
                    <li key={d.name}>
                      <div className={cn("flex min-h-[64px] items-stretch transition-colors duration-300", all && "bg-success-bg")}>
                        {/* Tap the dish: all of them are counted (or cleared). */}
                        <button
                          role="checkbox"
                          aria-checked={all ? true : got > 0 ? "mixed" : false}
                          onClick={() => a.setOrderLoaded(d.items.map((b) => b.id), !all)}
                          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left"
                        >
                          <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", all ? "border-success bg-success text-white" : got > 0 ? "border-teal bg-teal text-white" : "border-teal bg-teal-wash")}>
                            {all ? <Check className="size-4" strokeWidth={3} /> : got > 0 && <Minus className="size-4" strokeWidth={3} />}
                          </span>
                          {/* The count first and big: it's what the driver matches against the shelf. */}
                          <span className={cn("nums w-9 shrink-0 text-xl font-bold leading-none", all ? "text-muted-foreground" : "text-teal-deep")}>{d.items.length}×</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[15px] font-semibold", all && "text-muted-foreground")}>{d.name}</span>
                            <span className="nums block truncate text-[13px] text-muted-foreground">{got > 0 && !all ? `${got} of ${d.items.length} · ` : ""}{d.items.map((b) => b.label.split(" ")[0]).join(", ")}</span>
                          </span>
                        </button>
                        {/* Names inside, to tick one by one when only some are there. */}
                        <button onClick={() => setOpenDish(open ? null : d.name)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} names for ${d.name}`} className="grid w-12 shrink-0 place-items-center text-muted-foreground">
                          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
                        </button>
                      </div>
                      {open && (
                        <ul className="anim-fade divide-y divide-border border-t border-border bg-muted/30">
                          {d.items.map((b) => {
                            const on = !!s.bagChecks[b.id];
                            return (
                              <li key={b.id}>
                                <button role="checkbox" aria-checked={on} onClick={() => a.toggleBag(b.id)} className={cn("flex min-h-[52px] w-full items-center gap-3 py-2 pl-[60px] pr-4 text-left transition-colors duration-300", on && "bg-success-bg")}>
                                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-success bg-success text-white" : "border-teal bg-white")}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                                  <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", on && "text-muted-foreground")}>{b.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          ) : groups.map((g, i) => (
            <div key={g.name ?? "items"} className={i > 0 ? "border-t border-border" : undefined}>
              {g.name && (
                <div className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/60 px-4 py-2 text-muted-foreground">
                  <span className="truncate text-[13px] font-semibold">{g.name}</span>
                  <span className="nums shrink-0 text-[13px] font-semibold text-muted-foreground">
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

/** The last grouping the driver picked, kept while the app is open so every order opens the same way. Starts on By dish (Oct 22 2026). */
let lastView: "name" | "dish" = "dish";

/** Compact segmented tabs (grey track, white raised pill), the same look as the Schedule filter. */
function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-muted p-1">
      {options.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)} className={cn("nums flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold", value === v ? "bg-card text-teal-deep shadow-card" : "text-muted-foreground")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Order size in one unit for every order (Oct 22 2026): "Serves 24" for 24 individual meals, "Serves 20" for family style,
 * so a list never mixes "meals" and "serves". Never a bag or container count.
 */
export function orderSize(stop: Stop) {
  return `Serves ${stop.meals}`;
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
