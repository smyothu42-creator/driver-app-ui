import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowBigUp, ChevronLeft, Delete, Globe, Mic, Navigation } from "lucide-react";
import { useApp } from "../store";
import { cn } from "./ui";

/* Nov 4 2026: status bar glyphs drawn like iOS's own (filled signal bars, three-arc Wi-Fi, battery with its level). */
function SignalGlyph() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
      <rect x="0" y="8" width="3.2" height="4" rx="0.9" />
      <rect x="4.8" y="5.5" width="3.2" height="6.5" rx="0.9" />
      <rect x="9.6" y="3" width="3.2" height="9" rx="0.9" />
      <rect x="14.4" y="0" width="3.2" height="12" rx="0.9" />
    </svg>
  );
}
function WifiGlyph() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <path d="M8 2.3c2.3 0 4.4.9 6 2.4.2.2.5.2.7 0l1-1c.2-.2.2-.5 0-.7C13.7 1.1 11 0 8 0S2.3 1.1.3 3c-.2.2-.2.5 0 .7l1 1c.2.2.5.2.7 0C3.6 3.2 5.7 2.3 8 2.3Z" />
      <path d="M8 5.9c1.3 0 2.5.5 3.4 1.3.2.2.5.2.7 0l1-1c.2-.2.2-.5 0-.7A7.3 7.3 0 0 0 8 3.6c-1.9 0-3.7.7-5.1 1.9-.2.2-.2.5 0 .7l1 1c.2.2.5.2.7 0 .9-.8 2.1-1.3 3.4-1.3Z" />
      <path d="M10 9c.2-.2.2-.5 0-.7a3 3 0 0 0-4 0c-.2.2-.2.5 0 .7l1.6 1.6c.2.2.5.2.7 0L10 9Z" />
    </svg>
  );
}
function BatteryGlyph({ level = 0.8 }: { level?: number }) {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width={20 * level} height="9" rx="2.5" fill="currentColor" />
      <path d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2Z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

/**
 * Fake iOS status bar for the desktop frame only; a real phone (and Phone view) shows its own.
 * Nov 4 2026 (iPhone 18 Pro / iOS 27): the system font, the time centred in the left "ear" and the glyphs centred in
 * the right one, either side of the narrower Dynamic Island.
 */
function StatusBar({ dark, full, backLink }: { dark: boolean; full: boolean; backLink?: { label: string; onClick: () => void } }) {
  const { s } = useApp();
  const h = ((Math.floor(s.clock / 60) + 11) % 12) + 1;
  const m = (s.clock % 60).toString().padStart(2, "0");
  const tracking = s.shiftOn && s.location !== "off";
  return (
    <div
      className={cn("absolute inset-x-0 top-0 z-[60] grid h-[54px] grid-cols-[1fr_96px_1fr] items-center pt-1.5 max-[500px]:hidden", full && "hidden", dark ? "text-white" : "text-black")}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
    >
      <span className="flex justify-center pl-3">
        {backLink ? (
          // iOS "back to app" link: shown in place of the clock when another app (here Google Maps) was opened from ours.
          <button onClick={backLink.onClick} className="flex items-center gap-0.5 text-[13px] font-semibold text-[#0088FF]">
            <ChevronLeft className="size-4" strokeWidth={2.6} /> {backLink.label}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-[17px] font-semibold tracking-[-0.4px]" style={{ fontVariantNumeric: "normal" }}>
            {h}:{m}
            {tracking && <Navigation className="size-3 fill-current" aria-label="Location in use" />}
          </span>
        )}
      </span>
      <span />
      <span className="flex items-center justify-center gap-[7px] pr-3">
        <SignalGlyph />
        <WifiGlyph />
        <BatteryGlyph />
      </span>
    </div>
  );
}


/* ---------------- On-screen keyboard (desktop frame only) ----------------
 * Nov 4 2026 (review: "the input should be focused, and on mobile show the keyboard"): a real phone brings up its own
 * keyboard when a box is focused. The desktop frame fakes it: an iPhone-style keyboard slides up whenever a text box
 * in the phone is focused, the screen shrinks above it (as on iOS), and its keys type into the box. Phone view and real
 * phones never show it.
 */
const KB_HEIGHT = 291;
const isTextBox = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && el.matches("textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit])");

/** Put text into the focused box the way typing would, so React's onChange runs. */
function typeInto(el: HTMLInputElement | HTMLTextAreaElement, edit: (v: string, start: number, end: number) => { v: string; at: number }) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const { v, at } = edit(el.value, start, end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    el.setSelectionRange(at, at);
  } catch {
    /* number / email boxes have no caret position */
  }
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function Keyboard() {
  const [shift, setShift] = useState(true);
  const box = () => (isTextBox(document.activeElement) ? document.activeElement : null);
  // Capital letter at the start of the box and after a space when the box asks for words (like iOS).
  const autoShift = (v: string) => {
    const el = box();
    const cap = el?.getAttribute("autocapitalize");
    setShift(v.length === 0 || (cap === "words" && v.endsWith(" ")) || (cap !== "none" && /[.!?]\s$/.test(v)));
  };
  const press = (ch: string) => {
    const el = box();
    if (!el) return;
    const c = shift ? ch.toUpperCase() : ch;
    let next = "";
    typeInto(el, (v, a, b) => ((next = v.slice(0, a) + c + v.slice(b)), { v: next, at: a + c.length }));
    autoShift(next);
  };
  const back = () => {
    const el = box();
    if (!el) return;
    let next = "";
    typeInto(el, (v, a, b) => (a !== b ? ((next = v.slice(0, a) + v.slice(b)), { v: next, at: a }) : ((next = v.slice(0, Math.max(0, a - 1)) + v.slice(a)), { v: next, at: Math.max(0, a - 1) })));
    autoShift(next);
  };
  // Keys never take focus away from the box.
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const key = "grid h-[42px] place-items-center rounded-[8px] bg-white text-[22px] text-black shadow-[0_1px_0_rgba(0,0,0,0.3)] active:bg-[#AEB3BE]";
  const dark = "grid h-[42px] place-items-center rounded-[8px] bg-[#ABB0BA] text-black shadow-[0_1px_0_rgba(0,0,0,0.3)] active:bg-white";
  useEffect(() => {
    const el = box();
    if (el) autoShift(el.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      onMouseDown={keep}
      onPointerDown={keep}
      className="anim-kb absolute inset-x-0 bottom-0 z-[59] flex flex-col bg-[#D1D4DA]/95 px-[3px] pt-2 backdrop-blur-xl"
      style={{ height: KB_HEIGHT, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
      aria-label="Keyboard"
    >
      <div className="space-y-[11px]">
        {ROWS.map((row, i) => (
          <div key={row} className={cn("flex justify-center gap-[6px]", i === 1 && "px-[19px]")}>
            {i === 2 && (
              <button type="button" aria-label="Shift" onClick={() => setShift((x) => !x)} className={cn(dark, "mr-[8px] w-[42px]", shift && "bg-white")}>
                <ArrowBigUp className="size-[22px]" fill={shift ? "currentColor" : "none"} strokeWidth={1.6} />
              </button>
            )}
            {[...row].map((ch) => (
              <button key={ch} type="button" onClick={() => press(ch)} className={cn(key, "w-[32px] flex-none")}>
                {shift ? ch.toUpperCase() : ch}
              </button>
            ))}
            {i === 2 && (
              <button type="button" aria-label="Delete" onClick={back} className={cn(dark, "ml-[8px] w-[42px]")}>
                <Delete className="size-[22px]" strokeWidth={1.6} />
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-[6px] px-[3px]">
          <button type="button" className={cn(dark, "w-[88px] text-[16px]")}>123</button>
          <button type="button" onClick={() => press(" ")} className={cn(key, "flex-1 text-[16px]")}>
            space
          </button>
          <button type="button" onClick={() => box()?.blur()} className={cn(dark, "w-[88px] text-[16px]")}>
            done
          </button>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between px-6 pb-7 text-[#50555C]">
        <Globe className="size-[22px]" strokeWidth={1.6} />
        <Mic className="size-[22px]" strokeWidth={1.6} />
      </div>
    </div>
  );
}

/**
 * Nov 4 2026: iPhone 18 Pro frame (402 × 874 points, like the 17 Pro) in the new Dark Cherry finish: a thin polished
 * metal band around the black bezel, side buttons, and the narrower Dynamic Island (about 35% slimmer than before).
 * Phone-width viewers get the app full-screen instead, and `full` (the "Phone view" button) does the same on a desktop.
 */
export function PhoneFrame({ children, top, full = false, backLink }: { children: ReactNode; top: "light" | "teal" | "tealSoft" | "mint" | "black" | "yellow"; full?: boolean; backLink?: { label: string; onClick: () => void } }) {
  const sheet = useApp().s.sheet?.name;
  // The on-screen keyboard: shown while a text box in the phone has focus (desktop frame only).
  const screen = useRef<HTMLDivElement>(null);
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const el = screen.current;
    if (!el || full) return setKb(false);
    const framed = () => window.matchMedia("(min-width: 501px)").matches;
    const onIn = (e: FocusEvent) => setKb(framed() && isTextBox(e.target as Element));
    const onOut = () => setTimeout(() => setKb(framed() && isTextBox(document.activeElement) && el.contains(document.activeElement)), 0);
    // A box focused before this ran (e.g. autoFocus on a sheet that opened with the screen).
    setKb(framed() && isTextBox(document.activeElement) && el.contains(document.activeElement));
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    return () => {
      el.removeEventListener("focusin", onIn);
      el.removeEventListener("focusout", onOut);
    };
  }, [full]);
  const bare = "max-[500px]:h-[100dvh] max-[500px]:w-full max-[500px]:rounded-none max-[500px]:p-0 max-[500px]:shadow-none";
  return (
    <div
      className={cn("relative h-[874px] w-[402px] shrink-0 rounded-[66px] p-[3px] shadow-[0_30px_80px_rgba(60,10,20,0.35)]", !full && "frame-cherry", bare, full && "h-[100dvh] w-full rounded-none p-0 shadow-none")}
    >
      {/* Side buttons: Action button and volume on the left, power and Camera Control on the right. */}
      {!full && (
        <span aria-hidden className="max-[500px]:hidden">
          <span className="absolute -left-[3px] top-[150px] h-8 w-[4px] rounded-l-sm bg-[#4E1622]" />
          <span className="absolute -left-[3px] top-[210px] h-14 w-[4px] rounded-l-sm bg-[#4E1622]" />
          <span className="absolute -left-[3px] top-[280px] h-14 w-[4px] rounded-l-sm bg-[#4E1622]" />
          <span className="absolute -right-[3px] top-[230px] h-20 w-[4px] rounded-r-sm bg-[#4E1622]" />
          <span className="absolute -right-[3px] top-[480px] h-12 w-[4px] rounded-r-sm bg-[#3A0F18]" />
        </span>
      )}
      <div className={cn("h-full w-full rounded-[63px] bg-black p-[9px] max-[500px]:rounded-none max-[500px]:p-0", full && "rounded-none p-0")}>
        <div className={cn("no-scrollbar-all relative h-full w-full overflow-hidden rounded-[54px] max-[500px]:rounded-none", full && "rounded-none", { light: "bg-background", teal: "bg-teal-deep", tealSoft: "bg-[#CFE8E8]", mint: "bg-white", black: "bg-black", yellow: "bg-[linear-gradient(90deg,#F8EC58_0%,#F6E73A_60%,#F4E21E_100%)]" }[top])}>
          <StatusBar dark={top === "teal" || top === "black"} full={full} backLink={backLink} />
          {/* Nov 4 2026: a sheet or system alert dims the whole screen, status bar included, as iOS does. */}
          {sheet && <div aria-hidden className={cn("anim-fade pointer-events-none absolute inset-x-0 top-0 z-[60] h-[54px] max-[500px]:hidden", full && "hidden", sheet === "permissions" ? "bg-black/20" : "bg-teal-deep/40")} />}
          <div className={cn("absolute left-1/2 top-[12px] z-[61] h-[32px] w-[80px] -translate-x-1/2 rounded-full bg-black max-[500px]:hidden", full && "hidden")} />
          {/* On a real phone the app starts under the phone's own status bar (safe area), not a fake one. */}
          {/* While the keyboard is up, the app shrinks to the space above it, so sheets sit on top of the keyboard. */}
          <div
            ref={screen}
            className={cn("absolute inset-x-0 top-0 overflow-hidden pt-[54px] transition-[bottom] duration-300 ease-out max-[500px]:pt-[env(safe-area-inset-top)]", full && "pt-[env(safe-area-inset-top)]")}
            style={{ bottom: kb ? KB_HEIGHT : 0 }}
          >
            <div className="relative h-full bg-background">{children}</div>
          </div>
          {kb && <Keyboard />}
          <div className={cn("pointer-events-none absolute bottom-2 left-1/2 z-[61] h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-foreground/80 max-[500px]:hidden", full && "hidden")} />
        </div>
      </div>
    </div>
  );
}
