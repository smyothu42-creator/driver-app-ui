import { useEffect } from "react";
import { Ban, BellRing, CalendarPlus, Clock, Info, ListOrdered, MessageSquare, Send } from "lucide-react";
import { useApp, useT, type Msg } from "../store";
import { DISPATCH, fmtTime } from "../data/route";
import { cn, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #6 In-app messages to and from dispatch (replaces texting drivers).
 * #15 Time changes and cancellations land here as high-priority messages, with a push banner.
 * Replies are presets only: no typing while working (UX skill §13).
 * ------------------------------------------------------------------ */

const QUICK = ["On my way", "Running about 10 min late", "Loaded and leaving the kitchen", "Please call me when you can"];

const ICON: Record<Msg["kind"], typeof Info> = { time: Clock, cancel: Ban, route: ListOrdered, request: CalendarPlus, reminder: BellRing, info: Info, reply: MessageSquare };

export function Inbox() {
  const { s, a } = useApp();
  const t = useT();
  // Opening the inbox marks everything read (clears the bell badge on Home).
  useEffect(() => a.markInboxRead(), [s.inbox.length, a]);

  const open = (m: Msg) => {
    if (m.requestId) a.push({ name: "request", id: m.requestId });
    else if (m.stopId) a.push({ name: "stop", id: m.stopId });
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t("Inbox")} subtitle={`With dispatch · ${DISPATCH.name}`} onBack={a.back} />
      <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {s.inbox.map((m) => {
          const Icon = ICON[m.kind];
          const mine = m.from === "you";
          const tappable = !!(m.requestId || m.stopId);
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
        <div className="text-overline mb-2">{t("Message dispatch")}</div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => a.sendToDispatch(q)} className="flex h-11 items-center gap-1.5 rounded-full border border-control bg-card px-3.5 text-[13px] font-semibold active:bg-teal-wash">
              <Send className="size-3.5 text-teal" /> {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
