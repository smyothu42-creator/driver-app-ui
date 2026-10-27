import { BellRing, CalendarPlus, Lock, MessageSquare, Route, Volume2 } from "lucide-react";
import { useApp, useT, type NotifPrefs } from "../store";
import { Card, cn, IconChip, SectionLabel, Toggle, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * Oct 27 2026: Me → Notifications. The driver picks what pings them.
 *   Route changes, time changes and cancellations always notify (safety, UX skill §14), so they're shown locked.
 *   Request reminders can be more or less often, never off: dispatch needs an answer.
 *   Turning a type off only stops the banner; the message still lands in the Inbox.
 * ------------------------------------------------------------------ */
const EVERY: NotifPrefs["reminderHours"][] = [1, 2, 4];

export function NotificationSettings() {
  const { s, a } = useApp();
  const t = useT();
  const p = s.notifPrefs;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t("Notifications")} onBack={a.back} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section>
          <SectionLabel>{t("Always on")}</SectionLabel>
          <Card className="flex items-center gap-3 bg-muted/60 p-4">
            <IconChip tone="dark">
              <Route />
            </IconChip>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t("Route changes & cancellations")}</div>
              <div className="text-2xs text-muted-foreground">{t("New times, new stop order, cancelled stops")}</div>
            </div>
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-label={t("Always on")} />
          </Card>
        </section>

        <section>
          <SectionLabel>{t("Delivery requests")}</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<CalendarPlus />} title={t("New requests")} sub={t("Accept right from the notification")}>
              <Toggle on={p.requests} label={t("New requests")} onChange={(v) => a.setNotifPrefs({ requests: v })} />
            </Row>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <IconChip>
                  <BellRing />
                </IconChip>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t("Remind me to answer")}</div>
                  <div className="text-2xs text-muted-foreground">{t("Until you accept or decline")}</div>
                </div>
              </div>
              <div role="radiogroup" aria-label={t("Remind me to answer")} className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-border-strong bg-white p-1">
                {EVERY.map((h) => (
                  <button
                    key={h}
                    role="radio"
                    aria-checked={p.reminderHours === h}
                    onClick={() => a.setNotifPrefs({ reminderHours: h })}
                    className={cn("nums h-11 rounded-full text-[15px] font-semibold transition-colors", p.reminderHours === h ? "bg-teal-deep text-white" : "text-foreground/70")}
                  >
                    {t("Every")} {h} h
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel>{t("Other")}</SectionLabel>
          <Card className="divide-y divide-border">
            <Row icon={<MessageSquare />} title={t("Messages from dispatch")} sub={p.messages ? t("Banner and inbox") : t("Inbox only")}>
              <Toggle on={p.messages} label={t("Messages from dispatch")} onChange={(v) => a.setNotifPrefs({ messages: v })} />
            </Row>
            <Row icon={<Volume2 />} title={t("Sound & vibration")} sub={p.sound ? t("On") : t("Silent")}>
              <Toggle on={p.sound} label={t("Sound & vibration")} onChange={(v) => a.setNotifPrefs({ sound: v })} />
            </Row>
          </Card>
          <p className="mt-2 px-1 text-2xs text-muted-foreground">{t("Turned-off notifications still show in your Inbox.")}</p>
        </section>
      </div>
    </div>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="truncate text-2xs text-muted-foreground">{sub}</div>
      </div>
      {children}
    </div>
  );
}
