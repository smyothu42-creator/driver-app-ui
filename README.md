# Superfine Kitchen — Driver App (UI prototype)

A clickable, mobile-native-style prototype of the SFK driver app. It is **UI only**:
no backend, no real GPS or camera. The map is real (see "Map" below) and needs internet. Everything is sample data, and refreshing the
page starts the day again. It exists as a reference for the real build.

Look and feel follow the Superfine design system
(`superfine/docs/DESIGN-SYSTEM.md`, extracted from the corporate employee app): cream
page, white cards, petrol teal for structure, coral only for the one main action,
lemon yellow as a surface, big rounded corners.

## How to open it

1. Open **Terminal** (press ⌘ Space, type "Terminal", press Enter).
2. Paste this and press Enter:
   ```
   cd ~/claude-workspace/sfk-driver-app && pnpm dev
   ```
3. Open **http://localhost:5180** in Chrome.

On a laptop you see the app in a phone frame. **Phone view** (bottom-right) fills the window with the mobile layout; "Exit phone view" or Esc goes back.
On a phone (same Wi-Fi, use the "Network" address Terminal prints) the app fills the screen.

To stop it, click the Terminal window and press Ctrl + C.

## Design timeline gate (3-week sprint plan, Oct 13 – 30 2026)

**Route & stop**, **Kitchen load**, **Drop-off** (Sprint 1), **Schedule & assignments** (Sprint 2, shown Oct 19) are shown right now; crew / roles / lead attendance stay hidden under their own `team` area. Nothing is deleted:
every other feature stays in the code, shows a **Coming soon** screen ("Being designed in Sprint 1 ·
Thu, Oct 15") or is left out of a screen, and its flows are left out of the guide panel. Add an area to
`LIVE` in `src/data/sprints.ts` to reveal it (`team`, `profile`). Reusable pickup was added on Oct 21.

| Area (sprint) | Shown now | Hidden for now |
|---|---|---|
| Route & stop (1) | Home next stop, **Route** tab (map with swipeable stop cards; pin tap brings its card to the middle), stop details (address, instructions, parking/access photos, contacts, backup), in-app navigation + arrive, call contact / dispatch, re-order push, pickup stop label + icon | — |
| Kitchen load (1) | Kitchen pickup row; **scan packing slip** → package items → slide "loaded, in transit" (#9, Proposed); slip QR → **public delivery page** + "Are you a driver?" into the app for arrival and drop (#10, Proposed); **time since loading** chip on the next stop, amber 15 min before SFK's 60-min food-safety limit, red past it (#22, Proposed · parking lot) | — |
| Drop-off (1) | Setup checklist on arrival, set by company or address (#11, Agreed); camera + proof with photos, notes, on time / delayed (#4, Agreed); delivered with who received it, setup + service end logged separately (#12, Agreed); delivered away from the address warns + flags dispatch (#13, Agreed); location + time logged with every delivery, shown on the stop (#75, Agreed); problem flow with step prompts, photos, call dispatch (#21, Agreed); office override for an appless driver from the dispatch board (#74, Agreed); "Setup by" tag | — |
| Crew (1, `team`) | — | Crew / roles / lead in-out on the stop, "Reassigned" tag |
| Schedule & assignments (2) | **Schedule** tab in the Home / Route / Stop style (mint header + "Requested · Coming up · Time off" card, Route-style request cards with work type, one-word status). Dispatch sends requests (#19); **Accept** or **Can't do it** with a reason (#18); reminder every `requestReminderHours`, warning + dispatch flag under `requestFlagHours` (48 h); pending requests show full detail incl. multi-day ("Accept all 3 days") (#20); **Coming up** by day with rough times checked against that day's open hours (#17); **Your open hours**, read-only (#16); **Time off** ≥ 7 days ahead, Requested → Approved by dispatch, warns when the day has accepted work (#76). Counts (meals) left off, per the Oct 14 review. **Dispatch view** button (desktop) opens the SFK Admin dispatch page beside the phone: *Driver pending / accepted / declined* + reason, ⚑ under-48 h flag, last/next reminder + *Send reminder now*, *Send a new request*, unassigned orders, **open hours editor** (push to the driver), time-off approve / decline (push to the driver). `DispatchPage.tsx` | — |
| Notifications (2) | **Inbox** from the Home bell (unread count), push banners, quick replies to dispatch (presets only). Request reminders, open-hours changes and time-off answers land here and open Schedule / Time off when tapped | — |
| Reusables (2, shown Oct 21) | **Pickup windows**: each reusables pickup shows its window with a live status (opens at / open · N min left / closes in N min / missed) on the Route row, Home card and stop screen (`windowStatus` in `src/data/route.ts`). **Pick up at the next delivery to the same address**: a pickup whose address matches a delivery still to do rides along with it ("+ Reusables pickup" on the delivery, "Also pick up here" → Count on its stop screen); if it isn't collected there it becomes its own stop again (`pickupDelivery` / `pickupsAt` in `src/store.tsx`, sample `p2` Mirendil). **Ask dispatch to skip**: reason sheet → "Skip requested"; dispatch approves (pickup drops off the route, "Skipped") or declines ("Dispatch needs this pickup today") in the Dispatch view. **Count + photo**, and anything short opens the **problem flow** pre-filled with what's missing (photo carried over). **Packing list** sheet: readable on the phone, Download (file) and Share | — |
| Profile (3) | Ready toggle (needed to reach the route). The prototype opens already signed in; sign-in and permissions are skipped (`initial()` in `src/store.tsx`) | Me tab, Vehicle + "Use SFK Van 2", Location sharing page, Spanish |
| Not in plan | — | History (removed from the tab bar Oct 15 2026; **to be added to the Me / profile page when Profile is designed**), offline, update prompt |

The skip buttons are prototype-only so reviewers can walk the whole route. Not built yet from Route &
stop: "send home" after the last stop, site-to-site transfers as their own stop.

## Design review fixes (Oct 14 2026)

| Review note | What changed |
|---|---|
| Instructions before departure and during navigation; clearer next step on arrival | Home next-stop card shows parking + drop-off note. Stop screen puts **How to deliver** first (park → get in + photo → drop off → set up → also collect). Navigation has an **Instructions** sheet. On arrival the same list becomes **You're here · do these in order**, numbered, ending in "Finish · take a delivery photo" above that button (`StopInstructions` in `StopDetail.tsx`). |
| Show the type of work at every stop | `WorkTags` (Hot / Cold / Reusables pickup, combinable, icon + word) on route rows, next-stop card, stop screen, map cards and navigation. Derived by `workOf()` in `src/data/route.ts`. |
| Remove bag / container counts | Gone from the stop screen ("24 meals"), kitchen card ("3 orders"), scanner, packing slip, claimed-order sheet and problem flow ("What's affected?"). The load checklist ticks one row per order. `Stop.bags` stays internal only for hot / cold. |
| Navigation not decided | **Changed Oct 20 2026:** turn-by-turn opens in **Google Maps** to start; the in-app navigation screen stays behind it with the same buttons (ETA, work + parking, Instructions, Call, slide when you arrive) and a top card that reopens Google Maps. Was (Oct 14 2026): **in-app navigation only**. Start navigation opens the in-app map (turn card, ETA, work + parking, Instructions sheet, slide when you arrive). The Google Maps hand-off and the Google Maps button on the stop map were removed. |
| Next action obvious, routes ~1–3 stops | Sample route is now 3 deliveries + 1 reusables pickup. Every state still has one primary button. |
| Delivery flow (Oct 15 2026) | Most routes are 1–3 stops; drivers load a few orders and deliver in route order. **Hot goes first and there's only one hot order per vehicle**, so the sample route has one hot order (stop 1, Neptune) and the rest cold. Reusables pickups happen at the same stop as a drop-off (Neptune's totes) or later in the route (Brightline). Load loop: scan a package's QR → **package screen** lists the items inside (`PackageScreen` in `src/screens/Pickup.tsx`) → check each item → "Scan next package" → … → slide "loaded, in transit" after the last package. There's no "Load vehicle" overview (removed Oct 15 2026): the Home "Loaded" count, the kitchen card on Route and "Load at kitchen first" all go through `openLoad` to the package still being checked, or the scanner. **More than one kitchen pickup per route**: each delivery has a `run` (1 = first pickup, 2 = back to the kitchen). The sample route is run 1 = Neptune (hot) + Mirendil, run 2 = Daniel Kim, then the Brightline reusables pickup. "Today's route" shows a kitchen pickup row before each run; once run 1 is delivered the Home card becomes "Back to the kitchen" (ready 12:40 PM) with its own scan → check loop (`rollRun` / `runStops` / `isLoaded` in `src/store.tsx`). Not yet enforced: same-day requests (Schedule, hidden) can still add a second hot order. |

## SFK feedback fixes (Oct 20 2026)

| Feedback | What changed |
|---|---|
| Use the real Superfine address | Kitchen is **1661 Tennessee St, San Francisco, CA 94107** ([SFK's Google Maps pin](https://maps.app.goo.gl/4Zp2bH6YPgz64PHm6)). Map pin, street routes from the kitchen and drive times were re-fetched from there (`KITCHEN` in `src/data/route.ts`, `PLACES.k` / `LEGS` in `src/data/geo.ts`). |
| Estimated drive time between stops on the travel cards | Route tab cards show **"14 min drive from the kitchen · 3.7 mi"**, "6 min drive from Neptune Corp", and the second kitchen card "10 min drive back from Mirendil Inc". Home's timing line adds the drive. `driveBetween()` in `route.ts` (OSRM times padded for midday traffic; the routing provider in production). |
| Kitchen pickup: what are they getting? | Home kitchen card lists **every order on this pickup**: hot / cold, name, order type, size ("24 meals" / "Serves 20"), deliver-by, and its status (Not scanned / 12/24 / Checked). A line notes the later pickup. Tapping an order opens the same order screen a scan opens. |
| Scan any slip; block slips not on the route | Scanner sheet lists **all of today's slips** (this pickup, then later pickups). Whichever one is scanned opens that order. A slip not on the driver's route shows **"This isn't on your route. Discuss with dispatch."** with Call dispatch / Scan another slip, and nothing else moves forward. Prototype: "Demo: scan a slip that's not on your route". An order opened from the list stays locked until its slip is scanned. |
| Hot / cold only at order level | Items no longer carry hot / cold. One symbol at the top of the order (and on each order row) from its **packaging type** (`tempsOf()`). |
| Checking 50–100 meals; no A–F name groups | Individual-meal orders list **one row per person's meal** (Neptune: 24 names). Family style lists **each main with its included sides** (`Bag.group`). Long orders get search ("Find a name or dish") and **All / To check** filters, a progress bar and a **Saved** mark: every tick is saved immediately (localStorage in the prototype), so the driver can leave and resume. |
| Show how many more deliveries before "slide to start" | Every order screen shows a strip **"1 more order to pick up before you start"** (one segment per order), then the next action. The slide only appears once every order on the pickup is checked: "All 2 orders checked". |
| "Where to deliver": details button or infinite scroll? | Infinite scroll: the Home card has **no details button**. It holds call buttons (Customer / SFK Team), parking, get in, delivery instructions, the order, the window and setup steps, with timing + the one action pinned at the bottom. The stop screen is still reachable from the Route tab. |
| Google Maps for navigation | See "Navigation" above. |
| Messaging (needs Sheldon) | **Open question, not built.** The navigation "Call" sheet has preset messages to **dispatch** (in-app, #6). Texting customers (presets + custom) needs a feature built; checking with Sheldon and the team whether it's easy. |

## The five driver jobs → screens

| # | Job | Where it lives |
|---|-----|----------------|
| 1 | **See all their orders** | **Home** tab: duty card, route progress, next-step card. **Schedule** tab: requests and upcoming days. **Route** tab: every stop on a map, with a swipeable row of stop cards. |
| 2 | **Interact with orders, see instructions** | **Kitchen loading checklist** (bag by bag, hot/cold). **Stop details**: drop-off note for *this order*, building access for *this address* (+ entrance photo), setup steps for family-style, items, reusable totes to collect, contact. **Contact** sheet (masked call, quick texts). **Report a problem** sheet → dispatch. |
| 3 | **Navigation** | In-app map with a turn card, live ETA, on-time/late, parking + **Instructions**, **slide when you arrive**. |
| 4 | **Photo of delivered order** | Camera with framing guide → **Proof of delivery** (up to 3 photos, handed-to / left-at, note) → **slide to complete**. Photos also appear on the stop and in **History**. |
| 5 | **Let SFK track them** | Permissions on first sign-in. Tracking is tied to the **shift**: start shift = sharing, end shift = stops instantly. **Location sharing** page explains who sees what. A location arrow shows in the status bar while sharing. |

Design choices worth keeping in the real app:
- **The workflow is always visible.** One step tracker (`StepTrack`), Accept → Pick up → Deliver → Confirm
  (assigned stops skip Accept), sits on the Today "Your next step" card, stop details,
  the "added to your route" sheet, the loading checklist and proof of delivery. Today shows one next step with one button.
- **Lists stay quiet.** A route row shows at most one tag (what to act on first). Roles, crew, totes and
  hot/cold live on the stop screen.
- **Slide-to-confirm** for "loaded", "arrived" and "complete": no accidental taps while carrying bags.
- **Buttons say the next step**, e.g. "Take a photo to finish", "Tap to scan".
- **Two kinds of instructions, visually separated**: yellow = this order only (`Order.deliveryInstructions`), white = saved for the building (`Address.instructions`).
- Big touch targets (48–60 px) and one coral action per screen.

## Same-day assignments (replaces the old claim flow)

Per the scope review, **drivers don't browse or claim open deliveries**. Dispatch sends each
unassigned order to a driver as a request (guide panel → Dispatch → *Unassigned orders* → **Send to
Marcus**). The driver gets a push, sees it under **Schedule → Needs your answer** (and the yellow
nudge on Home), and accepts or declines with a reason. Accepting adds it to the end of today's route
("Added to your route" sheet). If the main kitchen pickup is already done, the next step is **Back to
kitchen to load** for that one order. State: `requests` (with `orderId`) and `claims` (internal
name kept: the unassigned orders a driver accepted) in `src/store.tsx`.

## Information architecture

```
Sign in → Permissions
└─ Tabs
   ├─ Today ── Kitchen loading checklist (whole route, or one same-day order)
   │        ├─ Stop details ── Navigate ── (arrive) ── Stop details
   │        │               ├─ Camera ── Proof of delivery ── Delivered sheet → next stop
   │        │               ├─ Collect reusables (pickup stop, or totes with a delivery)
   │        │               ├─ Contact sheet · Report-a-problem sheet · Open-in-Maps sheet
   │        ├─ Scan packing slip ── Package items
   │        ├─ Inbox (bell)
   │        └─ Report a problem (4 steps)
   ├─ Route (map + stop cards) ─── Stop details
   ├─ Schedule ─ Request (accept / decline) · Time off
   └─ Me ──── Location sharing · Vehicle · Time off · Inbox · Language · Off duty · History (to add)
```

## How it connects to the other two products

The right-hand panel shows this live. Pick an order under "Follow an order" and click
through the phone.

| Driver does | Employee / customer app sees | SFK Admin sees (field) |
|---|---|---|
| Starts shift | — | Driver live on dispatch map |
| Confirms kitchen loading | All orders on the route → **On the way** ("2 stops before you") | `order.dispatchedAt` |
| Starts navigating to a stop | That customer only: live map + ETA | Phase "En route" |
| Slides "arrived" | Push: "Your driver has arrived" | Phase "At customer" |
| Completes with photo | **Delivered** + photo + note, then rating | `order.deliveredAt`, `status = DELIVERED`, `delivery.deliveryImage`, `delivery.deliveryNotes`, `delivery.deliveryOnTime` |
| Reports a problem | Nothing automatically (dispatch decides) | Alert on the order |
| Ends shift | — | Driver goes offline; unfinished stops flagged for reassignment |

Data the driver app **reads** from SFK Admin: route + stop order (dispatch), kitchen ready
time (`order.dispatchReadyAt`), bags/packaging, delivery window, `guestReadyTime`
(family style), contact person, saved building notes + photos (`address.instructionsFileUrl`).

Field names match `superfine/packages/db/prisma/schema.prisma` (`Order`, `Delivery`,
`Address`, user role `DRIVER`). The schema already has `Delivery.assignedUserId`,
`deliveryImage`, `deliveryNotes` and `deliveryOnTime`. Things the prototype implies that
are **not in the schema yet**: per-stop arrival time, multiple photos, handoff type /
received-by, issue reports, route sequence, live driver location, reusable-tote returns.

## Map

A real, draggable map of San Francisco (MapLibre GL 5 with free OpenFreeMap tiles, no
API key), recolored to the SFK palette. The layout borrows from Uber Eats:
- **Map credit:** the on-map "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" label is hidden in the prototype. The real app must still show it somewhere visible (OpenStreetMap ODbL / OpenMapTiles licence), e.g. an About or Legal screen. Map data © OpenStreetMap contributors, tiles OpenFreeMap / OpenMapTiles.
- **Route tab (map part):** cream base map, dashed teal route for the day (finished legs turn gray),
  round numbered pins (coral = next, green = done), and a name pill on the selected stop.
  Swiping the cards moves the map to that stop, and tapping a pin brings its card forward.
  Drag or zoom and a **Recenter** button appears.
- **Navigation:** the camera follows the driver's arrow, tilted and turned to the heading.
  Only the road still ahead is drawn. Dragging pauses following until you tap Recenter.
- **Stop details:** a fixed (non-draggable) close-up of the address.

Addresses and street routes are real (OpenStreetMap / OSRM). They were fetched once and
stored in `src/data/geo.ts`, so no routing service is called at runtime. With no internet
the map falls back to a plain cream background with the route and pins. Production would
swap in Mapbox or Google tiles and live routing behind the same `MapView` props.

## Availability, multi-driver and roles (US-813 / 814 / 815)

UI only, built on prototype state. No API or schema changes.

| Story | Driver phone | SFK Admin (guide panel → **Dispatch** tab) |
|---|---|---|
| **US-813 Availability** | **Me → Availability**: week view (default) or month view. Each day is Available (default), Unavailable (muted, crossed out) or Set hours (time window). The Save button commits the draft and shows the toast "Availability saved". | Marcus is grayed out in the driver field wherever his saved availability doesn't cover the delivery window. |
| **US-814 Multi-driver** | Stop details lists who else is on the stop. Route rows show "+N staff". If dispatch removes the driver, the row shows "Reassigned by dispatch". | Searchable checkbox multi-select. Closed, it shows 2 chips and then "+N more". Removing a chip removes only that person, inline. Board rows stack every name. The run sheet has one line per person. |
| **US-815 Role labels** | "Your role: Lead Event Staff" on the stop, plus a slate role pill on the route row. | Inline role dropdown per person, which saves on change. Slate pill on board rows, Role column on the run sheet. |

Legacy states render as before. A single driver with no role shows no role badge and no
placeholder (stops 1 and 4). New data shapes: `Availability` / `DayAvailability` in
`src/data/availability.ts`, `StaffRole` / `Assignment` / `StaffMember` in
`src/data/route.ts`. Selectors `isStaffAvailable`, `myAssignment` and `crewOn` are in
`src/store.tsx`. Not in the schema yet: availability, multiple assignees per delivery,
assignment role.

## Reviewed scope (driver app review, Oct 2026)

The review narrowed and changed some Phase 3 rows. Where the two disagree, **this table wins**.

| Reviewed feature | In the prototype |
|---|---|
| **Assignments and confirmation** | Assigned and upcoming deliveries on **Home** and **Schedule**. Every assignment arrives as a request: **Accept** or **Can't do it** (reason required). **No open-order browsing or claiming**: the Open orders screens were removed, and dispatch sends unassigned orders as requests. |
| **Availability and time off** | **Schedule → Your open hours**, set by dispatch and labelled as *not* a schedule. **Time off** is a *request*: days show **Requested** until dispatch approves (Dispatch tab → *Time-off requests*). Requested days stay assignable until approved. |
| **Delivery details and instructions** | Stop details with drop-off and address instructions. The **packing-slip QR page** has "Are you a driver?": signed in, it opens the stop; signed out, it goes to sign-in and then lands on that stop, plus "Don't have the app? Get it here". |
| **Delivery status and location** | Arrived → photo → delivered. Location is logged with "Delivered"; away from the address it **warns but never blocks** ("Slide to complete anyway") and flags dispatch. *Lower priority if time runs short.* |
| **Ready/on-duty toggle** | **One toggle: Ready = on duty.** While Ready, dispatch sees live location. The separate "ready for requests" switch was removed. Location page and the turn-on sheet say *this isn't your clock-in; payroll uses the SFK time clock*. |
| **Routes and navigation** | Assigned stops in order, with route updates by push: **re-order** (Simulate → *Re-order route*), **time change**, **cancel**. Turn-by-turn is **in the app**. |
| **Vehicle profile** | **Me → Vehicle**: the driver's car is the **default vehicle** (make, model, year), with **storage details** read-only. Dispatch changes the vehicle **per delivery** (Dispatch tab → open a row → *Vehicle*; a van in use elsewhere is greyed but pickable). The stop and loading checklist say "Use SFK Van 2". Headcount is marked **(optional)**. |
| **Reusable pickups** | A pickup is its own stop with a **Reusables pickup** label and icon, always after deliveries. **To collect** list with expected counts and a **Packing list** download. **Collect reusables**: count each item (starts at 0, "Matches expected" in one tap), **photo required**, shortfall goes to the dispatch lead (write off / pending). Totes collected with a delivery use the same counter. |
| **Event-staff use** | Roles on the stop (Driver, Event Staff, Lead Event Staff). **Nice-to-have, built light:** the lead sees **Mark in / Mark out** per staff member once on site; service end time is logged on setup + serve stops. |
| **Spanish option** | **Nice-to-have.** Me → Language; the sheet notes Superfine checks the Spanish before it ships. `src/i18n.ts` is the file SFK reviews. |

**Kept from the Phase 3 doc but not in the review list:** inbox with dispatch (#6), packing-slip
scan at the kitchen (#9), setup checklist (#11), problem flow (#21), food-safety timer (#22), offline
(#23) and update prompt (#24). Cut any of these if the review dropped them on purpose.

## Phase 3 driver app scope (Superfine · Phase 3 Driver App Scope, Oct 6 2026)

Every row of section 1 "Driver app" in the scope doc, mapped to the prototype. UI, flow and
logic only; nothing here talks to a backend. **Guide panel → Simulate** triggers what dispatch or
the phone does (time change, cancel, new request, offline, update, away from address).
**Guide panel → Screens → group 9** jumps straight to each Phase 3 screen.

| # | Scope row | Where it lives / how it behaves |
|---|---|---|
| 1 | Today's route, stops in order | **Home** route list (unchanged). Cancelled stops stay in the list, struck through, and drop out of counts, map and loading list (`liveRoute`). |
| 2 | Stop details incl. parking/access photos, backup contact | **Stop details**: "Saved for this address" card with set fields *Parking* and *Access* (+ parking & access photo), **Contacts** card with site contact and backup contact. Data: `Stop.parking`, `Stop.backupContact`. |
| 3 | Navigation in the app | Oct 20 2026: Google Maps for turn-by-turn, this screen kept with the same buttons. Before that, Oct 14 2026: "Start navigation" opens the in-app map (turn card, live ETA vs window, instructions, **slide when you arrive**). No Google Maps hand-off. |
| 4 | Photo and notes, marked on time or delayed | **Proof of delivery**: on-time / delayed banner computed against the window; delayed asks *why* with presets (`StopState.delayReason`); "Other" opens a free-text field (`delayNote`) that must be filled before the slide unlocks. |
| 5 | Live location while on duty | Unchanged: location runs only while on duty (status-bar arrow). |
| 6 | In-app notifications to and from dispatch | **Inbox** (bell on Home, Me → Inbox): dispatch messages, tap to open the stop or request; replies are **presets only** (no typing, no SMS). Unread count on the bell. |
| 7 | Driver login on own phone | Sign in (unchanged). Install path per note C is outside the app. |
| 8 | On and off duty | Merged with #78 into one **Ready** toggle (see Reviewed scope). Off = location off immediately. |
| 9 | Scan packing slip → load checklist → in transit | Home kitchen card lists this pickup's orders (tap → order screen). **Scan packing slip** → scanner listing today's slips → the scanned order's items to check (per meal / per main + sides) → "Scan next packing slip" → slide **"Loaded · start route"** once all orders are checked. Slips not on the route are blocked ("Discuss with dispatch"). |
| 10 | Slip QR opens public delivery page + "Are you a driver?" | **Public delivery page** (mobile-browser mock, progress bar + ETA, #57) with **Are you a driver?** → opens the stop in the app and counts as arrival. Screens → group 9. |
| 74 | Appless driver, override at SFK office | Dispatch: assign **"Appless driver (office)"** in the staff picker; Simulate → **Mark delivered at office**. Driver phone shows "Marked delivered at the SFK office" (`StopState.officeOverride`). |
| 11 | Setup checklist on arrival, by company or address | Stop details **Setup on arrival** with source label ("Set by Neptune Corp" / "Set for this address"). Visible before arrival, tickable only once arrived. Data: `Stop.setup`, `Stop.setupSource`. |
| 12 | Delivered logged with who received it; setup and serve end times separate | Proof: **Who received it?** is required when handed over (presets: site contact, backup, security). Setup+serve stops (`Stop.serve`): after Delivered, one button **Mark setup done**, then **End service** (`setupEndAt`, `serviceEndAt`). |
| 13 / 75 | Delivered away from the address warns + flags; log location | Proof shows "At the address · location logged", or a warning "You're 0.4 mi from…" and the slide reads **Slide to complete anyway**. Dispatch gets a flag (`StopState.deliveredAway`). Radius: `SETTINGS.deliveredRadiusMi`. |
| 14 | Tap to call site contact or dispatch | Stop details: three one-tap buttons **[Contact] [Dispatch] [Problem]**, plus call buttons on each contact. Calls go through an SFK number. |
| 15 | Push when time changes or order cancelled | Push banner at the top of the phone (tap opens the stop) + high-priority inbox message. Time change shows **New time** with old window struck; cancel shows a red banner with what to do with the food. |
| 16 | Dispatch sets open hours, driver views | **Schedule → Your open hours** (read-only, "Set by dispatch"). `OPEN_HOURS`. |
| 76 | Out of office at least X days ahead | **Time off** request: tap a day → sheet with that day's deliveries → **Request day off** (sent straight to dispatch, no checkboxes). Days inside `SETTINGS.timeOffNoticeDays` (7) are locked. Requests wait for dispatch approval. |
| 17 | Upcoming deliveries with rough times | **Schedule → Coming up**, grouped by day, "~11:30 AM". Recurring placeholders show as **Usual** ("order not in yet"). |
| 18 / 77 | Confirm every assignment; decline needs a comment; reminders; 48 h flag; statuses on dispatch | **Schedule → Needs your answer** (badge on the tab, nudge on Home). Request screen: **Accept** (primary) or **Can't do it** → reason presets, "Other" needs a few words. Under 48 h shows a warning to the driver and **⚑ Not accepted · under 48 h** on the dispatch board, where every request shows *Driver pending / accepted / declined*. Reminder interval `SETTINGS.requestReminderHours`. |
| 19 | Dispatch sends delivery requests | Dispatch tab **Send a new request** → push + inbox → request screen. |
| 20 | Orders visible before confirmed, incl. multi-day | Pending requests show full detail before accepting; multi-day orders (Summit Partners, 3 days) are one request listing every day. Per-order limit is a dispatch setting (not modelled). |
| 21 | Problem flow, step-by-step + photos, then call dispatch | **Report a problem** screen, 4 steps: what happened (can't get in / nobody there / food late / food unsafe / short / wrong) → prompts (call contact, call backup, waited; how late; which bags) → photo (required for food and order problems) → **Call dispatch now**. |
| 22 | Time since loading, food-safety warning (*parking-lot candidate*) | **Hidden Oct 21 2026** (not in SFK feedback, still Proposed); turn on with `SETTINGS.showFoodSafety`. Chip on the Home next-stop card: "Loaded 24 min ago" → amber "limit in 15 min" → red "past limit, call dispatch". `SETTINGS.foodSafetyMins` = 60. |
| 23 | Works offline, syncs later | Dark bar "Offline · saved on your phone · N will sync". Every driver action still works and is queued; going online toasts "N updates synced". |
| 24 | Update prompt / auto-update | Optional: sheet "New version ready · Update now / After this route". Required: full-screen block **Update to keep driving**. Me shows the version. |
| 25 | App in Spanish | Me → Language (English / Español). `src/i18n.ts` uses the English line as the key with fallback; covers tabs, Home, stop actions, navigation, proof, schedule, inbox, problem flow. **The rest of the strings still need adding** to that file (note B: one file for SFK to check). |
| 64 | Vehicle + capacity in profile | **Me → Vehicle**: default vehicle make, model, year; headcount (optional); **Storage details** read-only. Vehicle changes are per delivery (#79). |
| 78 | Driver turns "ready status" on/off | Same toggle as #8: **Ready = on duty**, on the Home status card and in Me. |

New screens: `Schedule.tsx` (Schedule tab, request detail), `Inbox.tsx`, `Problem.tsx`, `Scan.tsx`
(scanner + public page), `Vehicle.tsx`, `components/SystemLayer.tsx` (push banner, offline bar,
update gate). New state lives in `src/store.tsx` under "Phase 3"; settings SFK controls are
`SETTINGS` in `src/data/route.ts`.

**Not in the schema yet (implied by the above):** request/confirmation record with status, reason
and reminders; open hours; time-off entries; ready status; vehicle profile + vehicle assignment per
order; scanned-slip log; delivered location + distance flag; received-by; setup end and service end
times; delay reason; dispatch messages; problem report with type, prompts and photos; app version
check.

**Decisions made in the prototype, to confirm with SFK:**
- Customer quick texts were removed from the contact sheet because texting customers is in the parking lot; quick messages go to dispatch instead. Oct 20 2026: SFK would like texting (standard + custom messages) if it's easy to build; **pending Sheldon / dev team**.
- Drivers can no longer set hours per day (dispatch owns open hours, #16); they only book whole days out of office.
- Scanning a slip doesn't gate "in transit"; the bag checklist does (open question 10: does the kitchen sign off the load?).

## Files

- `src/data/route.ts`: all sample data (driver, kitchen, 4 assigned stops, 3 open orders, tomorrow, history)
- `src/store.tsx`: prototype state + the actions every button calls
- `src/screens/`: one file per area (Today, Pickup, StopDetail, Navigate, Proof, Tabs, Sheets, Onboarding)
- `src/components/ConnectionsPanel.tsx`: the user-flows guide; no longer shown (removed Oct 16 2026), kept for reference
- `src/components/DispatchBoard.tsx`: SFK Admin dispatch board, `DriverMultiSelect`, role dropdown, run sheet
- `src/screens/Availability.tsx`: driver availability (week/month)
- `src/screens/Collect.tsx`: count reusables against the expected count, photo, packing list
- `src/data/availability.ts`: availability types and date helpers
- `src/data/geo.ts`: real coordinates and pre-fetched street routes
- `src/components/MapView.tsx`: the real map (theme, pins, route, follow camera)
- `tailwind.config.js`: Superfine design tokens
