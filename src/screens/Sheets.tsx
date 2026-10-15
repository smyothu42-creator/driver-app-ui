import { useState } from "react";
import { AlertTriangle, Camera, Check, X, CheckCircle2, ChefHat, Navigation, BadgeCheck, Download, Headphones, MapPin, MessageSquare, Phone } from "lucide-react";
import { findStop, isLoaded, liveRoute, needsKitchenRun, stopSteps, useApp, nextStop, useT } from "../store";
import { DISPATCH, KITCHEN, SETTINGS, SFK_TEAM, fmtTime, fmtWindow, type Contact } from "../data/route";
import { Button, cn, IconChip, Sheet, StepTrack, SfkMark } from "../components/ui";
import { ContactRow, StopInstructions } from "./StopDetail";
import accessPhoto from "../assets/access-photo.jpg";

export function Sheets() {
  const { s } = useApp();
  if (!s.sheet) return null;
  switch (s.sheet.name) {
    case "contact":
      return <ContactSheet id={s.sheet.id} />;
    case "people":
      return <PeopleSheet id={s.sheet.id} who={s.sheet.who} />;
    case "setup":
      return <SetupSheet id={s.sheet.id} />;
    case "photo":
      return <PhotoSheet id={s.sheet.id} />;
    case "photoFull":
      return <PhotoFull id={s.sheet.id} />;
    case "maps":
      return <MapsSheet id={s.sheet.id} />;
    case "instructions":
      return <InstructionsSheet id={s.sheet.id} />;
    case "delivered":
      return <DeliveredSheet id={s.sheet.id} />;
    case "startShift":
      return <StartShiftSheet />;
    case "endShift":
      return <EndShiftSheet />;
    case "claimed":
      return <ClaimedSheet id={s.sheet.id} />;
    case "decline":
      return <DeclineSheet id={s.sheet.id} />;
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
function SetupSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const st = s.stops[id];
  const steps = stop.setup ?? [];
  const done = steps.map((_, i) => !!st.setupDone?.[i]);
  const left = done.filter((d) => !d).length;
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
        onClick={() => a.jump((p) => ({ sheet: null, stack: [...p.stack, { name: "camera" as const, id }] }))}
      >
        <Camera /> {left > 0 ? `${t("Take delivery photo")} · ${left} left` : t("Take delivery photo")}
      </Button>
    </Sheet>
  );
}

/** "Customer" or "SFK Team" on a stop: the people to call, in the same rows as the stop's contact card. */
function PeopleSheet({ id, who }: { id: string; who: "customer" | "sfk" }) {
  const { s, a } = useApp();
  const t = useT();
  const stop = findStop(s, id);
  const people: (Contact & { tag: string })[] =
    who === "customer"
      ? [{ ...stop.contact, tag: t("Site contact") }, ...(stop.backupContact ? [{ ...stop.backupContact, tag: t("Backup contact") }] : [])]
      : SFK_TEAM.map((p) => ({ ...p, tag: t(p.tag) }));
  return (
    <Sheet title={who === "customer" ? t("Customer") : t("SFK Team")} onClose={a.closeSheet}>
      <p className="-mt-2 mb-4 text-[15px] leading-snug text-muted-foreground">Calls go through an SFK number, so your personal number stays private.</p>
      {/* Plain list, edge to edge: dividers only (-mx-5 cancels the sheet padding; rows keep px-5). */}
      <div className="-mx-5 divide-y divide-border border-y border-border [&>div]:px-5">
        {people.map((p) => (
          <ContactRow key={p.name} c={p} tag={p.tag} />
        ))}
      </div>
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
          <button key={m} onClick={() => { a.closeSheet(); a.toast(`Opening ${m}…`); }} className="flex w-full items-center gap-3 rounded-xl border border-control p-3 text-left text-sm font-semibold">
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
        <Button size="lg" className="mt-5 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }], tab: "today" }))}>
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

function StartShiftSheet() {
  const { a } = useApp();
  return (
    <Sheet title="Go on duty?" onClose={a.closeSheet}>
      <p className="-mt-1 text-[16px] leading-snug text-muted-foreground">
        Dispatch will see your location while you're on duty.
      </p>
      <Button size="lg" className="mt-5 w-full" onClick={a.startShift}>
        Go on duty & share location
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        Not now
      </Button>
    </Sheet>
  );
}

function EndShiftSheet() {
  const { s, a } = useApp();
  const left = liveRoute(s).filter((x) => s.stops[x.id].status !== "delivered").length;
  return (
    <Sheet title="Turn off Ready?" onClose={a.closeSheet}>
      {left > 0 ? (
        <p className="-mt-2 rounded-xl border border-warning-border bg-warning-bg p-3 text-[13px] text-warning">
          You still have {left} {left === 1 ? "stop" : "stops"} on this route. Dispatch will be alerted to reassign them.
        </p>
      ) : (
        <p className="-mt-2 text-[13px] text-muted-foreground">Location sharing stops immediately. Dispatch sees you as not ready.</p>
      )}
      <Button size="lg" variant={left > 0 ? "danger-outline" : "teal"} className="mt-5 w-full" onClick={a.endShift}>
        {left > 0 ? `Turn off Ready with ${left} left` : "Turn off Ready"}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        Keep working
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
            ? `Next: head back to ${KITCHEN.dock} to load this order.`
            : "It's been added to your kitchen loading checklist."}
        </span>
      </div>
      {kitchenRun ? (
        <Button size="lg" className="mt-4 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "pickup", id }] }))}>
          Open loading checklist
        </Button>
      ) : (
        <Button size="lg" className="mt-4 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }], tab: "today" }))}>
          Back to my route
        </Button>
      )}
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={() => a.jump(() => ({ sheet: null, stack: [{ name: "tabs" }, { name: "stop", id }] }))}>
        View stop details
      </Button>
    </Sheet>
  );
}

/** #18: declining needs a reason. Presets first; "Other" needs a few words. */
const DECLINE = ["Not available that day", "Timing doesn't work", "Too far from me", "Vehicle too small", "Other"];

function DeclineSheet({ id }: { id: string }) {
  const { s, a } = useApp();
  const r = s.requests.find((x) => x.id === id)!;
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const ok = pick && (pick !== "Other" || note.trim().length >= 3);
  return (
    <Sheet title="Why can't you take it?" onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-[13px] text-muted-foreground">
        {r.name} · {r.dateLabel}. Dispatch needs a reason to reassign it.
      </p>
      <div role="radiogroup" className="space-y-2">
        {DECLINE.map((d) => (
          <button
            key={d}
            role="radio"
            aria-checked={pick === d}
            onClick={() => setPick(d)}
            className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold", pick === d ? "border-teal bg-teal-wash text-teal-deep" : "border-control")}
          >
            <span className={cn("grid size-5 place-items-center rounded-full border-2", pick === d ? "border-teal bg-teal" : "border-control")}>{pick === d && <Check className="size-3 text-white" strokeWidth={4} />}</span>
            {d}
          </button>
        ))}
      </div>
      {pick === "Other" && (
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="A few words for dispatch"
          className="mt-3 w-full rounded-xl border border-control bg-card px-4 py-3 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
      )}
      <Button size="lg" variant={ok ? "coral" : "outline"} className="mt-4 w-full" disabled={!ok} onClick={() => a.answerRequest(id, "declined", pick === "Other" ? note.trim() : pick!)}>
        {ok ? "Send to dispatch" : pick === "Other" ? "Add a few words" : "Pick a reason"}
      </Button>
    </Sheet>
  );
}

/** #25: English or Spanish. */
function LanguageSheet() {
  const { s, a } = useApp();
  return (
    <Sheet title="Language · Idioma" onClose={a.closeSheet}>
      <p className="-mt-3 mb-4 text-2xs text-muted-foreground">Spanish text is checked by Superfine before it ships. Some screens are still in English.</p>
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
            className={cn("flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-base font-semibold", s.lang === v ? "border-teal bg-teal-wash text-teal-deep" : "border-control")}
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
        <h3 className="mt-3 text-xl font-bold tracking-tight">New version ready</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">You're on {SETTINGS.appVersion}. Takes about 30 seconds. Your stops are saved.</p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={a.installUpdate}>
        {t("Update now")}
      </Button>
      <Button size="md" variant="ghost" className="mt-1 w-full" onClick={a.closeSheet}>
        After this route
      </Button>
    </Sheet>
  );
}
