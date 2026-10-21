import type { ReactNode } from "react";
import { BatteryFull, ChevronLeft, Navigation, Signal, Wifi } from "lucide-react";
import { useApp } from "../store";
import { cn } from "./ui";

/** Fake iOS status bar for the desktop frame only; a real phone (and Phone view) shows its own. */
function StatusBar({ dark, full, backLink }: { dark: boolean; full: boolean; backLink?: { label: string; onClick: () => void } }) {
  const { s } = useApp();
  const h = ((Math.floor(s.clock / 60) + 11) % 12) + 1;
  const m = (s.clock % 60).toString().padStart(2, "0");
  const tracking = s.shiftOn && s.location !== "off";
  return (
    <div className={cn("absolute inset-x-0 top-0 z-[60] flex h-[50px] items-end justify-between px-8 pb-1.5 text-[15px] font-semibold max-[500px]:hidden", full && "hidden", dark ? "text-white" : "text-foreground")}>
      {backLink ? (
        // iOS "back to app" link: shown in place of the clock when another app (here Google Maps) was opened from ours.
        <button onClick={backLink.onClick} className="-ml-3 flex items-center gap-0.5 text-[13px] font-semibold text-[#007AFF]">
          <ChevronLeft className="size-4" strokeWidth={2.6} /> {backLink.label}
        </button>
      ) : (
        <span className="nums flex items-center gap-1">
          {h}:{m}
          {tracking && <Navigation className="size-3 fill-current" aria-label="Location in use" />}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <Signal className="size-4" />
        <Wifi className="size-4" />
        <BatteryFull className="size-5" />
      </span>
    </div>
  );
}

/**
 * iPhone 15-size frame (393 × 852). Phone-width viewers get the app full-screen instead,
 * and `full` (the "Phone view" button) does the same on a desktop window.
 */
export function PhoneFrame({ children, top, full = false, backLink }: { children: ReactNode; top: "light" | "teal" | "tealSoft" | "mint" | "black"; full?: boolean; backLink?: { label: string; onClick: () => void } }) {
  return (
    <div className={cn("relative h-[852px] w-[393px] shrink-0 rounded-[60px] bg-[#1d1d1f] p-[11px] shadow-[0_30px_80px_rgba(1,65,63,0.35)] max-[500px]:h-[100dvh] max-[500px]:w-full max-[500px]:rounded-none max-[500px]:p-0 max-[500px]:shadow-none", full && "h-[100dvh] w-full rounded-none p-0 shadow-none")}>
      <div className={cn("no-scrollbar-all relative h-full w-full overflow-hidden rounded-[49px] max-[500px]:rounded-none", full && "rounded-none", { light: "bg-background", teal: "bg-teal-deep", tealSoft: "bg-[#CFE8E8]", mint: "bg-white", black: "bg-black" }[top])}>
        <StatusBar dark={top === "teal" || top === "black"} full={full} backLink={backLink} />
        <div className={cn("absolute left-1/2 top-[11px] z-[61] h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black max-[500px]:hidden", full && "hidden")} />
        {/* On a real phone the app starts under the phone's own status bar (safe area), not a fake 50px one. */}
        <div className={cn("absolute inset-0 overflow-hidden pt-[50px] max-[500px]:pt-[env(safe-area-inset-top)]", full && "pt-[env(safe-area-inset-top)]")}><div className="relative h-full bg-background">{children}</div></div>
        <div className={cn("pointer-events-none absolute bottom-2 left-1/2 z-[61] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground/80 max-[500px]:hidden", full && "hidden")} />
      </div>
    </div>
  );
}
