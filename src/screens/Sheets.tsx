import { PdfPages } from "../components/PdfView";
import { useRef, useState } from "react";
import { AlertTriangle, Camera, Check, ClipboardList, X, CheckCircle2, ChefHat, Clock, Recycle, Share2, Navigation, BadgeCheck, Building2, Download, Headphones, MapPin, MessageSquare, Phone, ZoomIn, ZoomOut } from "lucide-react";
import { findStop, isLoaded, liveRoute, needsKitchenRun, stopSteps, useApp, nextStop, useT } from "../store";
import { DISPATCH, KITCHEN, KITCHEN_READY, runOf, ROUTE_ISO, SETTINGS, SFK_TEAM, WEEKDAYS, fmtHours, fmtTime, fmtWindow, weekdayOf, type Contact } from "../data/route";
import { Button, cn, IconChip, Sheet, StepTrack, StopAvatar, SfkMark } from "../components/ui";
import { dishOf, optionsOf, orderSize } from "./Pickup";
import { collectLeft, ContactRow, StopInstructions } from "./StopDetail";
import { HandoffPicker } from "./Proof";
import { PermissionsSheet } from "./Onboarding";
import accessPhoto from "../assets/access-photo.jpg";
import { daysCovered, daysOf, inHours, rangeLabel } from "./Schedule";

export function Sheets() {
  const { s } = useApp();
  if (!s.sheet) return null;
  switch (s.sheet.name) {
    case "permissions":
      return <PermissionsSheet />;
    case "contact":
      return <ContactSheet id={s.sheet.id} />;
    case "people":
      return <PeopleSheet id={s.sheet.id} who={s.sheet.who} />;
    case "dropCheck":
      return <DropCheckSheet id={s.sheet.id} />;
    case "setup":
      return <SetupSheet id={s.sheet.id} />;
    case "collect":
      return <CollectSheet id={s.sheet.id} at={s.sheet.at} />;
    case "photo":
      return <PhotoSheet id={s.sheet.id} />;
    case "photoFull":
      return <PhotoFull id={s.sheet.id} />;
    case "pdf":
      return <PdfFull id={s.sheet.id} />;
    case "maps":
      return <MapsSheet id={s.sheet.id} />;
    case "instructions":
      return <InstructionsSheet id={s.sheet.id} />;
    case "delivered":
      return <DeliveredSheet id={s.sheet.id} />;
    case "startRoute":
      return <StartRouteSheet id={s.sheet.id} />;
    case "startShift":
      return <StartShiftSheet />;
    case "endShift":
      return <EndShiftSheet />;
    case "claimed":
      return <ClaimedSheet id={s.sheet.id} />;
    case "decline":
      return <DeclineSheet id={s.sheet.id} />;
    case "acceptAll":
      return <AcceptAllSheet ids={s.sheet.ids} />;
    case "openHours":
      return <OpenHoursSheet />;
    case "laterPickup":
      return <LaterPickupSheet id={s.sheet.id} />;
    case "skip":
      return <SkipSheet id={s.sheet.id} />;
    case "packingList":
      return <PackingListSheet id={s.sheet.id} />;
    case "language":
      return <LanguageSheet />;
    case "update":
      return <UpdateSheet />;
  }
}

/** Full-screen photo viewer: black backdrop, photo fitted to the screen, tap anywhere or X to close. */
function PhotoFull({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  return (
    <div role="dialog" aria-label="Entrance photo" onClick={a.closeSheet} className="anim-fade absolute inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pb-2 pt-14 text-white">
        <span className="truncate text-[15px] font-semibold">{stop.name} · entrance</span>
        <button onClick={a.closeSheet} aria-label="Close photo" className="grid size-11 place-items-center rounded-full bg-white/15">
          <X className="size-5" />
        </button>
      </div>
      <div className="grid flex-1 place-items-center px-2 pb-10">
        <img src={accessPhoto} alt={`Entrance at ${stop.addressLine1}`} className="max-h-full w-full object-contain" />
      </div>
    </div>
  );
}

/**
 * Oct 27 2026: the stop's Delivery details PDF, full screen inside the app (no jump to a PDF app). Scroll for more
 * pages; X closes. "Open as PDF" is there for sharing or zooming in the phone's own viewer.
 */
function PdfFull({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const [zoom, setZoom] = useState(2); // opens zoomed in, so the text is readable straight away
  const pan = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  return (
    <div role="dialog" aria-label={t("Delivery details")} className="anim-fade absolute inset-0 z-[60] flex flex-col bg-muted">
      <div className="flex items-center gap-3 border-b border-border bg-white px-4 pb-2 pt-14">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-bold">{t("Delivery details")}</div>
          <div className="truncate text-2xs text-muted-foreground">{stop.name}</div>
        </div>
        <a href={stop.detailsPdf} target="_blank" rel="noreferrer" className="flex h-11 items-center px-2 text-[13px] font-semibold text-teal-deep">
          {t("Open as PDF")}
        </a>
        <button onClick={a.closeSheet} aria-label="Close" className="grid size-11 place-items-center rounded-full bg-muted">
          <X className="size-5" />
        </button>
      </div>
      {/* Oct 27 2026: drag the page around in any direction (finger, or mouse in the prototype); double-tap to zoom. */}
      <div
        ref={pan}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return; // touch already scrolls natively
          drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
          e.currentTarget.scrollTop = d.top - (e.clientY - d.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => setZoom(zoom === 1 ? 2 : 1)}
        className={cn("flex-1 touch-pan-x touch-pan-y select-none overflow-auto overscroll-contain p-3", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
      >
        {stop.detailsPdf && <PdfPages url={stop.detailsPdf} zoom={zoom} className="[&>canvas]:pointer-events-none [&>canvas]:rounded-lg [&>canvas]:shadow-card" />}
      </div>
      {/* A whole page at phone width is small print: one tap zooms in (scroll sideways), one tap back to the full page. */}
      <button onClick={() => setZoom(zoom === 1 ? 2 : 1)} className="absolute bottom-8 right-4 flex h-12 items-center gap-2 rounded-full bg-teal-deep px-5 text-[15px] font-semibold text-white shadow-raised" data-dark-surface>
        {zoom === 1 ? <ZoomIn className="size-5" /> : <ZoomOut className="size-5" />} {zoom === 1 ? t("Zoom in") : t("Full page")}
      </button>
    </div>
  );
}

/** The stop's parking & access photo, with the "Get in" note under it. */
function PhotoSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  return (
    <Sheet title={t("Get in")} onClose={a.closeSheet}>
      <img src={accessPhoto} alt={`Entrance at ${stop.addressLine1}`} className="-mt-1 block aspect-[11/6] w-full rounded-xl object-cover" />
      <p className="mt-3 text-[15px] leading-snug">{stop.buildingNotes}</p>
    </Sheet>
  );
}

/** #11 Setup on arrival, as a dialog: tick every step, then "Take delivery photo" unlocks and opens the camera. */
/**
 * Oct 26 2026: on arrival, before setup, the driver ticks off every item of the order as they put it down, so nothing
 * is left in the van. Family style keeps the kitchen's groups (each main with its sides). Then setup (if the order
 * has one), else the delivery photo.
 */
function DropCheckSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const done = st.dropDone ?? {};
  const left = stop.bags.filter((b) => !done[b.id]).length;
  const all = left === 0;
  const toggle = (bid: string) => a.updateStop(id, { dropDone: { ...done, [bid]: !done[bid] } });
  const groups = stop.bags.reduce<{ name?: string; items: typeof stop.bags }[]>((acc, b) => {
    const g = acc.find((x) => x.name === b.group);
    if (g) g.items.push(b);
    else acc.push({ name: b.group, items: [b] });
    return acc;
  }, []);
  // Oct 26 2026: individual meals are put down as items, not by name: one row per dish ("9× Lemon chicken rice bowl"),
  // most first, ticking every meal of that dish. Options ("no cilantro") show under the dish with whose they are.
  const dishes = Object.values(
    stop.bags.reduce<Record<string, { name: string; items: typeof stop.bags }>>((acc, b) => {
      (acc[dishOf(b)] ??= { name: dishOf(b), items: [] }).items.push(b);
      return acc;
    }, {}),
  ).sort((x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name));
  const byDish = stop.customerType !== "family";
  const next = afterStep(s, id);
  const goTo = useGoTo();
  const handoff = st.handoff ?? "handed"; // Oct 27 2026: "Handed to someone" by default
  const needsName = handoff === "handed" && !st.receivedBy?.trim();
  return (
    <Sheet title={t("Check drop-off")} onClose={a.closeSheet}>
      <p className="nums -mt-3 mb-4 text-[13px] text-muted-foreground">
        How you're leaving it, then tick each item as you put it down
      </p>
      {/* Same choice as Proof of delivery (one answer on the stop). */}
      <div className="mb-4">
        <HandoffPicker id={id} />
      </div>
      <p className="nums mb-2 text-[13px] font-semibold text-muted-foreground">
        {stop.bags.length - left} of {stop.bags.length} items
      </p>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border-strong bg-card">
        <button
          role="checkbox"
          aria-checked={all}
          onClick={() => a.updateStop(id, { dropDone: Object.fromEntries(stop.bags.map((b) => [b.id, !all])) })}
          className="flex min-h-12 w-full items-center gap-3 bg-muted/60 px-4 text-left text-[15px] font-semibold"
        >
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2", all ? "border-success bg-success text-white" : "border-teal bg-white")}>{all && <Check className="size-4" strokeWidth={3} />}</span>
          All {stop.bags.length} items
        </button>
        {byDish
          ? dishes.map((d) => {
              const on = d.items.every((b) => done[b.id]);
              const options = d.items.filter((b) => optionsOf(b)).map((b) => `${optionsOf(b)} (${b.label.split(" ")[0]})`);
              return (
                <button
                  key={d.name}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => a.updateStop(id, { dropDone: { ...done, ...Object.fromEntries(d.items.map((b) => [b.id, !on])) } })}
                  className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", on && "bg-success-bg")}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-success bg-success text-white" : "border-teal bg-teal-wash")}>
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className={cn("nums w-9 shrink-0 text-xl font-bold leading-none", on ? "text-muted-foreground" : "text-teal-deep")}>{d.items.length}×</span>
                  <span className="min-w-0">
                    <span className={cn("block text-[15px] font-semibold leading-snug", on && "text-muted-foreground")}>{d.name}</span>
                    {options.length > 0 && <span className="block text-[13px] font-semibold leading-snug text-teal-deep">{options.join(", ")}</span>}
                  </span>
                </button>
              );
            })
          : groups.map((g, gi) => (
              <div key={g.name ?? gi} className="divide-y divide-border">
                {g.name && <p className="bg-muted/40 px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{g.name}</p>}
                {g.items.map((b) => (
                  <button
                    key={b.id}
                    role="checkbox"
                    aria-checked={!!done[b.id]}
                    onClick={() => toggle(b.id)}
                    className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", done[b.id] && "bg-success-bg")}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", done[b.id] ? "border-success bg-success text-white" : "border-teal bg-teal-wash")}>
                      {done[b.id] && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-[15px] font-medium leading-snug", done[b.id] && "text-muted-foreground")}>{b.label}</span>
                      {b.detail && <span className="block text-[13px] leading-snug text-muted-foreground">{b.detail}</span>}
                    </span>
                  </button>
                ))}
              </div>
          ))}
      </div>
      {/* Stuck to the bottom of the sheet while the item list scrolls. */}
      <div className="sticky -bottom-8 -mx-5 -mb-8 mt-2 bg-card px-5 pb-8 pt-3">
        <Button
          size="lg"
          className="w-full"
          disabled={!all || needsName}
          onClick={() => {
            if (!st.handoff) a.updateStop(id, { handoff });
            goTo(next);
          }}
        >
          <NextLabel next={next} />
          {!all ? ` · ${left} left` : needsName ? " · add who got it" : ""}
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * Oct 26 2026: the delivery steps on arrival, in order: Check drop-off → Setup (if any) → Collect reusables (if any,
 * one sheet per order) → delivery photo → Proof of delivery. `done` is the step being finished now.
 */
type Next = { name: "setup"; id: string } | { name: "collect"; id: string; at: string } | { name: "camera"; id: string };
function afterStep(s: ReturnType<typeof useApp>["s"], id: string, done?: "setup" | string): Next {
  const stop = findStop(s, id);
  const st = s.stops[id];
  if (done !== "setup" && !done && stop.setup?.some((_, i) => !st.setupDone?.[i])) return { name: "setup", id };
  const more = collectLeft(s, stop).filter((x) => x !== done);
  return more.length ? { name: "collect", id: more[0], at: id } : { name: "camera", id };
}
function NextLabel({ next }: { next: Next }) {
  const t = useT();
  return next.name === "setup" ? (
    <>
      <ClipboardList /> {t("Start setup")}
    </>
  ) : next.name === "collect" ? (
    <>
      <Recycle /> {t("Collect reusables")}
    </>
  ) : (
    <>
      <Camera /> {t("Take delivery photo")}
    </>
  );
}
function useGoTo() {
  const { a } = useApp();
  return (next: Next) => (next.name === "camera" ? a.jump((p) => ({ sheet: null, stack: [...p.stack, { name: "camera" as const, id: next.id }] })) : a.openSheet(next));
}

/**
 * Oct 26 2026: reusables collected during a delivery, as a bottom sheet in the arrival steps (the full Collect screen
 * stays for pickup-only stops). What to collect, then Collected / Not collected with a note (required when not).
 * The delivery photo comes next and shows what came back.
 */
function CollectSheet({ id, at }: { id: string; at: string }) {
  const { s, a } = useApp();
  const t = useT();
  const goTo = useGoTo();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const [result, setResult] = useState<"collected" | "not_collected" | null>(st.collectDraft?.result ?? st.collectResult ?? null);
  const [note, setNote] = useState(st.collectDraft?.note ?? st.collectNote ?? "");
  const noteOk = result !== "not_collected" || note.trim().length > 0;
  const next = afterStep(s, at, id);
  const where = stop.returns ?? stop.dropoffNotes;
  return (
    <Sheet title={t("Collect reusables")} onClose={a.closeSheet}>
      {stop.fromOrder && (
        <p className="nums -mt-3 mb-4 text-[13px] text-muted-foreground">
          From order {stop.fromOrder.orderNo} · {stop.fromOrder.date}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-card">
        <ul className="divide-y divide-border">
          {(stop.reusables ?? []).map((x) => (
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
      </div>
      <div role="radiogroup" className="mt-4 grid grid-cols-2 gap-2.5">
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
      {result === "not_collected" && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          autoFocus
          placeholder="What happened? e.g. nothing by the pantry door"
          aria-label="Note for dispatch"
          className="mt-3 w-full resize-none rounded-xl border border-border-strong bg-card px-3 py-2.5 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
      )}
      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={!result || !noteOk}
        onClick={() => {
          a.collectReusables(id, result!, 0, note.trim() || undefined);
          goTo(next);
        }}
      >
        <NextLabel next={next} />
      </Button>
    </Sheet>
  );
}

function SetupSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const steps = stop.setup ?? [];
  const done = steps.map((_, i) => !!st.setupDone?.[i]);
  const left = done.filter((d) => !d).length;
  const next = afterStep(s, id, "setup");
  const goTo = useGoTo();
  return (
    <Sheet title={t("Setup instructions")} onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-[13px] text-muted-foreground">{stop.guestReadyTime ? `Done by ${fmtTime(stop.guestReadyTime)}` : "Before you take the photo"}</p>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border-strong bg-card">
        {steps.map((step, i) => (
          <button
            key={step}
            role="checkbox"
            aria-checked={done[i]}
            onClick={() => {
              const next = [...done];
              next[i] = !next[i];
              a.updateStop(id, { setupDone: next });
            }}
            className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors", done[i] && "bg-success-bg")}
          >
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors", done[i] ? "border-success bg-success text-white" : "border-teal bg-teal-wash")}>
              {done[i] && <Check className="size-4" strokeWidth={3} />}
            </span>
            <span className={cn("text-[15px] font-medium leading-snug", done[i] && "text-muted-foreground")}>{step}</span>
          </button>
        ))}
      </div>
      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={left > 0}
        onClick={() => goTo(next)}
      >
        <NextLabel next={next} />
        {left > 0 && ` · ${left} left`}
      </Button>
    </Sheet>
  );
}

/** "Customer" or "Dispatch" on a stop (Oct 26 2026: was "SFK Team"): the people to call, in the same rows as the stop's contact card. */
function PeopleSheet({ id, who }: { id: string; who: "customer" | "sfk" | "all" }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const customer: (Contact & { tag: string })[] = [{ ...stop.contact, tag: t("Site contact") }, ...(stop.backupContact ? [{ ...stop.backupContact, tag: t("Backup contact") }] : [])];
  const sfk: (Contact & { tag: string })[] = SFK_TEAM.map((p) => ({ ...p, tag: t(p.tag) }));
  // Oct 26 2026: the stop's one "Call" button shows both groups, customer first, each under its own heading.
  const groups: [string, (Contact & { tag: string })[]][] = who === "customer" ? [[t("Customer"), customer]] : who === "sfk" ? [[t("Dispatch"), sfk]] : [[t("Customer"), customer], [t("Dispatch"), sfk]];
  return (
    <Sheet title={who === "all" ? t("Who do you want to call?") : groups[0][0]} onClose={a.closeSheet}>
      <p className="-mt-2 mb-4 text-[15px] leading-snug text-muted-foreground">Calls go through an SFK number, so your personal number stays private.</p>
      {groups.map(([title, people]) => (
        <div key={title} className="mb-6 last:mb-0">
          {/* Oct 26 2026: each group under a full-width grey band (Schedule's day-band grey) with who they are on the right,
              so Customer and Dispatch read as two separate lists, not one. */}
          {who === "all" && (
            <div className="-mx-5 flex items-center gap-2 border-t border-border bg-muted/60 px-5 py-2.5">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", title === t("Dispatch") ? "bg-teal text-white" : "border border-teal/30 bg-white text-teal-deep")}>
                {title === t("Dispatch") ? <Headphones className="size-4" /> : <Building2 className="size-4" />}
              </span>
              <span className="flex-1 text-[15px] font-bold text-teal-deep">{title}</span>
              <span className="truncate text-[13px] font-semibold text-muted-foreground">{title === t("Dispatch") ? "SFK team" : stop.name}</span>
            </div>
          )}
          {/* Plain list, edge to edge: dividers only (-mx-5 cancels the sheet padding; rows keep px-5). */}
          <div className="-mx-5 divide-y divide-border border-y border-border [&>div]:px-5">
            {people.map((p) => (
              <ContactRow key={p.name} c={p} tag={p.tag} />
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

/**
 * #14 Tap to call the site contact, the backup contact (#2) or dispatch. Calls go through an SFK number.
 * Texting customers is in the scope's parking lot, so quick messages go to dispatch in-app (#6).
 */
function ContactSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const people: (Contact & { tag: string })[] = [
    { ...stop.contact, tag: t("Site contact") },
    ...(stop.backupContact ? [{ ...stop.backupContact, tag: t("Backup contact") }] : []),
    { ...DISPATCH, tag: t("Dispatch") },
  ];
  return (
    <Sheet title={t("Call")} onClose={a.closeSheet}>
      <p className="-mt-2 mb-4 text-[15px] leading-snug text-muted-foreground">Calls go through an SFK number, so your personal number stays private.</p>
      <div className="space-y-2">
        {people.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              a.closeSheet();
              a.toast(`Calling ${p.name}…`);
            }}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-control px-4 text-left active:bg-teal-wash"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-2xs font-semibold text-muted-foreground">{p.tag}</span>
              <span className="block truncate text-[15px] font-semibold">{p.name}</span>
            </span>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal text-white">
              {p.tag === t("Dispatch") ? <Headphones className="size-5" /> : <Phone className="size-5" />}
            </span>
          </button>
        ))}
      </div>
      <div className="text-overline mb-2 mt-5">{t("Message dispatch")}</div>
      <div className="flex flex-wrap gap-2">
        {["I'm here, heading up now", "Running about 10 min late", "Can't find the entrance"].map((m) => (
          <button
            key={m}
            onClick={() => {
              a.closeSheet();
              a.sendToDispatch(`${stop.name}: ${m}`);
            }}
            className="flex h-11 items-center gap-1.5 rounded-full border border-control px-3.5 text-[13px] font-semibold"
          >
            <MessageSquare className="size-3.5 text-teal" /> {m}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Parking, access and the drop-off note, opened from navigation without leaving it (review Oct 14 2026). */
function InstructionsSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  return (
    <Sheet title={`How to deliver · ${stop.name}`} onClose={a.closeSheet}>
      {/* -mx-5 cancels the sheet's side padding so the rows (and the yellow drop-off row) run edge to edge. */}
      <div className="-mx-5 max-h-[60vh] overflow-y-auto">
        <StopInstructions stop={stop} arrived={false} plain />
      </div>
    </Sheet>
  );
}

function MapsSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  return (
    <Sheet title="Directions" onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-2xs text-muted-foreground">
        {stop.addressLine1}, {stop.city}. SFK keeps sharing your location in the background.
      </p>
      <div className="space-y-2">
        {["Google Maps"].map((m) => (
          <button key={m} onClick={() => { a.closeSheet(); a.toast(`Opening ${m}…`); }} className="flex w-full items-center gap-3 rounded-xl border border-control p-3 text-left text-[15px] font-semibold">
            <MapPin className="size-5 text-teal" /> {m}
            <span className="ml-auto text-2xs font-semibold text-muted-foreground">Handles traffic, turn by turn</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function DeliveredSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const onTime = st.deliveredAt! <= stop.windowEnd;
  const next = nextStop(s);
  return (
    <Sheet onClose={a.closeSheet}>
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white">
          <BadgeCheck className="size-8" />
        </span>
        <h3 className="mt-3 text-xl font-bold tracking-tight">{stop.name} {stop.kind === "pickup" ? "collected" : "delivered"}</h3>
        <p className="nums mt-1 text-[13px] text-muted-foreground">
          {fmtTime(st.deliveredAt!)} · {onTime ? "on time" : `${st.deliveredAt! - stop.windowEnd} min late`} · {stop.kind === "pickup" ? "count and photo sent to dispatch" : `photo sent to ${stop.customerType === "individual" ? "customer" : stop.contact.name}`}
        </p>
        {st.deliveredAway && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-3 py-1 text-2xs font-semibold text-warning">
            <AlertTriangle className="size-3.5" /> Away from the address · dispatch flagged
          </p>
        )}
      </div>
      {next && needsKitchenRun(s, next.id) ? (
        // Next stop is an order claimed after pickup: it has to be loaded first (step 4).
        <Button size="lg" className="mt-5 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "pickup", id: next.id }] }))}>
          <SfkMark className="size-5" /> Back to kitchen for stop {next.seq}
        </Button>
      ) : next && !isLoaded(s, next) ? (
        // Run delivered: the next stop is on the next kitchen pickup, so the driver heads back to load it.
        <Button size="lg" className="mt-5 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }], tab: "map" }))}>
          <SfkMark className="size-5" /> Back to the kitchen
        </Button>
      ) : next ? (
        <Button size="lg" className="mt-5 w-full" onClick={() => a.startNav(next.id)}>
          <Navigation /> <span className="truncate">Go to {next.name}</span>
        </Button>
      ) : (
        <Button size="lg" className="mt-5 w-full" variant="teal" onClick={a.closeSheet}>
          All done
        </Button>
      )}
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        Later
      </Button>
    </Sheet>
  );
}

/** Oct 26 2026: everything's loaded; on Route, start with the first stop. The same layout as the "<name> loaded" sheet. */
function StartRouteSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  return (
    <Sheet onClose={a.closeSheet}>
      <div className="text-center">
        <StopAvatar stop={stop} className="mx-auto size-16 text-xl" />
        <h3 className="mt-3 text-xl font-bold tracking-tight">Start with {stop.name}</h3>
        <p className="nums mt-1 text-[13px] text-muted-foreground">
          All loaded · first stop {fmtWindow(stop.windowStart, stop.windowEnd)}
        </p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={() => a.startNav(id)}>
        <Navigation /> <span className="truncate">Go to {stop.name}</span>
      </Button>
    </Sheet>
  );
}

/** #8 / #5: on duty = live location for dispatch; off duty stops it at once. */
function StartShiftSheet() {
  const { a } = useApp();
  const t = useT();
  return (
    <Sheet title={t("Go on duty?")} onClose={a.closeSheet}>
      <p className="-mt-1 text-[15px] leading-snug text-muted-foreground">{t("Dispatch will see your location while you're on duty. It stops when you go off duty.")}</p>
      <Button size="lg" className="mt-5 w-full" onClick={a.startShift}>
        {t("Go on duty & share location")}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        {t("Not now")}
      </Button>
    </Sheet>
  );
}

function EndShiftSheet() {
  const { s, a } = useApp();
  const t = useT();
  const left = liveRoute(s).filter((x) => s.stops[x.id].status !== "delivered").length;
  return (
    <Sheet title={t("Go off duty?")} onClose={a.closeSheet}>
      {left > 0 ? (
        <p className="-mt-2 rounded-xl border border-warning-border bg-warning-bg p-3 text-[13px] text-warning">
          {left} {t(left === 1 ? "stop left on this route." : "stops left on this route.")} {t("Dispatch will be alerted to reassign them.")}
        </p>
      ) : (
        <p className="-mt-2 text-[13px] text-muted-foreground">{t("Location sharing stops immediately. Dispatch sees you as off duty.")}</p>
      )}
      <Button size="lg" variant={left > 0 ? "danger-outline" : "teal"} className="mt-5 w-full" onClick={a.endShift}>
        {left > 0 ? `${t("Go off duty with")} ${left} ${t("left")}` : t("Go off duty")}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        {t("Keep working")}
      </Button>
    </Sheet>
  );
}

/** A same-day request was accepted: tell the driver where it landed on the route and what to do next. */
function ClaimedSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const kitchenRun = needsKitchenRun(s, id);
  const { steps, current } = stopSteps(s, stop);
  return (
    <Sheet onClose={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "stop", id }] }))}>
      <div className="text-center">
        <IconChip tone="success" className="mx-auto size-16 rounded-full [&_svg]:size-8">
          <CheckCircle2 />
        </IconChip>
        <h3 className="mt-3 text-xl font-bold tracking-tight">Added to your route</h3>
        <p className="nums mt-1 text-[13px] text-muted-foreground">
          {stop.name} is stop {stop.seq} · {fmtWindow(stop.windowStart, stop.windowEnd)}. Dispatch sees you accepted.
        </p>
      </div>
      <StepTrack steps={steps} current={current} className="mt-4" />
      <div className="mt-4 flex gap-2.5 rounded-xl bg-muted p-3 text-[13px]">
        <ChefHat className="mt-0.5 size-4 shrink-0 text-teal" />
        <span>
          {kitchenRun
            ? "Next: head back to the kitchen to load this order."
            : "It's been added to your kitchen loading checklist."}
        </span>
      </div>
      {kitchenRun ? (
        <Button size="lg" className="mt-4 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "pickup", id }] }))}>
          Open loading checklist
        </Button>
      ) : (
        <Button size="lg" className="mt-4 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }], tab: "map" }))}>
          Back to my route
        </Button>
      )}
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "stop", id }] }))}>
        View stop details
      </Button>
    </Sheet>
  );
}

/**
 * #18: "Can't do it" asks why, but the reason is optional (Oct 22 2026, replacing the earlier "reason + comment
 * required"). Tap a preset (tap again to clear) and/or add a comment; Send works either way.
 */
const DECLINE = ["Not available that day", "Timing doesn't work", "Too far from me", "Vehicle too small", "Other"];

function DeclineSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const r = s.requests.find((x) => x.id === id)!;
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const reason = [pick !== "Other" ? pick : null, note.trim() || null].filter(Boolean).join(" · ") || undefined;
  return (
    <Sheet title="Why can't you take it?" onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-[13px] text-muted-foreground">
        {r.name} · {r.dateLabel}. Optional: a reason helps dispatch reassign it.
      </p>
      <div role="radiogroup" className="space-y-2">
        {DECLINE.map((d) => (
          <button
            key={d}
            role="radio"
            aria-checked={pick === d}
            onClick={() => setPick(pick === d ? null : d)}
            className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-[15px] font-semibold", pick === d ? "border-teal bg-teal-wash text-teal-deep" : "border-control")}
          >
            <span className={cn("grid size-5 place-items-center rounded-full border-2", pick === d ? "border-teal bg-teal" : "border-control")}>{pick === d && <Check className="size-3 text-white" strokeWidth={4} />}</span>
            {d}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-[13px] font-semibold text-muted-foreground">
        Comment for dispatch (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={pick === "Other" ? "What's the reason?" : "e.g. I'm at the dentist until 1 PM"}
          className="mt-1.5 w-full resize-none rounded-2xl border border-control bg-card px-4 py-3 text-base font-normal text-foreground outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
      </label>
      <Button size="lg" className="mt-4 w-full" onClick={() => a.answerRequest(id, "declined", reason)}>
        Send to dispatch
      </Button>
    </Sheet>
  );
}

/**
 * Oct 26 2026: accept every request in the list. A warning plus a check of the date range before anything is accepted:
 * the driver ticks "I can do every delivery from … to …" to unlock the button. The list underneath is what they're
 * agreeing to, day by day, with anything outside their availability flagged.
 */
function AcceptAllSheet({ ids }: { ids: string[] }) {
  const { s, a } = useApp();
  const rs = s.requests.filter((r) => ids.includes(r.id) && r.status === "pending").sort((x, y) => x.dateISO.localeCompare(y.dateISO) || x.time - y.time);
  const [sure, setSure] = useState(false);
  const days = daysCovered(rs).length;
  const outside = rs.filter((r) => daysOf(r).some(([iso]) => !inHours(s.openHours, iso, r.time))).length;
  return (
    // Oct 26 2026, compact: the range as a subtitle (no warning box), short dates so names don't truncate, and the
    // confirmation as a plain checkbox row. The amber note only appears when something is outside availability.
    <Sheet title={`Accept all ${rs.length} requests?`} onClose={a.closeSheet}>
      <p className="nums -mt-3 mb-3 text-[15px] text-muted-foreground">
        {rangeLabel(rs)} · {days} {days === 1 ? "day" : "days"} of work
      </p>
      {outside > 0 && (
        <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-warning">
          <AlertTriangle className="size-4 shrink-0" /> {outside} {outside === 1 ? "is" : "are"} outside your availability
        </p>
      )}
      <ul className="nums -mx-5 divide-y divide-border border-y border-border">
        {rs.map((r) => {
          const off = daysOf(r).some(([iso]) => !inHours(s.openHours, iso, r.time));
          const day = r.dateLabel.replace(/^\w+, /, ""); // "Wed, Oct 7" → "Oct 7"
          return (
            <li key={r.id} className="flex min-h-12 items-center gap-3 px-5 py-2 text-[15px]">
              <span className="w-[68px] shrink-0 text-[13px] font-semibold text-teal-deep">{r.days ? `${day} +${r.days.length - 1}` : day}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              {off ? <AlertTriangle aria-label="Outside your availability" className="size-4 shrink-0 text-warning" /> : <span className="shrink-0 text-[13px] text-muted-foreground">{fmtTime(r.time)}</span>}
            </li>
          );
        })}
      </ul>
      <button role="checkbox" aria-checked={sure} onClick={() => setSure((v) => !v)} className="mt-3 flex min-h-12 w-full items-center gap-3 text-left text-[15px] font-semibold leading-snug">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2", sure ? "border-teal bg-teal text-white" : "border-teal bg-teal-wash")}>{sure && <Check className="size-4" strokeWidth={3} />}</span>
        <span>I can do all {days} {days === 1 ? "day" : "days"}</span>
      </button>
      <Button size="lg" className="mt-3 w-full" disabled={!sure} onClick={() => a.acceptAll(rs.map((r) => r.id))}>
        Accept all {rs.length}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        Not now
      </Button>
    </Sheet>
  );
}

/** #16: the week's open hours. Read-only; one row per working day (off days left out), today marked. */
const SKIP_REASONS = ["Customer asked to come another day", "Nothing ready to collect", "Can't make it in the pickup window", "No room left in the vehicle"];

/** Reusables pickup: ask dispatch to skip it. One tap for the reason, then send. It stays on the route until dispatch replies. */
function SkipSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Sheet title="Ask dispatch to skip?" onClose={a.closeSheet}>
      <p className="nums -mt-3 mb-4 text-[15px] text-muted-foreground">
        {stop.name} · pickup window {fmtWindow(stop.windowStart, stop.windowEnd)}
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Reason">
        {SKIP_REASONS.map((r) => (
          <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[15px] font-semibold", reason === r ? "border-teal bg-teal-wash text-teal-deep" : "border-control bg-card")}>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", reason === r ? "border-teal" : "border-control")}>{reason === r && <span className="size-2.5 rounded-full bg-teal" />}</span>
            {r}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">It stays on your route until dispatch replies.</p>
      <Button size="lg" className="mt-4 w-full" disabled={!reason} onClick={() => reason && a.requestSkip(id, reason)}>
        {reason ? "Send to dispatch" : "Pick a reason"}
      </Button>
    </Sheet>
  );
}

/** Reusables packing list (#83): what to collect at this pickup, readable on the phone, downloadable and shareable. */
function PackingListSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const items = stop.reusables ?? [];
  const expected = items.reduce((n, x) => n + x.expected, 0);
  const text = [
    `SUPERFINE KITCHEN · REUSABLES PACKING LIST`,
    `${stop.orderNo} · ${stop.name}`,
    `${stop.addressLine1}${stop.addressLine2 ? `, ${stop.addressLine2}` : ""}, ${stop.city}`,
    `Pickup window: ${fmtWindow(stop.windowStart, stop.windowEnd)}`,
    ``,
    ...items.map((x) => `[ ] ${x.label}: ${x.expected}`),
    ``,
    `Total expected: ${expected}`,
    stop.dropoffNotes ? `Note: ${stop.dropoffNotes}` : "",
    st.collectResult ? `Driver: ${st.collectResult === "collected" ? "collected" : "not collected"}${st.collectNote ? ` · ${st.collectNote}` : ""}` : "",
  ].join("\n");
  const file = `${stop.orderNo}-packing-list.txt`;
  const download = () => {
    // Prototype: a real file download (plain text). The app would save a PDF to the phone's Files.
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
    a.toast("Packing list saved to Downloads");
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Packing list · ${stop.orderNo}`, text });
      else a.toast("Sharing isn't available here · use Download");
    } catch {
      // share sheet dismissed
    }
  };
  return (
    <Sheet title="Packing list" onClose={a.closeSheet}>
      {/* Looks like the printed list: who, where, when, then each item with its expected count. */}
      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <div className="text-overline">{stop.orderNo} · Reusables</div>
        <div className="mt-1 text-[17px] font-semibold leading-tight">{stop.name}</div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {stop.addressLine1}
          {stop.addressLine2 && ` · ${stop.addressLine2}`}
        </p>
        <p className="nums mt-0.5 text-[13px] text-muted-foreground">Pickup window {fmtWindow(stop.windowStart, stop.windowEnd)}</p>
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {items.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{x.label}</span>
              <span className="nums text-[15px] font-bold">{x.expected}</span>
            </li>
          ))}
        </ul>
        <div className="nums flex justify-between border-t border-border pt-2.5 text-[13px] font-semibold text-muted-foreground">
          <span>Total expected</span>
          <span>{expected}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" className="w-full" onClick={share}>
          <Share2 /> Share
        </Button>
        <Button size="lg" className="w-full" onClick={download}>
          <Download /> Download
        </Button>
      </div>
    </Sheet>
  );
}

/** An order on a later kitchen pickup, tapped from Home: why it can't be loaded yet, and when it can. */
function LaterPickupSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const stop = findStop(s, id);
  const run = runOf(stop);
  const ready = fmtTime(KITCHEN_READY[run] ?? KITCHEN.readyAt);
  return (
    <Sheet onClose={a.closeSheet}>
      <div className="flex items-center gap-3">
        <StopAvatar stop={stop} className="size-12" />
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight tracking-tight">
            {stop.seq}. {stop.name}
          </span>
          <span className="nums block text-[13px] text-muted-foreground">
            {stop.orderNo} · {orderSize(stop)}
          </span>
        </span>
      </div>
      <div className="mt-4 flex gap-2.5 rounded-xl bg-muted p-3.5 text-[15px] leading-snug">
        <Clock className="mt-0.5 size-5 shrink-0 text-teal" />
        <span>
          <b className="nums font-semibold">On your next kitchen pickup, dispatch ready at {ready}.</b> Deliver this pickup's orders first, then come back to the kitchen to scan its slip and load it.
        </span>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={a.closeSheet}>
        Got it
      </Button>
    </Sheet>
  );
}

function OpenHoursSheet() {
  const { s, a } = useApp();
  const t = useT();
  const todayIdx = weekdayOf(ROUTE_ISO);
  return (
    <Sheet title={t("Your availability")} onClose={a.closeSheet}>
      <p className="-mt-3 mb-3 text-[13px] text-muted-foreground">When dispatch can send you work. Set by dispatch.</p>
      <ul className="divide-y divide-border">
        {WEEKDAYS.map((day, i) => {
          const h = s.openHours[i];
          if (!h) return null;
          const today = i === todayIdx;
          return (
            <li key={day} className={cn("nums flex h-12 items-center justify-between text-[15px]", today ? "font-semibold text-teal-deep" : "text-foreground")}>
              <span>
                {day}
                {today && <span className="ml-2 rounded-full bg-teal-wash px-2 py-0.5 text-[13px] font-semibold text-teal-deep">Today</span>}
              </span>
              <span>{fmtHours(h)}</span>
            </li>
          );
        })}
      </ul>
      <Button size="lg" variant="outline" className="mt-4 w-full" onClick={a.closeSheet}>
        Done
      </Button>
    </Sheet>
  );
}

/** #25: English or Spanish. */
function LanguageSheet() {
  const { s, a } = useApp();
  const t = useT();
  return (
    <Sheet title="Language · Idioma" onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-2xs text-muted-foreground">{t("Spanish text is checked by Superfine before it ships.")}</p>
      <div role="radiogroup" className="space-y-2">
        {(
          [
            ["en", "English"],
            ["es", "Español"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={s.lang === v}
            onClick={() => a.setLang(v)}
            className={cn("flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-[17px] font-semibold", s.lang === v ? "border-teal bg-teal-wash text-teal-deep" : "border-control")}
          >
            {l}
            {s.lang === v && <Check className="size-5" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** #24: optional update. A required one blocks the app instead (SystemLayer · UpdateGate). */
function UpdateSheet() {
  const { a } = useApp();
  const t = useT();
  return (
    <Sheet onClose={a.closeSheet}>
      <div className="text-center">
        <IconChip className="mx-auto size-14 rounded-full [&_svg]:size-7">
          <Download />
        </IconChip>
        <h3 className="mt-3 text-xl font-bold tracking-tight">{t("New version ready")}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("You're on")} {SETTINGS.appVersion}. {t("Takes about 30 seconds. Your stops are saved.")}
        </p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={a.installUpdate}>
        {t("Update now")}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        {t("After this route")}
      </Button>
    </Sheet>
  );
}
