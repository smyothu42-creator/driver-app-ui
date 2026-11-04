import { useState } from "react";
import { Navigation } from "lucide-react";
import { useApp, useT } from "../store";
import { DISPATCH_CONTACT_URL } from "../data/route";
import { Button, cn, SfkLogo } from "../components/ui";

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

/* ------------------------------------------------------------------
 * Nov 4 2026 (review: "change all this to the system look of the phone OS"): the first sign-in no longer shows our
 * own "Before your first route" sheet. The phone asks, one native iOS alert at a time, in the order iOS uses:
 *   1. Location (Allow Once / Allow While Using App / Don't Allow), with the map preview and "Precise: On"
 *   2. If "While Using": the follow-up "Change to Always Allow" / "Keep Only While Using"
 *   3. Notifications   4. Camera
 * What our sheet used to explain lives in each alert's message (the app's purpose string), as on a real phone.
 * ------------------------------------------------------------------ */
type PermStep = "location" | "always" | "notifications" | "camera";

export function PermissionsSheet() {
  const { a } = useApp();
  const t = useT();
  const [step, setStep] = useState<PermStep>("location");
  const app = "\u201CSFK Driver\u201D";

  if (step === "location")
    return (
      <SystemAlert
        key={step}
        title={`Allow ${app} to use your location?`}
        message={t("Your location is shared with SFK dispatch and your customers only while you're on duty, so they see live ETAs.")}
        extra={<MapPreview />}
        stacked
        actions={[
          { label: "Allow Once", run: () => (a.setPerm({ location: "while" }), setStep("notifications")) },
          { label: "Allow While Using App", preferred: true, run: () => (a.setPerm({ location: "while" }), setStep("always")) },
          { label: "Don\u2019t Allow", run: () => (a.setPerm({ location: "off" }), setStep("notifications")) },
        ]}
      />
    );
  if (step === "always")
    return (
      <SystemAlert
        key={step}
        title={`Allow ${app} to also use your location even when you are not using the app?`}
        message={t("Keeps your ETA live while you're on duty, even when you switch to Maps or the screen is off.")}
        stacked
        actions={[
          { label: "Keep Only While Using", run: () => setStep("notifications") },
          { label: "Change to Always Allow", preferred: true, run: () => (a.setPerm({ location: "always" }), setStep("notifications")) },
        ]}
      />
    );
  if (step === "notifications")
    return (
      <SystemAlert
        key={step}
        title={`${app} Would Like to Send You Notifications`}
        message="Notifications may include alerts, sounds, and icon badges. These can be configured in Settings."
        actions={[
          { label: "Don\u2019t Allow", run: () => (a.setPerm({ notifications: false }), setStep("camera")) },
          { label: "Allow", preferred: true, run: () => (a.setPerm({ notifications: true }), setStep("camera")) },
        ]}
      />
    );
  return (
    <SystemAlert
      key={step}
      title={`${app} Would Like to Access the Camera`}
      message={t("Take a photo at each drop-off. It's attached to the order as proof of delivery.")}
      actions={[
        { label: "Don\u2019t Allow", run: () => (a.setPerm({ camera: false }), a.finishPerms()) },
        { label: "Allow", preferred: true, run: () => (a.setPerm({ camera: true }), a.finishPerms()) },
      ]}
    />
  );
}

/**
 * iOS system alert, Liquid Glass style (Nov 4 2026, review: "use iOS 27"): a wider frosted-glass card with deep
 * rounded corners, text aligned to the leading edge, and capsule buttons. The preferred action is the filled blue
 * capsule; the others are grey glass. Two actions sit side by side, three or more stack.
 */
function SystemAlert({ title, message, extra, actions, stacked }: { title: string; message: string; extra?: React.ReactNode; actions: { label: string; run: () => void; preferred?: boolean }[]; stacked?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/20 px-6 anim-fade" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="anim-alert w-full max-w-[300px] rounded-[34px] bg-white/75 p-4 text-left text-black shadow-[0_20px_60px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(255,255,255,0.7)] backdrop-blur-2xl backdrop-saturate-150"
      >
        <div className="px-2 pt-1.5">
          <h2 className="text-[17px] font-semibold leading-[22px] tracking-[-0.4px]">{title}</h2>
          <p className="mt-1 text-[15px] leading-5 tracking-[-0.2px] text-black/70">{message}</p>
        </div>
        {extra && <div className="mt-3 overflow-hidden rounded-[20px]">{extra}</div>}
        <div className={cn("mt-4 gap-2", stacked ? "flex flex-col" : "grid grid-cols-2")}>
          {actions.map((x) => (
            <button
              key={x.label}
              onClick={x.run}
              className={cn(
                "h-12 rounded-full px-3 text-[17px] font-medium tracking-[-0.4px] transition active:scale-[0.97]",
                x.preferred ? "bg-[#0088FF] text-white" : "bg-black/[0.07] text-black active:bg-black/[0.12]",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The little map iOS shows in the location prompt, with the "Precise: On" pill. */
function MapPreview() {
  return (
    <div
      aria-hidden
      className="relative h-[140px]"
      style={{
        background:
          "linear-gradient(90deg, transparent 47%, #fff 47%, #fff 53%, transparent 53%), linear-gradient(0deg, transparent 38%, #fff 38%, #fff 43%, transparent 43%), linear-gradient(28deg, transparent 70%, #fff 70%, #fff 73%, transparent 73%), linear-gradient(160deg, #E6EEDF 0%, #EEF1E8 55%, #CFE2EC 100%)",
      }}
    >
      <span className="absolute left-[18%] top-[14%] h-10 w-14 rounded-md bg-[#D5E6C8]" />
      <span className="absolute bottom-[10%] right-[8%] h-9 w-20 rounded-md bg-[#BFD9E8]" />
      <span className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0088FF]/15" />
      <span className="absolute left-1/2 top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#0088FF] shadow" />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#0088FF] shadow-sm">
        <Navigation className="size-3 fill-current" /> Precise: On
      </span>
    </div>
  );
}
