import { Bell, Camera, Check, MapPin } from "lucide-react";
import { useApp, useT, type LocationPerm } from "../store";
import { DISPATCH_CONTACT_URL } from "../data/route";
import { Button, cn, IconChip, SfkLogo, Sheet } from "../components/ui";

/** #7: the driver signs in once on their own phone and stays signed in. Language is picked here first (#25). */
export function SignIn() {
  const { s, a } = useApp();
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <div className="hero-yellow relative px-6 pb-10 pt-7">
        <div className="mb-8 flex items-center justify-between">
          {/* Oct 26 2026: the Superfine Kitchen logo here, not a "Driver" pill. */}
          <SfkLogo className="w-[100px] text-teal-deep" />
          <div role="radiogroup" aria-label="Language · Idioma" className="flex rounded-full bg-card/70 p-1">
            {(
              [
                ["en", "English"],
                ["es", "Español"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} role="radio" aria-checked={s.lang === v} onClick={() => a.setLang(v)} className={cn("h-9 rounded-full px-3 text-[13px] font-semibold", s.lang === v ? "bg-teal-deep text-white" : "text-teal-deep")}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-teal-deep">
          {/* Oct 26 2026: about the driver's day, not the company name (the logo carries that). */}
          {t("Ready for")}
          <br />
          {t("your route?")}
        </h1>
        <p className="mt-3 max-w-[16rem] text-[15px] font-medium text-teal-deep">{t("Your routes, stops and proof of delivery, all in one place.")}</p>
      </div>
      <div className="-mt-5 flex flex-1 flex-col rounded-t-3xl bg-background px-6 pb-8 pt-10">
        {s.afterSignIn && (
          <p className="mb-4 rounded-xl bg-teal-wash p-3 text-[13px] font-semibold text-teal-deep">{t("Sign in and we'll open the stop from the packing slip.")}</p>
        )}
        <label className="text-overline mb-1.5 block">{t("Work email")}</label>
        <input
          defaultValue="marcus.reyes@superfinekitchen.com"
          className="h-12 w-full rounded-xl border border-control bg-card px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        <label className="text-overline mb-1.5 mt-4 block">{t("Password")}</label>
        <input
          type="password"
          defaultValue="driverdemo"
          className="h-12 w-full rounded-xl border border-control bg-card px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        <Button size="lg" className="mt-6 w-full" onClick={a.signIn}>
          {t("Sign in")}
        </Button>
        <p className="mt-3 text-center text-[13px] font-semibold text-teal-deep">{t("Use your own phone. You stay signed in on it.")}</p>
        {/* Help, pinned to the bottom of the screen. */}
        <p className="mt-auto pt-4 text-center text-[13px] text-muted-foreground">
          {t("Driver accounts are created by SFK admin.")}
          <br />
          {t("Trouble signing in?")}{" "}
          <a href={DISPATCH_CONTACT_URL} target="_blank" rel="noreferrer" className="font-semibold text-teal-deep underline underline-offset-2">
            {t("Call dispatch")}
          </a>
        </p>
      </div>
    </div>
  );
}

const LOC_OPTIONS: { v: LocationPerm; title: string; body: string }[] = [
  { v: "always", title: "Always, while on duty", body: "Recommended. Tracking keeps working when the app is in the background or the screen is off." },
  { v: "while", title: "Only while the app is open", body: "Customers may see stale ETAs when you switch to Maps." },
];

/**
 * Oct 26 2026: a pop-up over the Route tab the first time a driver signs in on this phone (was a screen of its own).
 * It can't be swiped away: a location setting is needed before the first route.
 */
export function PermissionsSheet() {
  const { s, a } = useApp();
  const t = useT();
  return (
    <Sheet title={t("Before your first route")} onClose={() => {}}>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex gap-3">
            <IconChip>
              <MapPin />
            </IconChip>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t("Location")}</div>
              <p className="text-[13px] text-muted-foreground">
                {t("Shared with SFK dispatch and your customers")} <b className="font-semibold text-foreground">{t("only while you're on duty")}</b>.
              </p>
            </div>
          </div>
          <div role="radiogroup" className="mt-3 space-y-2">
            {LOC_OPTIONS.map((o) => (
              <button
                key={o.v}
                role="radio"
                aria-checked={s.location === o.v}
                onClick={() => a.setPerm({ location: o.v })}
                className={cn(
                  "flex w-full gap-3 rounded-xl border p-3 text-left",
                  s.location === o.v ? "border-teal bg-teal-wash" : "border-control bg-card",
                )}
              >
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", s.location === o.v ? "border-teal bg-teal" : "border-control")}>
                  {s.location === o.v && <span className="size-2 rounded-full bg-white" />}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{t(o.title)}</span>
                  <span className="block text-2xs text-muted-foreground">{t(o.body)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <PermRow icon={<Camera />} title={t("Camera")} body={t("Take a photo at each drop-off. It's attached to the order as proof of delivery.")} on={s.camera} onAllow={() => a.setPerm({ camera: true })} />
        <PermRow icon={<Bell />} title={t("Notifications")} body={t("New stops, route changes and messages from dispatch.")} on={s.notifications} onAllow={() => a.setPerm({ notifications: true })} />
      </div>

      {/* Stuck to the bottom of the sheet while the permissions scroll. */}
      <div className="sticky -bottom-8 -mx-5 -mb-8 mt-2 bg-card px-5 pb-8 pt-3">
        <Button size="lg" className="w-full" disabled={s.location === "off"} onClick={a.finishPerms}>
          {s.location === "off" ? t("Choose a location setting") : !s.camera ? t("Continue without camera") : t("Continue")}
        </Button>
      </div>
    </Sheet>
  );
}

function PermRow({ icon, title, body, on, onAllow }: { icon: React.ReactNode; title: string; body: string; on: boolean; onAllow: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="text-[13px] text-muted-foreground">{body}</p>
      </div>
      {on ? (
        <span className="grid size-9 place-items-center rounded-full bg-success-bg text-success">
          <Check className="size-5" />
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={onAllow}>
          {t("Allow")}
        </Button>
      )}
    </div>
  );
}
