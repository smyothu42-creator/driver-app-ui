import { useEffect, useRef, useState } from "react";
import { Ban, BellRing, ChevronDown, CalendarPlus, Clock, Info, ListOrdered, MessageSquare, Phone, Send, Zap } from "lucide-react";
import { useApp, useT, type Msg } from "../store";
import { DISPATCH, fmtTime } from "../data/route";
import { Button, cn, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #6 In-app messages to and from dispatch (replaces texting drivers).
 * #15 Time changes and cancellations land here as high-priority messages, with a push banner.
 * Replies are presets first: no typing while working (UX skill §13). Oct 26 2026: a message box with a send button
 * under them, like a messaging app, for what the presets don't cover; and Call dispatch in the top bar.
 * Like a chat (review Oct 22 2026): oldest at the top, newest at the bottom next to the replies, opened scrolled to the newest.
 * ------------------------------------------------------------------ */

const QUICK = ["On my way", "Running about 10 min late", "Loaded and leaving the kitchen", "Please call me when you can"];

let quickShown = true;

const ICON: Record<Msg["kind"], typeof Info> = { time: Clock, cancel: Ban, route: ListOrdered, request: CalendarPlus, reminder: BellRing, info: Info, reply: MessageSquare };

export function Inbox() {
  const { s, a } = useApp();
  const t = useT();
  // Opening the inbox marks everything read (clears the bell badge on Home).
  useEffect(() => a.markInboxRead(), [s.inbox.length, a]);
  // Start at the newest message, and follow new ones (a reply, or a message from dispatch) as they arrive.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.inbox.length]);

  const [custom, setCustom] = useState(""); // the draft in the message box
  // Oct 27 2026: the premade messages show by default; the button beside the box hides them (and brings them back).
  // Remembered while the app is open, so a driver who hid them doesn't get them back on every visit.
  const [quick, setQuickState] = useState(quickShown);
  const setQuick = (v: boolean) => setQuickState((quickShown = v));
  const sendCustom = () => {
    if (!custom.trim()) return;
    a.sendToDispatch(custom.trim());
    setCustom("");
  };

  const open = (m: Msg) => {
    if (m.requestId) a.push({ name: "request", id: m.requestId });
    else if (m.stopId) a.push({ name: "stop", id: m.stopId });
    else if (m.goto === "schedule") a.setTab("schedule");
    else if (m.goto === "availability") a.push({ name: "availability" });
    else if (m.goto === "vehicle") a.push({ name: "vehicle" });
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={t("Inbox")}
        subtitle={`With dispatch · ${DISPATCH.name}`}
        onBack={a.back}
        tone="white"
        right={
          <Button variant="outline" size="md" className="shrink-0 gap-1.5 px-3.5" onClick={() => a.toast(`Calling ${DISPATCH.name}…`)}>
            <Phone /> {t("Call")}
          </Button>
        }
      />
      {/* s.inbox is newest first; shown oldest first. A short list sits at the bottom, by the replies. */}
      <ol ref={list} className="flex flex-1 flex-col space-y-2 overflow-y-auto px-4 py-4 [&>li:first-child]:mt-auto">
        {[...s.inbox].reverse().map((m) => {
          const Icon = ICON[m.kind];
          const mine = m.from === "you";
          const tappable = !!(m.requestId || m.stopId || m.goto);
          const Tag = tappable ? "button" : "div";
          return (
            <li key={m.id} className={cn("flex", mine && "justify-end")}>
              <Tag
                onClick={tappable ? () => open(m) : undefined}
                className={cn(
                  "flex max-w-[88%] gap-3 rounded-2xl p-3.5 text-left",
                  mine ? "bg-teal-deep text-white" : m.priority === "high" ? "border-2 border-coral/60 bg-card shadow-card" : "border border-border bg-card shadow-card",
                  tappable && "active:scale-[0.99]",
                )}
                {...(mine ? { "data-dark-surface": "" } : {})}
              >
                {!mine && (
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]", m.priority === "high" ? "bg-coral-soft text-coral-deep" : "bg-teal-wash text-teal")}>
                    <Icon />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug">{m.title}</span>
                  {m.body && <span className={cn("mt-0.5 block text-[13px] leading-snug", mine ? "text-white/80" : "text-muted-foreground")}>{m.body}</span>}
                  <span className={cn("nums mt-1 block text-2xs", mine ? "text-white/60" : "text-muted-foreground")}>
                    {mine ? "You" : "Dispatch"} · {fmtTime(m.at)}
                    {tappable && " · tap to open"}
                  </span>
                </span>
              </Tag>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border bg-card px-4 pb-7 pt-3">
        {/* Oct 26 2026: premade messages; one tap sends one to dispatch. Oct 27 2026: shown by default, Hide folds them away. */}
        {quick && (
          <div className="anim-fade mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-overline">{t("Quick messages")}</span>
              <button onClick={() => setQuick(false)} className="-my-2 flex h-11 items-center gap-1 px-1 text-[13px] font-semibold text-teal-deep">
                <ChevronDown className="size-4" /> {t("Hide")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => a.sendToDispatch(q)}
                  className="flex h-11 items-center gap-1.5 rounded-full border border-control bg-card px-3.5 text-[13px] font-semibold active:bg-teal-wash"
                >
                  <Send className="size-3.5 text-teal" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Oct 26 2026: an always-there message box with a send button, like a messaging app. */}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendCustom();
          }}
        >
          {!quick && (
            <button
              type="button"
              aria-label="Show quick messages"
              aria-expanded={false}
              onClick={() => setQuick(true)}
              className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-control bg-card px-3 text-[13px] font-semibold text-teal-deep"
            >
              <Zap className="size-4" /> {t("Quick")}
            </button>
          )}
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={1}
            placeholder="Message dispatch…"
            aria-label="Custom message to dispatch"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] border border-control bg-card px-4 py-2.5 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
          />
          <button type="submit" aria-label="Send" disabled={!custom.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-teal text-white disabled:bg-muted disabled:text-muted-foreground">
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
