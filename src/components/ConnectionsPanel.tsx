import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, GitBranch, LayoutDashboard, MousePointerClick, PanelRightClose, RotateCcw, Smartphone } from "lucide-react";
import { routeOf, useApp, type StopState } from "../store";
import { DISPATCH, DRIVER, SETTINGS } from "../data/route";
import { cn } from "./ui";
import { AREAS, isOn, type Area } from "../data/sprints";

/* ------------------------------------------------------------------
 * Prototype guide: a FigJam-style user flow per Phase 3 feature (scope row #).
 * Nodes: start / end pills, screens, driver actions, system steps, decisions
 * (diamonds with branches). `fx` = the effect on dispatch or the customer,
 * drawn as a dashed sticky note. Every node is clickable: it sets the phone to
 * that moment (its own `go`, or the closest step before it). The last clicked
 * node stays highlighted. A decision followed by more nodes merges its branches.
 * ------------------------------------------------------------------ */

type Kind = "start" | "end" | "screen" | "action" | "system" | "decision";
type Go = () => void;
type Node = { k: Kind; t: string; fx?: string; go?: Go; br?: [string, Node[]][] };
type Feature = { n: string; title: string; status?: string; area: Area; hide?: boolean; flow: Node[] };

const Start = (t: string, go?: Go): Node => ({ k: "start", t, go });
const End = (t: string, go?: Go): Node => ({ k: "end", t, go });
const Scr = (t: string, go?: Go, fx?: string): Node => ({ k: "screen", t, go, fx });
const Act = (t: string, fx?: string, go?: Go): Node => ({ k: "action", t, fx, go });
const Sys = (t: string, fx?: string, go?: Go): Node => ({ k: "system", t, fx, go });
const Dec = (t: string, br: [string, Node[]][], go?: Go): Node => ({ k: "decision", t, br, go });

/** Which node was clicked last, so it stays highlighted while the phone shows it. */
const FlowCtx = createContext<{ active: string | null; hit: (id: string, go?: Go) => void }>({ active: null, hit: () => {} });

/** Scroll the phone's open screen to a section marked data-flow="…" (after the screen has mounted). */
function scrollPhoneTo(section: string) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-flow="${section}"]`);
    const box = el?.closest<HTMLElement>(".overflow-y-auto");
    if (!el || !box) return;
    box.scrollTo({ top: box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12, behavior: "smooth" });
  }, 380);
}

export function ConnectionsPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-label="Open prototype guide: user flows"
        className="anim-fade fixed bottom-6 right-6 z-[80] flex h-12 items-center gap-2 rounded-full bg-teal-deep pl-1.5 pr-5 text-sm font-semibold text-white shadow-raised transition hover:bg-sidebar-active max-[500px]:hidden"
      >
        <span className="grid size-9 place-items-center rounded-full bg-yellow text-teal-deep">
          <LayoutDashboard className="size-[18px]" />
        </span>
        User flows
      </button>
    );
  }

  // Split screen: fills the right side edge to edge, full height, square corners.
  return (
    <aside aria-label="Prototype guide" className="anim-fade flex h-full min-w-0 flex-[2] flex-col border-l border-border bg-card max-[500px]:hidden">
      <Flows onClose={() => setOpen(false)} />
    </aside>
  );
}

function Flows({ onClose }: { onClose: () => void }) {
  const { s, a } = useApp();
  const [sel, setSel] = useState<number | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const STOPS = routeOf(s);
  const allBags = Object.fromEntries(STOPS.flatMap((x) => x.bags.map((b) => [b.id, true])));
  const base = { signedIn: true, permsDone: true, location: "always" as const, camera: true, notifications: true, sheet: null };
  const onShift = { ...base, shiftOn: true, shiftStartedAt: s.shiftStartedAt ?? s.clock };
  const loaded = { ...onShift, pickupDone: true, pickupAt: s.pickupAt ?? s.clock, bagChecks: allBags };
  const target = STOPS.find((x) => s.stops[x.id].status !== "delivered") ?? STOPS[0];
  const t = target.id;
  const withStatus = (status: StopState["status"], extra: Partial<StopState> = {}) => ({
    stops: { ...s.stops, [t]: { ...s.stops[t], status, ...extra } },
    focusId: t,
  });

  const offDuty = () => a.jump(() => ({ ...base, shiftOn: false, stack: [{ name: "tabs" }], tab: "today" }));
  const home = () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }], tab: "today" }));
  const homeLoaded = () => a.jump(() => ({ ...loaded, stack: [{ name: "tabs" }], tab: "today" }));
  const me = () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }], tab: "me" }));
  const schedule = () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }], tab: "schedule" }));
  const stop = (id = t) => a.jump(() => ({ ...loaded, focusId: id, stack: [{ name: "tabs" }, { name: "stop", id }] }));
  const arrivedStop = (id = t) => a.jump((p) => ({ ...loaded, focusId: id, stops: { ...p.stops, [id]: { ...p.stops[id], status: "arrived", arrivedAt: p.clock } }, stack: [{ name: "tabs" }, { name: "stop", id }] }));
  const proof = (away = false) =>
    a.jump(() => ({ ...loaded, ...withStatus("arrived", { arrivedAt: s.clock, photos: Math.max(1, s.stops[t].photos) }), awayFromAddress: away, stack: [{ name: "tabs" }, { name: "stop", id: t }, { name: "proof", id: t }] }));
  const camera = () => a.jump(() => ({ ...loaded, ...withStatus("arrived", { arrivedAt: s.clock }), stack: [{ name: "tabs" }, { name: "stop", id: t }, { name: "camera", id: t }] }));
  const navigate = () => a.jump(() => ({ ...loaded, ...withStatus("en_route", { enRouteAt: s.clock }), stack: [{ name: "tabs" }, { name: "navigate", id: t }] }));
  const navInstructions = () => a.jump(() => ({ ...loaded, ...withStatus("en_route", { enRouteAt: s.clock }), stack: [{ name: "tabs" }, { name: "navigate", id: t }], sheet: { name: "instructions", id: t } }));
  const request = (id: string) => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "request", id }], tab: "schedule" }));
  const timeOff = () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "availability" }], tab: "schedule" }));
  const scan = () => a.jump(() => ({ ...onShift, pickupDone: false, stack: [{ name: "tabs" }, { name: "scan" }] }));
  const kitchen = () => a.jump(() => ({ ...onShift, pickupDone: false, scanned: { s1: true }, stack: [{ name: "tabs" }, { name: "package", id: "s1" }] }));
  const collect = () => a.jump((p) => ({ ...loaded, focusId: "p1", stops: { ...p.stops, p1: { ...p.stops.p1, status: "arrived", arrivedAt: p.clock } }, stack: [{ name: "tabs" }, { name: "stop", id: "p1" }, { name: "collect", id: "p1" }] }));
  const servedStop = () =>
    a.jump((p) => ({ ...loaded, stops: { ...p.stops, s2: { ...p.stops.s2, status: "delivered", deliveredAt: p.clock, photos: 1, handoff: "handed", receivedBy: "Jordan Lee", setupDone: [true, true, true] } }, focusId: "s2", stack: [{ name: "tabs" }, { name: "stop", id: "s2" }] }));
  const sameDayRequest = () => {
    a.sendOrderRequest("o1");
    a.jump(() => ({ ...loaded, push: null, stack: [{ name: "tabs" }, { name: "request", id: "q-o1" }] }));
  };
  const backToKitchen = () =>
    a.jump((p) => ({
      ...loaded,
      claims: { ...p.claims, o1: p.claims.o1 ?? { by: DRIVER.id, at: p.clock } },
      assignments: { ...p.assignments, o1: p.assignments.o1 ?? [{ userId: DRIVER.id }] },
      loaded: Object.fromEntries(Object.entries(p.loaded).filter(([k]) => k !== "o1")),
      focusId: "o1",
      stack: [{ name: "tabs" }, { name: "pickup", id: "o1" }],
    }));

  const atKitchen = () => a.jump(() => ({ ...onShift, pickupDone: false, stack: [{ name: "tabs" }], tab: "today" }));
  const mapTab = () => a.jump(() => ({ ...loaded, stack: [{ name: "tabs" }], tab: "map" }));
  const reorderNow = () => {
    homeLoaded();
    a.reorder();
  };
  const stopAt = (section: string, id = t) => {
    stop(id);
    scrollPhoneTo(section);
  };
  const startNav = () => {
    a.jump(() => ({ ...loaded, focusId: t, stack: [{ name: "tabs" }, { name: "stop", id: t }] }));
    a.startNav(t);
  };
  const contactSheet = () => a.jump(() => ({ ...loaded, focusId: t, stack: [{ name: "tabs" }, { name: "stop", id: t }], sheet: { name: "contact", id: t } }));
  const callContact = () => {
    stopAt("contacts");
    a.toast(`Calling ${target.contact.name}…`);
  };
  const callDispatch = () => {
    stopAt("actions");
    a.toast(`Calling dispatch (${DISPATCH.name})…`);
  };
  const problem = () => a.jump(() => ({ ...loaded, focusId: t, stack: [{ name: "tabs" }, { name: "stop", id: t }, { name: "problem", id: t }] }));

  const R = SETTINGS.requestReminderHours;
  const F = SETTINGS.requestFlagHours;
  const L = SETTINGS.foodSafetyMins;
  const W = SETTINGS.foodSafetyWarnMins;

  const plan: { title: string; features: Feature[] }[] = [
    {
      title: "Login, profile & duty",
      features: [
        {
          n: "7",
          title: "Sign in on your own phone for the first time",
          area: "profile",
          status: "Proposed",
          flow: [
            Start("SFK admin creates the account"),
            Act("Install the app from the link SFK sends"),
            Scr("Sign in", () => a.jump(() => ({ signedIn: false, stack: [{ name: "signin" }], sheet: null }))),
            Dec("First time on this phone?", [
              ["Yes", [Scr("Permissions: location, camera, notifications", () => a.jump(() => ({ signedIn: true, stack: [{ name: "permissions" }], sheet: null }))), Act("Allow each")]],
              ["No", [Sys("Permissions already set")]],
            ]),
            Scr("Home · Ready is off", offDuty),
            End("Ready to go on duty"),
          ],
        },
        {
          n: "8 / 78",
          title: "Go on duty at the start of the day, off duty at the end",
          area: "profile",
          status: "Proposed",
          flow: [
            Start("Home · Ready is off", offDuty),
            Act("Go on duty"),
            Scr("Sheet: “This isn't your clock-in”", () => a.jump(() => ({ ...base, shiftOn: false, stack: [{ name: "tabs" }], tab: "today", sheet: { name: "startShift" } }))),
            Act("Confirm", "Dispatch: driver Ready + live on the map"),
            Sys("Location on · arrow in status bar", undefined, home),
            Act("Me → turn off Ready", undefined, () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }], tab: "me", sheet: { name: "endShift" } }))),
            Sys("Location stops immediately", "Dispatch: offline · unfinished stops flagged for reassignment"),
            End("Off duty"),
          ],
        },
        {
          n: "5",
          title: "Share your location while you're on duty",
          area: "profile",
          status: "Agreed",
          flow: [
            Start("Ready is on", home),
            Sys("Share live location", "Dispatch: driver on the map"),
            Dec("Navigating to a stop?", [
              ["Yes", [Sys("Share ETA with that customer only", "Customer: live map + ETA", navigate)]],
              ["No", [Sys("Dispatch only")]],
            ]),
            Scr("Me → Location sharing explains who sees what", () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "tracking" }] }))),
            End("Stops when Ready is off"),
          ],
        },
        {
          n: "64",
          title: "Add your car's make, model and year",
          area: "profile",
          status: "Requested",
          flow: [
            Start("Me", me),
            Scr("Vehicle", () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "vehicle" }], tab: "me" }))),
            Act("Enter make, model, year · headcount (optional)"),
            Act("Save", "Dispatch: vehicle on the driver profile"),
            Scr("Storage details · read-only, set by dispatch"),
            End("Never blocks an assignment"),
          ],
        },
        {
          n: "79",
          title: "Drive an SFK van when dispatch assigns one",
          area: "profile",
          flow: [
            Start("Delivery assigned"),
            Dec("Dispatch set a vehicle for it?", [
              ["No", [Sys("Use the driver's default vehicle")]],
              ["Yes", [Scr("Stop + loading checklist: “Use SFK Van 2”", () => stop("s2"))]],
            ]),
            End("Load and drive"),
          ],
        },
      ],
    },
    {
      title: "Schedule & assignments",
      features: [
        {
          n: "19",
          title: "Get a new delivery request from dispatch",
          area: "schedule",
          status: "Requested",
          flow: [
            Start("Dispatch sends a request"),
            Sys("Push banner + inbox message", undefined, () => {
              home();
              a.sendRequest();
            }),
            Dec("Tap the push?", [
              ["Yes", [Sys("Opens the request")]],
              ["Later", [Scr("Schedule → Needs your answer (tab badge, Home nudge)", schedule)]],
            ]),
            Scr("Request detail · Driver pending", () => request("r3")),
            End("Answer it (#18)"),
          ],
        },
        {
          n: "18 / 77",
          title: "Accept a delivery, or say you can't do it",
          area: "schedule",
          status: "Proposed",
          flow: [
            Start("Request detail · Driver pending", () => request("r2")),
            Dec("Driver's answer", [
              ["Accept", [Act("Accept", "Dispatch: Driver accepted"), End("On Schedule / today's route")]],
              [
                "Can't do it",
                [
                  Scr("Reason sheet", () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "request", id: "r2" }], tab: "schedule", sheet: { name: "decline", id: "r2" } }))),
                  Act("Pick a reason · “Other” needs a comment"),
                  Act("Send", "Dispatch: Driver declined + reason"),
                  End("Dispatch reassigns"),
                ],
              ],
              [
                "No answer",
                [
                  Sys(`Reminder every ${R} h`, undefined, () => a.notify({ kind: "reminder", title: "Delivery requests need your answer", body: `Reminder every ${R} h until you answer.`, priority: "high" }, { name: "tabs" })),
                  Dec(`Under ${F} h to delivery?`, [
                    ["Yes", [Sys("Warning on the request", `Dispatch: ⚑ Not accepted · under ${F} h`)]],
                    ["No", [Sys("Keep reminding")]],
                  ]),
                ],
              ],
            ]),
          ],
        },
        {
          n: "17",
          title: "Check what's coming up this week",
          area: "schedule",
          status: "Proposed",
          flow: [
            Start("Schedule tab", schedule),
            Scr("Coming up, grouped by day"),
            Dec("Order placed yet?", [
              ["Yes", [Scr("“~11:30 AM” · name · meals")]],
              ["No", [Scr("“Usual” placeholder · order not in yet")]],
            ]),
            End("Tap for details"),
          ],
        },
        {
          n: "20",
          title: "Review an order before you confirm it",
          area: "schedule",
          status: "Proposed · parking lot",
          flow: [
            Start("Request arrives"),
            Dec("Dispatch allows preview for this order?", [
              ["No", [End("Hidden until assigned")]],
              [
                "Yes",
                [
                  Scr("Full detail before accepting", () => request("r3")),
                  Dec("Multi-day order?", [
                    ["Yes", [Scr("One request, every day listed", () => request("r4"))]],
                    ["No", [Scr("Single day")]],
                  ]),
                  End("Accept or decline (#18)"),
                ],
              ],
            ]),
          ],
        },
        {
          n: "16",
          title: "Check the hours dispatch has you open for",
          area: "schedule",
          status: "Requested",
          flow: [Start("Schedule tab", schedule), Scr("Your open hours · “Set by dispatch”"), End("Read-only · not a schedule")],
        },
        {
          n: "76",
          title: "Request a day off ahead of time",
          area: "schedule",
          flow: [
            Start("Schedule / Me"),
            Scr("Time off", timeOff),
            Act("Pick a day"),
            Dec(`Within ${SETTINGS.timeOffNoticeDays} days?`, [
              ["Yes", [Sys("Day locked · can't pick"), End("Too late to request")]],
              [
                "No",
                [
                  Act("Send request", "Dispatch: time-off request to approve"),
                  Scr("Day shows “Requested” · still assignable"),
                  Dec("Dispatch approves?", [
                    ["Yes", [End("Time off · not assigned")]],
                    ["No", [End("Working day")]],
                  ]),
                ],
              ],
            ]),
          ],
        },
      ],
    },
    {
      title: "Route & stops",
      features: [
        {
          n: "1",
          title: "Start the day and see which stop is next",
          area: "route",
          status: "Agreed",
          flow: [
            Start("Ready is on · route not loaded yet", atKitchen),
            Scr("Home: next step + all stops in dispatch order", homeLoaded),
            Scr("Route tab: map + swipeable stop cards", mapTab),
            Dec(
              "Dispatch changes the route?",
              [
                ["Re-order", [Sys("Push banner + list re-ordered", "Dispatch: new stop order sent", reorderNow)]],
                ["No", [Sys("Route as planned", undefined, homeLoaded)]],
              ],
              homeLoaded,
            ),
            End("Follow the next step", () => stop()),
          ],
        },
        {
          n: "3",
          title: "Drive the order from the kitchen to the customer",
          area: "route",
          flow: [
            Start("On duty at the kitchen", atKitchen),
            Scr("Home: “Pick up at the kitchen” · dock, ready time, orders", atKitchen),
            Act("Pick up the order", "Customer: On the way · Dispatch: dispatched", homeLoaded),
            Scr("Next stop card: work type, window, ETA, parking + drop-off note", homeLoaded),
            Act("Start navigation", "Customer: live ETA · Dispatch: En route", startNav),
            Scr("In-app navigation: turn card, ETA, work + parking", navigate),
            Scr("Instructions sheet (one tap)", navInstructions),
            Act("Slide when you arrive", "Customer push: “Your driver has arrived”", () => arrivedStop()),
            End("At the customer", () => arrivedStop()),
          ],
        },
        {
          n: "2",
          title: "Check a stop before you go: where, when, how to get in",
          area: "route",
          flow: [
            Start("Tap a stop on Home", homeLoaded),
            Scr("Stop details: address + delivery window", () => stop()),
            Scr("Work type: hot / cold", () => stop()),
            Scr("How to deliver: park → get in (+ photo)", () => stopAt("address")),
            Scr("→ drop off (yellow, this order)", () => stopAt("instructions")),
            Scr("Contacts: site contact + backup", () => stopAt("contacts")),
            Act("Slide: arrived"),
            End("“You're here”: same steps, numbered, ending in the photo", () => arrivedStop()),
          ],
        },
        {
          n: "14",
          title: "Call the site contact or dispatch from a stop",
          area: "route",
          hide: true, // hidden for now (Oct 13 2026), the buttons stay on the stop
          flow: [
            Start("Stop details", () => stopAt("actions")),
            Dec(
              "Tap which?",
              [
                ["Contact", [Scr("Contact sheet", contactSheet), Act("Call site or backup contact", undefined, callContact), End("Call via SFK number", callContact)]],
                ["Dispatch", [Act("Call dispatch", undefined, callDispatch), End("Call via SFK number", callDispatch)]],
                ["Problem", [End("Report a problem · coming soon", problem)]],
              ],
              () => stopAt("actions"),
            ),
          ],
        },
        {
          n: "15",
          title: "React when dispatch moves or cancels a delivery",
          area: "notifications",
          flow: [
            Start("Dispatch edits an order"),
            Dec("What changed?", [
              [
                "Time",
                [
                  Sys("Push + inbox (high)", undefined, () => {
                    homeLoaded();
                    a.changeTime(t, 20);
                  }),
                  Scr("Stop: new time, old struck"),
                  End("Same route"),
                ],
              ],
              [
                "Cancelled",
                [
                  Sys("Push + red banner", undefined, () => {
                    homeLoaded();
                    a.cancelOrder(t);
                  }),
                  Scr("What to do with the food"),
                  End("Stop struck through"),
                ],
              ],
            ]),
          ],
        },
      ],
    },
    {
      title: "At the kitchen",
      features: [
        {
          n: "9",
          title: "Load the van at the kitchen and head out",
          area: "kitchen",
          status: "Proposed",
          flow: [
            Start("At the kitchen"),
            Scr("Home → Scan packing slip", scan),
            Scr("Package screen · items inside that package", kitchen),
            Act("Check each item (button stays disabled until all are checked)"),
            Dec("More packages?", [
              ["Yes", [Act("Scan next package"), End("Repeat")]],
              ["No", [Act("Slide: Loaded · start route", "Customer: On the way · Dispatch: dispatched"), End("Route starts")]],
            ]),
          ],
        },
        {
          n: "22",
          title: "Keep hot food within its safe time",
          area: "kitchen",
          status: "Proposed · parking lot",
          flow: [
            Start("Slide: loaded"),
            Sys("Next-stop card: “Loaded N min ago”", undefined, homeLoaded),
            Dec("Time since loading?", [
              [`Under ${L - W} min`, [End("Neutral chip")]],
              [`${L - W}–${L} min`, [Sys(`Amber: limit in N min`, undefined, () => a.jump((p) => ({ ...loaded, pickupAt: p.clock - 50, stack: [{ name: "tabs" }], tab: "today" })))]],
              [`Over ${L} min`, [Sys("Red: past limit", undefined, () => a.jump((p) => ({ ...loaded, pickupAt: p.clock - (L + 5), stack: [{ name: "tabs" }], tab: "today" }))), Act("Call dispatch", "Dispatch: call from driver")]],
            ]),
          ],
        },
        {
          n: "—",
          title: "Pick up an extra order added after you've loaded",
          area: "schedule",
          flow: [
            Start("Dispatch sends today's order"),
            Scr("Request detail", sameDayRequest),
            Act("Accept", "Dispatch: Driver accepted"),
            Scr("Sheet: “Added to your route”"),
            Dec("Main pickup already done?", [
              ["Yes", [Scr("Next step: back to kitchen to load", backToKitchen)]],
              ["No", [Sys("Loads with the rest")]],
            ]),
            End("Stop added at the end"),
          ],
        },
      ],
    },
    {
      title: "Delivery & proof",
      features: [
        {
          n: "71 / 82",
          title: "Work a delivery with a team",
          area: "team",
          status: "Proposed",
          flow: [
            Start("Assigned to a stop (any staff type)"),
            Scr("Stop details: “Your role” + crew", () => stop("s2")),
            Dec("Your role?", [
              ["Driver / Event staff", [End("Normal stop flow")]],
              ["Lead event staff", [Act("Arrive on site"), Scr("Crew: Mark in / Mark out", () => arrivedStop("s2"), "Dispatch: attendance per person"), End("Service logged")]],
            ]),
          ],
        },
        {
          n: "11",
          title: "Set up the food when you arrive",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Stop details", () => stop("s2")),
            Act("Arrive", undefined, () => arrivedStop("s2")),
            Scr("Button: Start setup"),
            Scr("Setup dialog · checklist"),
            Act("Tick every step"),
            Sys("“Take delivery photo” unlocks in the dialog"),
            End("Proof of delivery (#4)"),
          ],
        },
        {
          n: "4",
          title: "Take a photo to prove the drop-off",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Slide: arrived"),
            Scr("Camera with framing guide", camera),
            Act("Take 1–3 photos"),
            Scr("Proof of delivery", () => proof()),
            Dec("Inside the window?", [
              ["On time", [Sys("“On time” banner")]],
              ["Late", [Sys("“Delayed” banner"), Act("Pick why (presets)")]],
            ]),
            Act("Slide to complete", "Customer email: Delivered + photo · Dispatch: delivered, on time / late"),
            End("Delivered sheet → next stop"),
          ],
        },
        {
          n: "12",
          title: "Record who received it and when service ended",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Proof of delivery", () => proof()),
            Dec("Handed over?", [
              ["Handed to someone", [Act("Who received it? (required)")]],
              ["Left at the spot", [Act("Where it was left")]],
            ]),
            Act("Slide to complete"),
            Dec("Setup + serve stop?", [
              ["No", [End("Done")]],
              ["Yes", [Act("Mark setup done", "Dispatch: setup end time"), Act("End service", "Dispatch: service end time", servedStop), End("Done")]],
            ]),
          ],
        },
        {
          n: "75",
          title: "Log where you were when it was delivered",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Slide to complete", () => proof()),
            Sys("Phone location saved with Delivered", "Dispatch: delivery pin + time on the order"),
            Scr("Stop: “Location logged” + coordinates", () => a.jump((p) => ({ ...loaded, focusId: t, stops: { ...p.stops, [t]: { ...p.stops[t], status: "delivered", deliveredAt: p.clock, photos: 1, handoff: "handed", receivedBy: "Front desk" } }, stack: [{ name: "tabs" }, { name: "stop", id: t }] }))),
            End("Kept for disputes"),
          ],
        },
        {
          n: "13",
          title: "Mark delivered when you're not at the address",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Proof of delivery", () => proof()),
            Sys("Check location against the address"),
            Dec(`Within ${SETTINGS.deliveredRadiusMi} mi of the address?`, [
              ["Yes", [Sys("“At the address · location logged”"), Act("Slide to complete")]],
              ["No", [Sys("Warning: “You're 0.4 mi from…”", undefined, () => proof(true)), Act("Slide to complete anyway", "Dispatch: flag on the order")]],
            ]),
            End("Delivered · never blocked"),
          ],
        },
        {
          n: "—",
          title: "Collect reusable containers from a customer",
          area: "reusables",
          flow: [
            Start("After the last delivery"),
            Scr("Reusables pickup stop · packing list", () => stop("p1")),
            Act("Navigate + arrive"),
            Scr("Collect reusables", collect),
            Act("Count each item (or “Matches expected”)"),
            Act("Photo (required)"),
            Dec("Matches expected?", [
              ["Yes", [End("Done")]],
              ["Short", [Sys("Sent to dispatch lead", "Dispatch: write off / pending"), End("Done")]],
            ]),
          ],
        },
        {
          n: "10",
          title: "Open a stop by scanning the slip's QR code",
          area: "kitchen",
          status: "Proposed",
          flow: [
            Start("Scan the QR on the slip"),
            Scr("Public delivery page · progress + ETA", () => a.jump(() => ({ ...loaded, ...withStatus("en_route", { enRouteAt: s.clock }), stack: [{ name: "tabs" }, { name: "publicPage", id: t }] }))),
            Act("Tap “Are you a driver?”"),
            Dec("Signed in?", [
              ["Yes", [Sys("Opens the stop")]],
              ["No", [Scr("Sign in", () => a.jump(() => ({ signedIn: false, shiftOn: false, sheet: null, stack: [{ name: "publicPage", id: "s3" }] }))), Sys("Lands on that stop")]],
            ]),
            End("Counts as arrival"),
          ],
        },
        {
          n: "74",
          title: "Mark a delivery done for a driver without the app",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Driver without the app"),
            Sys("Dispatch assigns “Appless driver (office)”"),
            Act("SFK office marks delivered", "Dispatch: delivered (office override)", () => {
              homeLoaded();
              a.officeDeliver(t);
            }),
            End("Stop: “Marked delivered at the SFK office”"),
          ],
        },
      ],
    },
    {
      title: "Problems & messages",
      features: [
        {
          n: "21",
          title: "Report a problem you can't solve at the stop",
          area: "dropoff",
          status: "Agreed",
          flow: [
            Start("Stop → Problem"),
            Scr("What happened?", () => a.jump(() => ({ ...loaded, focusId: t, stack: [{ name: "tabs" }, { name: "stop", id: t }, { name: "problem", id: t }] }))),
            Dec("Problem type", [
              ["Can't get in / nobody there", [Scr("Called contact? Backup? Waited?")]],
              ["Food or order issue", [Scr("How late? What's affected?"), Act("Photo (required)")]],
            ]),
            Act("Call dispatch now", "Dispatch: alert on the order"),
            End("Dispatch decides"),
          ],
        },
        {
          n: "6",
          title: "Read and reply to a message from dispatch",
          area: "notifications",
          flow: [
            Start("Dispatch sends a message"),
            Sys("Bell shows unread count"),
            Scr("Inbox", () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }, { name: "inbox" }] }))),
            Dec("Message about…", [
              ["A stop / request", [Act("Tap → opens it")]],
              ["General", [Act("Reply with a preset", "Dispatch: reply on the thread")]],
            ]),
            End("Marked read"),
          ],
        },
      ],
    },
    {
      title: "Phone & app",
      features: [
        {
          n: "23",
          title: "Keep working when you lose signal",
          area: "unplanned",
          flow: [
            Start("Signal lost", () => {
              homeLoaded();
              a.setOnline(false);
            }),
            Sys("Dark bar: “Offline · N will sync”"),
            Act("Keep working · every action is queued"),
            Sys("Signal back", undefined, () => a.setOnline(true)),
            Sys("Toast: “N updates synced”", "Dispatch: updates arrive with their original times"),
            End("Back to normal"),
          ],
        },
        {
          n: "24",
          title: "Update the app when a new version is out",
          area: "unplanned",
          flow: [
            Start("New version published"),
            Dec("Required?", [
              [
                "Optional",
                [
                  Scr("Sheet: Update now / After this route", () => {
                    home();
                    a.setUpdate("optional");
                  }),
                ],
              ],
              [
                "Required",
                [
                  Scr("Full screen: “Update to keep driving”", () => {
                    home();
                    a.setUpdate("required");
                  }),
                ],
              ],
            ]),
            End("Version shown in Me"),
          ],
        },
        {
          n: "25",
          title: "Switch the app to Spanish",
          area: "profile",
          flow: [
            Start("Me", me),
            Scr("Language sheet", () => a.jump(() => ({ ...onShift, stack: [{ name: "tabs" }], tab: "me", sheet: { name: "language" } }))),
            Act("Pick Español", undefined, () => a.jump(() => ({ ...onShift, lang: "es", stack: [{ name: "tabs" }], tab: "today" }))),
            End("Whole app in Spanish"),
          ],
        },
      ],
    },
  ];

  // Flows from a later design sprint are hidden for now (src/data/sprints.ts).
  const groups = plan.map((g) => ({ ...g, features: g.features.filter((f) => isOn(f.area) && !f.hide) })).filter((g) => g.features.length > 0);
  const all = groups.flatMap((g) => g.features.map((f) => ({ ...f, group: g.title })));
  const cur = sel === null ? null : all[sel];
  const areas = [...new Set(all.map((f) => AREAS[f.area].feature))].join(", ");
  const open = (i: number) => {
    setSel(i);
    setActive(null);
  };
  const iconBtn = "grid size-10 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-teal-wash disabled:opacity-30";

  return (
    <FlowCtx.Provider value={{ active, hit: (id, go) => (setActive(id), go?.()) }}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-8 py-5">
        {cur ? (
          <>
            <button onClick={() => setSel(null)} className="flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-semibold transition hover:bg-teal-wash">
              <ArrowLeft className="size-4" /> All flows
            </button>
            <div className="min-w-0 flex-1 pl-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="nums rounded-full bg-teal-deep px-2 py-0.5 font-bold text-white">Flow {sel! + 1}</span>
                <span className="nums">Scope #{cur.n}</span>
                {cur.group}
                {cur.status && <span className="rounded-full bg-muted px-2 py-0.5">{cur.status}</span>}
              </div>
              <h2 className="mt-1 truncate text-xl font-bold tracking-tight">{cur.title}</h2>
            </div>
            <span className="nums text-sm font-semibold text-muted-foreground">
              {sel! + 1} / {all.length}
            </span>
            <button onClick={() => open(Math.max(0, sel! - 1))} disabled={sel === 0} aria-label="Previous flow" className={iconBtn}>
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => open(Math.min(all.length - 1, sel! + 1))} disabled={sel === all.length - 1} aria-label="Next flow" className={iconBtn}>
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prototype guide</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight">User flows · {areas}</h2>
          </div>
        )}
        <button onClick={a.resetDemo} aria-label="Restart the prototype" title="Restart the prototype" className={iconBtn}>
          <RotateCcw className="size-[18px]" />
        </button>
        <button onClick={onClose} aria-label="Hide guide" title="Hide guide" className={iconBtn}>
          <PanelRightClose className="size-[18px]" />
        </button>
      </header>

      {cur ? (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-card px-8 py-3">
            <Legend />
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-teal">
              <MousePointerClick className="size-4" /> Click any box to show it on the phone
            </span>
          </div>
          <Canvas key={sel}>
            <Seq nodes={cur.flow} lane path="n" />
          </Canvas>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto bg-background px-8 py-7">
          <p className="text-[15px] text-muted-foreground">Pick a flow. Every box in it is clickable and sets the phone to that step.</p>
          {groups.map((g) => (
            <section key={g.title} className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                {g.features.map((f) => {
                  const idx = all.findIndex((x) => x.title === f.title);
                  return (
                    <button key={f.title} onClick={() => open(idx)} className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-teal hover:shadow-raised">
                      <span className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="nums grid size-8 place-items-center rounded-full bg-teal-deep text-sm font-bold text-white">{idx + 1}</span>
                          <span className="nums text-xs font-semibold text-muted-foreground">Scope #{f.n}</span>
                        </span>
                        <ArrowRight className="size-5 text-teal transition group-hover:translate-x-0.5" />
                      </span>
                      <span className="mt-4 text-[17px] font-semibold leading-snug">{f.title}</span>
                      <span className="mt-2 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <span>{countSteps(f.flow)} steps</span>
                        {countDecisions(f.flow) > 0 && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="size-3.5" /> {countDecisions(f.flow)} {countDecisions(f.flow) === 1 ? "decision" : "decisions"}
                          </span>
                        )}
                        {f.status && <span className="rounded-full bg-muted px-2 py-0.5">{f.status}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </FlowCtx.Provider>
  );
}

const countSteps = (ns: Node[]): number => ns.reduce((n, x) => n + 1 + (x.br ?? []).reduce((m, [, sub]) => m + countSteps(sub), 0), 0);
const countDecisions = (ns: Node[]): number => ns.reduce((n, x) => n + (x.k === "decision" ? 1 : 0) + (x.br ?? []).reduce((m, [, sub]) => m + countDecisions(sub), 0), 0);

/* ---------------- Flowchart pieces ---------------- */

/** Dotted FigJam-like board. Flows zoom to fit the width (65%–120%), then scroll. */
function Canvas({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      if (!outer.current || !inner.current) return;
      const avail = outer.current.clientWidth - 64;
      const need = inner.current.scrollWidth;
      setZoom(Math.max(0.65, Math.min(1.2, avail / need)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="flex-1 overflow-auto bg-background px-8 py-10" style={{ backgroundImage: "radial-gradient(#D3D7D5 1.2px, transparent 1.2px)", backgroundSize: "20px 20px" }}>
      <div style={{ zoom }} className="mx-auto w-max">
        <div ref={inner} className="w-max">
          {children}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const item = "flex items-center gap-1.5 text-xs font-semibold text-muted-foreground";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className={item}>
        <span className="h-3.5 w-6 rounded-full bg-teal-deep" /> Start / end
      </span>
      <span className={item}>
        <span className="h-3.5 w-5 rounded-[4px] border-[1.5px] border-teal bg-card" /> Screen
      </span>
      <span className={item}>
        <span className="h-3.5 w-5 rounded-[4px] bg-yellow-soft" /> Driver action
      </span>
      <span className={item}>
        <span className="h-3.5 w-5 rounded-[4px] border border-dashed border-control bg-muted" /> App / system
      </span>
      <span className={item}>
        <span className="size-3 rotate-45 bg-coral-soft ring-1 ring-coral/50" /> Decision
      </span>
      <span className={item}>
        <span className="h-3.5 w-5 rounded-[3px] border border-dashed border-info bg-info-bg" /> Dispatch / customer sees
      </span>
    </div>
  );
}

function Arrow({ h = 28, label, onClick }: { h?: number; label?: string; onClick?: () => void }) {
  return (
    <div className="relative flex flex-col items-center" style={{ height: h }}>
      <div className="w-[1.5px] flex-1 bg-control" />
      <div className="size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-control" />
      {label && (
        <button
          onClick={onClick}
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold text-foreground shadow-card transition hover:border-teal hover:text-teal-deep"
        >
          {label}
        </button>
      )}
    </div>
  );
}

function Effect({ text }: { text: string }) {
  return <div className="w-[170px] rotate-[0.6deg] rounded-[4px] border border-dashed border-info bg-info-bg px-3 py-2 text-xs font-semibold leading-snug text-teal-deep shadow-card">{text}</div>;
}

function Box({ n, id, go, lane = true }: { n: Node; id: string; go?: Go; lane?: boolean }) {
  const { active, hit } = useContext(FlowCtx);
  const on = active === id;
  const shape =
    n.k === "start" || n.k === "end"
      ? cn("justify-center rounded-full px-5 py-2.5 text-center font-semibold", n.k === "start" ? "bg-teal-deep text-white" : "border-2 border-teal-deep bg-card text-teal-deep")
      : n.k === "screen"
        ? "rounded-xl border-[1.5px] border-teal bg-card px-3.5 py-3 font-medium"
        : n.k === "action"
          ? "rounded-lg bg-yellow-soft px-3.5 py-3 font-medium shadow-card"
          : "rounded-xl border border-dashed border-control bg-muted px-3.5 py-3 text-muted-foreground";
  return (
    <button
      onClick={() => hit(id, go)}
      title="Show this on the phone"
      className={cn(
        "relative flex items-start gap-2 text-left text-[13px] leading-snug transition",
        lane ? "w-[240px]" : "w-[190px]",
        shape,
        "hover:-translate-y-px hover:shadow-raised",
        on && "ring-[3px] ring-coral ring-offset-2 ring-offset-background",
      )}
    >
      {n.k === "screen" && <Smartphone className="mt-px size-4 shrink-0 text-teal" />}
      <span className="min-w-0 flex-1">{n.t}</span>
      {on && <span className="absolute -right-2 -top-2.5 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white shadow-card">On phone</span>}
    </button>
  );
}

function Diamond({ t, id, go, small }: { t: string; id: string; go?: Go; small?: boolean }) {
  const { active, hit } = useContext(FlowCtx);
  const on = active === id;
  return (
    <button onClick={() => hit(id, go)} title="Show this on the phone" className={cn("group relative grid place-items-center transition hover:-translate-y-px", small ? "h-[92px] w-[196px]" : "h-[104px] w-[230px]")}>
      <svg viewBox="0 0 200 92" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <polygon points="100,3 197,46 100,89 3,46" fill="#FBE4D6" stroke={on ? "#B85C36" : "#B85C36"} strokeOpacity={on ? 1 : 0.5} strokeWidth={on ? 3 : 1.5} />
      </svg>
      <span className="relative max-w-[60%] text-center text-[13px] font-semibold leading-tight text-coral-deep">{t}</span>
      {on && <span className="absolute -top-2.5 right-6 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white shadow-card">On phone</span>}
    </button>
  );
}

/** One node, with its effect note to the right (main lane) or below (inside a branch). */
function NodeRow({ n, id, go, lane }: { n: Node; id: string; go?: Go; lane: boolean }) {
  if (!n.fx) return <Box n={n} id={id} go={go} lane={lane} />;
  if (lane)
    return (
      <div className="grid grid-cols-[190px_auto_190px] items-center">
        <span />
        <Box n={n} id={id} go={go} lane />
        <div className="flex items-center">
          <span className="w-5 border-t border-dashed border-info" />
          <Effect text={n.fx} />
        </div>
      </div>
    );
  return (
    <div className="flex flex-col items-center">
      <Box n={n} id={id} go={go} lane={false} />
      <span className="h-3 border-l border-dashed border-info" />
      <Effect text={n.fx} />
    </div>
  );
}

/** A vertical run of nodes. A node without its own `go` uses the closest one before it, so every box is clickable. */
function Seq({ nodes, lane = false, path, inherit }: { nodes: Node[]; lane?: boolean; path: string; inherit?: Go }) {
  let last = inherit;
  return (
    <div className={cn("flex flex-col items-center", lane && "w-full")}>
      {nodes.map((n, i) => {
        const id = `${path}.${i}`;
        const go = n.go ?? last;
        last = go;
        const more = i < nodes.length - 1;
        if (n.k !== "decision") {
          return (
            <Fragment key={i}>
              <NodeRow n={n} id={id} go={go} lane={lane} />
              {more && <Arrow />}
            </Fragment>
          );
        }
        const br = n.br ?? [];
        // Each column draws its own piece of the split / merge bar, so the bar meets every column centre even when widths differ.
        const bar = (j: number) => ({ left: j === 0 ? "50%" : 0, right: j === br.length - 1 ? "50%" : 0 });
        return (
          <Fragment key={i}>
            <Diamond t={n.t} id={id} go={go} small={!lane} />
            <div className="h-3 w-[1.5px] bg-control" />
            <div className="flex w-full items-stretch">
              {br.map(([label, sub], j) => (
                <BranchCol key={label} label={label} sub={sub} id={`${id}.${j}`} go={go} bar={br.length > 1 ? bar(j) : null} merge={more} />
              ))}
            </div>
            {more && <Arrow />}
          </Fragment>
        );
      })}
    </div>
  );
}

function BranchCol({ label, sub, id, go, bar, merge }: { label: string; sub: Node[]; id: string; go?: Go; bar: { left: string | number; right: string | number } | null; merge: boolean }) {
  const { hit } = useContext(FlowCtx);
  const first = sub[0];
  return (
    <div className="relative flex flex-auto basis-0 flex-col items-center px-3" style={{ minWidth: "max-content" }}>
      {bar && <div className="absolute top-0 h-[1.5px] bg-control" style={bar} />}
      {merge && bar && <div className="absolute bottom-0 h-[1.5px] bg-control" style={bar} />}
      {/* The branch label jumps to the first step of that branch. */}
      <Arrow h={40} label={label} onClick={() => hit(`${id}.0`, first?.go ?? go)} />
      <Seq nodes={sub} path={id} inherit={go} />
      {merge && <div className="min-h-5 w-[1.5px] flex-1 bg-control" />}
    </div>
  );
}
