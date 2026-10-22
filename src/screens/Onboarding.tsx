import { Bell, Camera, Check, MapPin, ShieldCheck } from "lucide-react";
import { useApp, type LocationPerm } from "../store";
import { Button, cn, IconChip } from "../components/ui";

export function SignIn() {
  const { s, a } = useApp();
  return (
    <div className="flex h-full flex-col">
      <div className="hero-yellow relative px-6 pb-10 pt-12">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-teal-deep px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-yellow">
          Driver
        </div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-teal-deep">
          Superfine
          <br />
          Kitchen
        </h1>
        <p className="mt-3 max-w-[16rem] text-[15px] font-medium text-teal-deep">Your routes, stops and proof of delivery, all in one place.</p>
      </div>
      <div className="-mt-5 flex-1 rounded-t-3xl bg-background px-6 pt-7">
        {s.afterSignIn && (
          <p className="mb-4 rounded-xl bg-teal-wash p-3 text-[13px] font-semibold text-teal-deep">Sign in and we'll open the stop from the packing slip.</p>
        )}
        <label className="text-overline mb-1.5 block">Work email</label>
        <input
          defaultValue="marcus.reyes@superfinekitchen.com"
          className="h-12 w-full rounded-xl border border-control bg-card px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        <label className="text-overline mb-1.5 mt-4 block">Password</label>
        <input
          type="password"
          defaultValue="driverdemo"
          className="h-12 w-full rounded-xl border border-control bg-card px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        <Button size="lg" className="mt-6 w-full" onClick={a.signIn}>
          Sign in
        </Button>
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Driver accounts are created by SFK admin.
          <br />
          Trouble signing in? Call dispatch.
        </p>
      </div>
    </div>
  );
}

const LOC_OPTIONS: { v: LocationPerm; title: string; body: string }[] = [
  { v: "always", title: "Always, during shifts", body: "Recommended. Tracking keeps working when the app is in the background or the screen is off." },
  { v: "while", title: "Only while the app is open", body: "Customers may see stale ETAs when you switch to Maps." },
];

export function Permissions() {
  const { s, a } = useApp();
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-6 pb-4 pt-8">
        <IconChip tone="yellow" className="size-14 rounded-2xl [&_svg]:size-7">
          <ShieldCheck />
        </IconChip>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Before your first route</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">SFK needs three permissions so customers get live ETAs and every drop-off has proof.</p>
      </div>

      <div className="space-y-3 px-4 pb-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex gap-3">
            <IconChip>
              <MapPin />
            </IconChip>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Location</div>
              <p className="text-[13px] text-muted-foreground">Shared with SFK dispatch and your customers <b className="font-semibold text-foreground">only while you're on shift</b>.</p>
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
                  <span className="block text-[15px] font-semibold">{o.title}</span>
                  <span className="block text-2xs text-muted-foreground">{o.body}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <PermRow icon={<Camera />} title="Camera" body="Take a photo at each drop-off. It's attached to the order as proof of delivery." on={s.camera} onAllow={() => a.setPerm({ camera: true })} />
        <PermRow icon={<Bell />} title="Notifications" body="New stops, route changes and messages from dispatch." on={s.notifications} onAllow={() => a.setPerm({ notifications: true })} />
      </div>

      <div className="mt-auto px-4 pb-8">
        <Button size="lg" className="w-full" disabled={s.location === "off"} onClick={a.finishPerms}>
          {s.location === "off" ? "Choose a location setting" : !s.camera ? "Continue without camera" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function PermRow({ icon, title, body, on, onAllow }: { icon: React.ReactNode; title: string; body: string; on: boolean; onAllow: () => void }) {
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
          Allow
        </Button>
      )}
    </div>
  );
}
