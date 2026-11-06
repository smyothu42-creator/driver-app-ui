import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ban, BellRing, ChevronDown, ChevronUp, CalendarPlus, Clock, Info, ListOrdered, MessageSquare, Phone, Send } from "lucide-react";
import { sentBy, useApp, useT, type Msg } from "../store";
import { fmtTime } from "../data/route";
import { Button, cn, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #6 In-app messages to and from dispatch (replaces texting drivers).
 * #15 Time changes and cancellations land here as high-priority messages, with a push banner.
 * Nov 6 2026 (review): a driver has one chat, with Dispatch, and for now no other (until Superfine says different).
 * Everyone with the dispatch staff role reads and replies in it, so it's a group chat from the driver's side: each
 * reply shows who wrote it, and the driver never picks a person. With only one chat there's no list: the Chat tab is
 * the chat. "Message" on a stop or request opens the same chat full screen, with Back. Notices (requests, reminders,
 * time changes) are in it too: tap one to open what it's about.
 * Replies are presets first: no typing while working (UX skill §13), with a message box under them for the rest.
 * Oldest at the top, newest at the bottom next to the replies, opened scrolled to the newest (review Oct 22 2026).
 * ------------------------------------------------------------------ */

const QUICK = ["On my way", "Running about 10 min late", "Loaded and leaving the kitchen", "Please call me when you can"];

let quickShown = true;

const ICON: Record<Msg["kind"], typeof Info> = { time: Clock, cancel: Ban, route: ListOrdered, request: CalendarPlus, reminder: BellRing, info: Info, reply: MessageSquare };

/** Where a message about a stop, a request or a setting opens. */
function useOpenMsg() {
  const { a } = useApp();
  return (m: Msg) => {
    if (m.requestId) a.push({ name: "request", id: m.requestId });
    else if (m.stopId) a.push({ name: "stop", id: m.stopId });
    else if (m.goto === "schedule") a.setTab("schedule");
    else if (m.goto === "availability") a.push({ name: "availability" });
    else if (m.goto === "vehicle") a.push({ name: "vehicle" });
  };
}
const canOpen = (m: Msg) => !!(m.requestId || m.stopId || m.goto);

/* ---------------- The chat with dispatch ---------------- */

/** `tab`: shown as the Chat tab, with the bottom nav and no Back. Otherwise it's opened over a stop, request or schedule. */
export function Inbox({ tab }: { tab?: boolean }) {
  const { s, a } = useApp();
  const t = useT();
  const openMsg = useOpenMsg();
  const msgs = s.inbox;
  // Opening the chat marks it read (clears the count on the Chat tab).
  useEffect(() => a.markInboxRead(), [msgs.length, a]);
  // Start at the newest message, and follow new ones (a reply, or a message from dispatch) as they arrive.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);
  // Stay on the newest message when the list changes height (keyboard up or down, quick messages shown or hidden).
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const ro = new ResizeObserver(() => (el.scrollTop = el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [custom, setCustom] = useState(""); // the draft in the message box
  // The box grows with the message, up to five lines or so, then scrolls.
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [custom]);
  // Oct 27 2026: the premade messages show by default; the button beside the box hides them (and brings them back).
  // Remembered while the app is open, so a driver who hid them doesn't get them back on every visit.
  const [quick, setQuickState] = useState(quickShown);
  const setQuick = (v: boolean) => setQuickState((quickShown = v));
  const sendCustom = () => {
    if (!custom.trim()) return;
    a.sendToDispatch(custom.trim());
    setCustom("");
  };

  return (
    // On the Chat tab the box sits above the bottom nav, which steps aside while typing.
    <div className={cn("flex h-full flex-col", tab && "pb-[92px] has-[textarea:focus]:pb-0")}>
      <TopBar
        title={t("Chat")}
        subtitle={t("Anyone on dispatch can reply")}
        onBack={tab ? undefined : a.back}
        tone="mint"
        right={
          <Button variant="outline" size="md" className="shrink-0 gap-1.5 px-3.5" onClick={() => a.toast("Calling dispatch…")}>
            <Phone /> {t("Call")}
          </Button>
        }
      />
      {/* s.inbox is newest first; shown oldest first. A short list sits at the bottom, by the replies. */}
      <ol ref={list} className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto px-4 py-4 [&>li:first-child]:mt-auto">
        {[...msgs].reverse().map((m, i, all) => {
          const mine = m.from === "you";
          // Several people write here: name the sender when it changes, like a group chat.
          const before = all[i - 1];
          const named = !mine && (before?.from !== "dispatch" || sentBy(before) !== sentBy(m));
          const tappable = canOpen(m);
          const Tag = tappable ? "button" : "div";
          const Icon = ICON[m.kind];
          const high = !mine && m.priority === "high";
          // A notice from dispatch (a request, reminder or time change) keeps its icon; a plain message is just a bubble.
          const notice = !mine && (m.kind !== "info" || tappable);
          return (
            <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {named && <span className="mb-1 ml-3.5 mt-1 text-[13px] font-semibold text-muted-foreground">{sentBy(m).split(" ")[0]}</span>}
              <Tag
                onClick={tappable ? () => openMsg(m) : undefined}
                className={cn("flex max-w-[86%] gap-3 rounded-2xl px-3.5 py-2.5 text-left", mine ? "rounded-br-md bg-teal-deep text-white" : high ? "rounded-bl-md border-2 border-coral/60 bg-card shadow-card" : "rounded-bl-md border border-border bg-card shadow-card", tappable && "active:scale-[0.99]")}
                {...(mine ? { "data-dark-surface": "" } : {})}
              >
                {notice && (
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]", high ? "bg-coral-soft text-coral-deep" : "bg-teal-wash text-teal")}>
                    <Icon />
                  </span>
                )}
                <span className="min-w-0">
                  <span className={cn("block text-[15px] leading-snug", notice ? "font-semibold" : "font-medium")}>{m.title}</span>
                  {m.body && <span className={cn("mt-0.5 block text-[13px] leading-snug", mine ? "text-white/80" : "text-muted-foreground")}>{m.body}</span>}
                  <span className={cn("nums mt-1 block text-2xs", mine ? "text-right text-white/60" : "text-muted-foreground")}>
                    {fmtTime(m.at)}
                    {tappable && " · tap to open"}
                  </span>
                </span>
              </Tag>
            </li>
          );
        })}
      </ol>

      {/* Tapping Send, a quick message or Hide keeps the box focused, like a messaging app: the keyboard stays up and
          nothing jumps out from under the finger mid-tap. */}
      <div
        onMouseDown={(e) => {
          if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
        }}
        className={cn("group/box shrink-0 border-t border-border bg-card px-4 pt-3 has-[textarea:focus]:pb-3", tab ? "pb-3" : "pb-7")}
      >
        {/* Oct 26 2026: premade messages; one tap sends one to dispatch. Oct 27 2026: shown by default, Hide folds them away. */}
        {/* Nov 4 2026 (review): hidden, the quick messages fold down to their own header row ("Quick messages · Show"),
            the same row as when they're open, instead of a "Quick" pill squeezed beside the message box. */}
        {/* While typing (keyboard up) they step aside, so the conversation keeps the room. */}
        {!quick && (
          <button onClick={() => setQuick(true)} aria-expanded={false} className="-mt-1 mb-2 flex h-11 w-full items-center justify-between group-has-[textarea:focus]/box:hidden">
            <span className="text-overline">{t("Quick messages")}</span>
            <span className="flex items-center gap-1 px-1 text-[13px] font-semibold text-teal-deep">
              <ChevronUp className="size-4" /> {t("Show")}
            </span>
          </button>
        )}
        {quick && (
          <div className="anim-fade mb-3 group-has-[textarea:focus]/box:hidden">
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
          <textarea
            ref={box}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={1}
            placeholder={`${t("Message dispatch")}…`}
            aria-label={t("Message dispatch")}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-control bg-card px-4 py-2.5 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
          />
          <button type="submit" aria-label="Send" disabled={!custom.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-teal text-white disabled:bg-muted disabled:text-muted-foreground">
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
