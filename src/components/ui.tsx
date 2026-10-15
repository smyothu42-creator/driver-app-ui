import { Fragment, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Camera, Check, ChevronLeft, ChevronsRight, Flame, Hand, Package, Recycle, Snowflake, Truck } from "lucide-react";
import { workOf, type StaffRole, type Stop, type StopStatus, type Work } from "../data/route";
import sfkMark from "../assets/sfk-mark.png";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type Variant = "coral" | "teal" | "outline" | "ghost" | "yellow" | "danger-outline" | "dark";
const VARIANT: Record<Variant, string> = {
  coral: "bg-coral text-white hover:bg-coral-deep",
  teal: "bg-teal text-white hover:bg-teal-deep",
  outline: "border border-control bg-card text-foreground hover:bg-teal-wash",
  ghost: "text-teal hover:bg-teal-wash",
  yellow: "bg-yellow text-teal-deep hover:bg-yellow-deep",
  "danger-outline": "border border-danger bg-card text-danger hover:bg-danger-bg",
  dark: "bg-teal-deep text-white hover:bg-sidebar",
};
const SIZE = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-sm", lg: "h-14 px-6 text-base" };

export function Button({
  variant = "coral",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 [&_svg]:size-[18px] [&_svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "teal" | "yellow" | "coral" | "slate";
const TONE: Record<Tone, string> = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  info: "bg-info-bg text-info border-info-border",
  neutral: "bg-muted text-muted-foreground border-border-strong",
  teal: "bg-teal-wash text-teal-deep border-teal-soft",
  yellow: "bg-yellow-wash text-teal-deep border-yellow-deep/40",
  coral: "bg-coral text-white border-coral",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-semibold [&_svg]:size-3",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Staff role label (US-815). Slate on purpose: a role is not a status. No role → renders nothing. */
export function RoleBadge({ role, className }: { role?: StaffRole; className?: string }) {
  if (!role) return null;
  return (
    <Badge tone="slate" className={className}>
      {role}
    </Badge>
  );
}

export const STATUS_META: Record<StopStatus, { label: string; tone: Tone }> = {
  queued: { label: "Up next", tone: "neutral" },
  en_route: { label: "On the way", tone: "info" },
  arrived: { label: "Arrived", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  issue: { label: "Issue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ---------- Workflow step track ----------
 * The driver workflow (Claim → Pick up → Deliver → Confirm) as a simple full-width stepper: a circle
 * per step (check once done), joined by lines that stretch to fill the row and turn teal as steps
 * complete. The first and last circles sit at the edges. `current` past the last index = all done.
 */
const STEP_ICON: Record<string, typeof Check> = { Accept: Hand, "Pick up": Package, Deliver: Truck, Confirm: Camera };

export function StepTrack({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center pb-5", className)} aria-label="Workflow progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const Icon = state === "done" ? Check : (STEP_ICON[label] ?? Check);
        const align = i === 0 ? "left-0" : i === steps.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
        return (
          <Fragment key={label}>
            {i > 0 && (
              <li aria-hidden className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-border-strong/50">
                <span className="block h-full rounded-full bg-teal transition-[width] duration-500 ease-out" style={{ width: i <= current ? "100%" : "0%" }} />
              </li>
            )}
            <li aria-current={state === "current" ? "step" : undefined} className="relative shrink-0">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full transition-colors duration-300 [&_svg]:size-4",
                  state === "done" && "bg-teal-deep text-white",
                  state === "current" && "bg-coral text-white",
                  state === "todo" && "border-2 border-border-strong bg-card text-muted-foreground/70",
                )}
              >
                <Icon strokeWidth={state === "done" ? 3 : 2.2} />
              </span>
              <span
                className={cn(
                  "absolute top-full mt-1 whitespace-nowrap text-[11px] tracking-tight",
                  align,
                  state === "done" && "font-semibold text-teal-deep",
                  state === "current" && "font-bold text-coral-deep",
                  state === "todo" && "font-medium text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/* ---------- Temperature tag ----------
 * Hot / cold as a quiet inline label: a small icon and a word in a soft tint, no pill.
 */
export function TempTag({ temp }: { temp: "HOT" | "COLD" }) {
  const hot = temp === "HOT";
  const Icon = hot ? Flame : Snowflake;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-2xs font-medium", hot ? "text-coral-deep/80" : "text-teal/80")}>
      <Icon className="size-3.5" strokeWidth={2} />
      {hot ? "Hot" : "Cold"}
    </span>
  );
}

/* ---------- Work type ----------
 * Review Oct 14 2026: every stop shows the kind of work: hot delivery, cold delivery, reusables pickup, or a mix.
 * Icon + word + tint, so it never relies on colour alone.
 */
const WORK: Record<Work, { label: string; Icon: typeof Flame; cls: string; ink: string }> = {
  hot: { label: "Hot", Icon: Flame, cls: "bg-coral-soft text-coral-deep", ink: "text-coral" },
  cold: { label: "Cold", Icon: Snowflake, cls: "bg-info-bg text-info", ink: "text-info" },
  reusables: { label: "Reusables pickup", Icon: Recycle, cls: "bg-teal-soft text-teal-deep", ink: "text-teal" },
};
/**
 * Work type at a stop (hot / cold / reusables). `pill` (default) is the filled chip for detail screens;
 * `plain` is the quiet list version: coloured icon + grey word, no background.
 */
export function WorkTags({ stop, className, variant = "pill", onDark, strong }: { stop: Stop; className?: string; variant?: "pill" | "plain"; onDark?: boolean; strong?: boolean }) {
  // On a dark (Superfine green) surface the icons use light tints so they keep contrast.
  const darkInk: Record<Work, string> = { hot: "text-[#F6A985]", cold: "text-[#9FD6D8]", reusables: "text-yellow" };
  if (variant === "plain")
    return (
      <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)} aria-label="Work at this stop">
        {workOf(stop).map((w) => {
          const { label, Icon, ink } = WORK[w];
          return (
            <span key={w} className={cn("inline-flex items-center gap-1 text-[13px] font-medium", onDark ? "text-white/80" : strong ? "text-teal-deep" : "text-muted-foreground")}>
              <Icon className={cn("size-3.5", onDark ? darkInk[w] : ink)} strokeWidth={2.2} />
              {label}
            </span>
          );
        })}
      </span>
    );
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)} aria-label="Work at this stop">
      {workOf(stop).map((w) => {
        const { label, Icon, cls } = WORK[w];
        return (
          <span key={w} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-2xs font-semibold", cls)}>
            <Icon className="size-3.5" strokeWidth={2.2} />
            {label}
          </span>
        );
      })}
    </span>
  );
}

/** The script "S" from the Superfine Kitchen wordmark, drawn as a mask so it takes the current text colour. */
export function SfkMark({ className }: { className?: string; strokeWidth?: number }) {
  return <span aria-hidden className={cn("block bg-current", className)} style={{ maskImage: `url(${sfkMark})`, WebkitMaskImage: `url(${sfkMark})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} />;
}

/* ---------- Card ---------- */
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "block w-full rounded-2xl border border-border bg-card text-left shadow-card",
        onClick && "transition active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="text-[20px] font-bold leading-tight tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function IconChip({ children, tone = "teal", className }: { children: ReactNode; tone?: "teal" | "yellow" | "coral" | "success" | "dark"; className?: string }) {
  const t = {
    teal: "bg-teal-wash text-teal",
    yellow: "hero-yellow text-teal-deep",
    coral: "bg-coral-soft text-coral-deep",
    success: "bg-success-bg text-success",
    dark: "bg-teal-deep text-yellow",
  }[tone];
  return <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", t, className)}>{children}</span>;
}

/* ---------- Native-style top bar ---------- */
export function TopBar({
  title,
  subtitle,
  onBack,
  right,
  tone = "light",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  tone?: "light" | "dark" | "mint" | "hero" | "white";
}) {
  const dark = tone === "dark";
  return (
    <div
      {...(dark ? { "data-dark-surface": "" } : {})}
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center gap-1 px-2",
        dark ? "bg-teal-deep text-white" : tone === "mint" ? "border-b border-border bg-white text-foreground" : tone === "hero" ? "bg-[#CFE8E8] text-teal-deep" : tone === "white" ? "bg-white text-foreground" : "border-b border-border bg-background/95 backdrop-blur",
      )}
    >
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="Back"
          className={cn("grid size-10 place-items-center rounded-full", dark ? "hover:bg-sidebar-active" : "hover:bg-teal-wash")}
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold tracking-tight">{title}</div>
        {subtitle && <div className={cn("truncate text-2xs", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" className="anim-fade absolute inset-0 bg-teal-deep/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="anim-sheet relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-card px-5 pb-8 pt-3 shadow-raised">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong" />
        {title && <h3 className="mb-4 text-[22px] font-bold leading-tight tracking-tight">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Slide to confirm (prevents accidental taps while driving / carrying bags) ---------- */
export function SlideToConfirm({ label, onConfirm, tone = "coral" }: { label: string; onConfirm: () => void; tone?: "coral" | "teal" }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const KNOB = 52;

  const max = () => (track.current ? track.current.clientWidth - KNOB - 8 : 200);
  const end = () => {
    if (drag === null) return;
    if (x > max() * 0.85) {
      setX(max());
      window.setTimeout(onConfirm, 120);
    } else setX(0);
    setDrag(null);
  };

  return (
    <div
      ref={track}
      className={cn("relative h-[60px] select-none overflow-hidden rounded-full p-1", tone === "coral" ? "bg-coral" : "bg-teal")}
      onPointerMove={(e) => drag !== null && setX(Math.max(0, Math.min(max(), e.clientX - drag)))}
      onPointerUp={end}
      onPointerLeave={end}
    >
      <div className="pointer-events-none absolute inset-0 grid place-items-center pl-10 text-base font-semibold text-white">{label}</div>
      <button
        aria-label={label}
        onClick={() => onConfirm()}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(e.clientX - x);
        }}
        style={{ transform: `translateX(${x}px)`, transition: drag === null ? "transform 200ms" : "none" }}
        className={cn("relative grid size-[52px] cursor-grab place-items-center rounded-full bg-white", tone === "coral" ? "text-coral" : "text-teal")}
      >
        <ChevronsRight className="size-6" />
      </button>
    </div>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-8 w-[52px] shrink-0 rounded-full border transition-colors", on ? "border-teal bg-teal" : "border-control bg-muted")}
    >
      <span className={cn("absolute top-[3px] size-6 rounded-full bg-white shadow transition-all", on ? "left-[24px]" : "left-[3px]")} />
    </button>
  );
}

/* ---------- Bottom action bar (screen-level primary CTA) ---------- */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-20 space-y-2 border-t border-border bg-card/95 px-4 pb-7 pt-3 backdrop-blur">{children}</div>;
}

/**
 * Profile picture for a stop's customer. Companies get a rounded-square logo mark, people a round avatar.
 * Stand-in until real logos / photos come from the customer profile; colours are picked from the name so each
 * customer keeps the same look everywhere.
 */
const AVATAR_TONES = [
  ["#E3EEF9", "#24548C"],
  ["#FBE9DF", "#9A4524"],
  ["#E7F3EA", "#2D6B47"],
  ["#F3E8F7", "#6E3C86"],
  ["#FBF3D3", "#7A5A0E"],
  ["#E2F1F1", "#0F5E63"],
] as const;
export function StopAvatar({ stop, className }: { stop: Stop; className?: string }) {
  const person = stop.customerType === "individual";
  const words = stop.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean);
  const initials = (person ? words.slice(0, 2).map((w) => w[0]) : words.length > 1 ? [words[0][0], words[1][0]] : [words[0][0], words[0][1]]).join("").toUpperCase();
  let h = 0;
  for (const ch of stop.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_TONES[h % AVATAR_TONES.length];
  if (person && stop.photo)
    return <img src={stop.photo} alt="" aria-hidden className={cn("block size-12 shrink-0 rounded-full object-cover", className)} />;
  if (person) return <PersonPhoto seed={h} className={className} />;
  return (
    <span
      aria-hidden
      className={cn("grid size-12 shrink-0 place-items-center text-[15px] font-extrabold tracking-tight", person ? "rounded-full" : "rounded-[14px]", className)}
      style={{ background: bg, color: fg, boxShadow: `inset 0 0 0 1px ${fg}22` }}
    >
      {initials}
    </span>
  );
}

/** Mock profile photo for an individual customer: a flat portrait (skin, hair, top) varied by a seed. */
function PersonPhoto({ seed, className }: { seed: number; className?: string }) {
  const skins = ["#F1C7A5", "#D9A27C", "#B47A55", "#8A5638", "#EBC1A0"];
  const hairs = ["#2B211C", "#4A3326", "#1E1B1A", "#7A4E2C", "#3A2A20"];
  const tops = ["#2F6A6C", "#3E5C8A", "#8A4B3A", "#5B6B3A", "#6E3C86"];
  const backs = ["#E3EEF9", "#E7F3EA", "#FBE9DF", "#F3E8F7", "#E2F1F1"];
  const pick = <T,>(arr: T[], k: number) => arr[(seed >>> k) % arr.length];
  const skin = pick(skins, 1);
  const hair = pick(hairs, 3);
  return (
    <span aria-hidden className={cn("block size-12 shrink-0 overflow-hidden rounded-full", className)} style={{ background: pick(backs, 5) }}>
      <svg viewBox="0 0 48 48" className="block size-full">
        {/* shoulders / top */}
        <path d="M6 48 C7 37 15 33 24 33 C33 33 41 37 42 48 Z" fill={pick(tops, 7)} />
        <path d="M20 33 L24 38 L28 33 Z" fill={skin} />
        {/* neck + head */}
        <rect x="20.5" y="26" width="7" height="8" rx="3" fill={skin} />
        <ellipse cx="24" cy="20" rx="8.5" ry="9.5" fill={skin} />
        {/* hair */}
        <path d="M15.2 19.5 C14.5 11 19 8 24 8 C30 8 33.8 11.5 32.8 19.5 C31.5 15 28.5 13.5 24.5 13.5 C20 13.5 17 15 15.2 19.5 Z" fill={hair} />
        {/* simple features */}
        <circle cx="20.8" cy="20.5" r="0.9" fill="#2B211C" />
        <circle cx="27.2" cy="20.5" r="0.9" fill="#2B211C" />
        <path d="M21.6 24.6 Q24 26.2 26.4 24.6" fill="none" stroke="#7A3F2A" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    </span>
  );
}
