import { cn } from "./ui";

/** Stand-in for a camera frame: SFK bags on a pantry counter / at a door. */
export function DeliveryScene({ variant = 0, className }: { variant?: number; className?: string }) {
  const door = variant % 10 === 3;
  const wall = ["#D9CFB8", "#CBD6D2", "#E2D3BF"][variant % 3];
  const counter = ["#8F6B4E", "#6F5A4A", "#A07A58"][variant % 3];
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className={cn("block h-full w-full", className)} aria-hidden>
      <rect width="300" height="400" fill={wall} />
      <rect x="0" y="0" width="300" height="400" fill="url(#vignette)" />
      <defs>
        <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      {!door ? (
        <>
          {/* cabinets */}
          <rect x="20" y="40" width="120" height="110" rx="4" fill="#EFE9DA" />
          <rect x="160" y="40" width="120" height="110" rx="4" fill="#EFE9DA" />
          <line x1="80" y1="40" x2="80" y2="150" stroke="#D1C7B0" strokeWidth="2" />
          <line x1="220" y1="40" x2="220" y2="150" stroke="#D1C7B0" strokeWidth="2" />
          {/* counter */}
          <rect x="-10" y="250" width="320" height="22" fill={counter} />
          <rect x="-10" y="272" width="320" height="140" fill="#3E3A35" />
        </>
      ) : (
        <>
          {/* door */}
          <rect x="70" y="20" width="160" height="300" rx="4" fill="#5C4A3B" />
          <rect x="88" y="40" width="124" height="120" rx="3" fill="#6B5747" />
          <circle cx="205" cy="190" r="6" fill="#D4B26A" />
          <text x="150" y="110" textAnchor="middle" fontSize="20" fontWeight="700" fill="#E6D8BF">1207</text>
          <rect x="-10" y="320" width="320" height="90" fill="#9A8C78" />
        </>
      )}
      {/* bags */}
      {[
        [40, 0],
        [110, 1],
        [180, 0],
      ].map(([x, t], i) => (
        <g key={i} transform={`translate(${x} ${door ? 238 : 168})`}>
          <rect width="62" height="84" rx="6" fill={t ? "#DCEDED" : "#FBF7EC"} stroke="#004045" strokeWidth="2" />
          <path d="M14 0 C14 -22 48 -22 48 0" fill="none" stroke="#004045" strokeWidth="4" />
          <rect x="10" y="22" width="42" height="14" rx="3" fill="#F5E516" />
          <text x="31" y="33" textAnchor="middle" fontSize="9" fontWeight="800" fill="#004045">SFK</text>
          <rect x="10" y="44" width="42" height="22" rx="2" fill="white" />
          <line x1="14" y1="51" x2="46" y2="51" stroke="#8A8677" strokeWidth="2" />
          <line x1="14" y1="58" x2="38" y2="58" stroke="#8A8677" strokeWidth="2" />
          <text x="31" y="78" textAnchor="middle" fontSize="7" fontWeight="700" fill={t ? "#0B6E76" : "#B24A2B"}>{t ? "COLD" : "HOT"}</text>
        </g>
      ))}
    </svg>
  );
}

/** Saved building photo (Address.instructionsFileUrl) — a marked-up entrance map. */
export function BuildingPhoto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" className={cn("block h-full w-full", className)} aria-label="Photo of the loading dock entrance">
      <rect width="320" height="180" fill="#C9C1AE" />
      <rect x="0" y="120" width="320" height="60" fill="#8F8878" />
      <rect x="30" y="30" width="110" height="90" fill="#6E6A60" />
      <rect x="40" y="40" width="90" height="80" fill="#4D4A44" />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1="40" x2="130" y1={50 + i * 12} y2={50 + i * 12} stroke="#5E5A52" strokeWidth="3" />
      ))}
      <text x="85" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2B2E2C">LOADING DOCK</text>
      <rect x="180" y="40" width="70" height="80" fill="#A9B4B2" stroke="#6E6A60" strokeWidth="3" />
      <line x1="215" x2="215" y1="40" y2="120" stroke="#6E6A60" strokeWidth="3" />
      <text x="215" y="34" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2B2E2C">FREIGHT B</text>
      <circle cx="215" cy="80" r="46" fill="none" stroke="#F5E516" strokeWidth="5" />
      <path d="M150 150 L195 112" stroke="#F5E516" strokeWidth="5" strokeLinecap="round" />
      <path d="M195 112 l-14 2 M195 112 l-3 13" stroke="#F5E516" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Today header art, drawn in a flat two-tone style: an SFK driver waving with a hot bag beside the branded van.
 * Light comes from the top-right, so left/back faces take the darker tone.
 */
export function DeliveryVan({ className }: { className?: string }) {
  const skin = "#C68A63";
  const skinShade = "#A8704F";
  const body = "M94 30 L230 30 Q240 30 240 40 L240 116 Q240 124 232 124 L94 124 Q86 124 86 116 L86 90 Q86 80 96 77 L104 74 L110 38 Q112 30 118 30 Z";
  return (
    <svg viewBox="0 0 248 150" className={cn("block", className)} aria-hidden>
      <defs>
        <clipPath id="dv-body">
          <path d={body} />
        </clipPath>
      </defs>

      {/* backdrop + ground */}
      <circle cx="150" cy="84" r="64" fill="#FFFFFF" opacity="0.4" />
      <ellipse cx="140" cy="140" rx="104" ry="4.5" fill="#004045" opacity="0.13" />

      {/* van */}
      <path d={body} fill="#007078" />
      <g clipPath="url(#dv-body)">
        <rect x="80" y="30" width="170" height="5" fill="#FFFFFF" opacity="0.14" />
        <rect x="80" y="104" width="170" height="24" fill="#004045" opacity="0.32" />
        <rect x="80" y="92" width="170" height="7" fill="#F5E516" />
        <rect x="80" y="99" width="170" height="1.5" fill="#C9B800" />
      </g>
      <path d="M112 38 L136 38 Q139 38 139 41 L139 64 Q139 67 136 67 L107 67 Z" fill="#BFE3E3" />
      <path d="M118 38 L126 38 L114 67 L108 67 Z" fill="#FFFFFF" opacity="0.45" />
      <path d="M112 38 L136 38 Q139 38 139 41 L139 45 L111.3 45 Z" fill="#004045" opacity="0.18" />
      <line x1="142" y1="34" x2="142" y2="122" stroke="#005E65" strokeWidth="1.5" />
      <line x1="194" y1="34" x2="194" y2="122" stroke="#005E65" strokeWidth="1.5" />
      <rect x="131" y="74" width="8" height="2.6" rx="1.3" fill="#004045" />
      <rect x="198" y="74" width="8" height="2.6" rx="1.3" fill="#004045" />
      <path d="M106 58 L101 58 Q99 58 99 60 L99 66 Q99 68 101 68 L104 68 Z" fill="#004045" />
      <rect x="86" y="82" width="9" height="7" rx="2.5" fill="#FBF3A0" />
      <rect x="87.5" y="83" width="3" height="2" rx="1" fill="#FFFFFF" />
      <rect x="236" y="48" width="4" height="15" rx="1.5" fill="#B85C36" />
      <rect x="83" y="112" width="20" height="9" rx="3.5" fill="#2B3A3B" />
      <rect x="228" y="113" width="14" height="8" rx="3" fill="#2B3A3B" />
      {/* logo panel */}
      <rect x="152" y="43" width="74" height="32" rx="7" fill="#F5E516" />
      <text x="189" y="62" textAnchor="middle" fontSize="15" fontWeight="800" fill="#004045" letterSpacing="0.5">SFK</text>
      <text x="189" y="70" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#004045" letterSpacing="1.4">SUPERFINE KITCHEN</text>
      {/* wheels */}
      {[108, 212].map((x) => (
        <g key={x}>
          <path d={`M${x - 17} 124 A17 17 0 0 1 ${x + 17} 124 Z`} fill="#003236" />
          <circle cx={x} cy="127" r="13" fill="#2B2E2C" />
          <circle cx={x} cy="127" r="7" fill="#D9D1B7" />
          <circle cx={x} cy="127" r="2.6" fill="#8A8677" />
        </g>
      ))}

      {/* location pin over the van */}
      <g transform="translate(222 8)">
        <path d="M8 0 C3.6 0 0 3.4 0 7.8 C0 13.4 8 20 8 20 C8 20 16 13.4 16 7.8 C16 3.4 12.4 0 8 0 Z" fill="#B85C36" />
        <circle cx="8" cy="7.6" r="3.2" fill="#FFFFFF" />
      </g>

      {/* driver, three-quarter view facing the van; light from the top-right, so his left side takes the shade */}
      <ellipse cx="47" cy="139.5" rx="22" ry="2.6" fill="#004045" opacity="0.16" />
      {/* waving arm (behind torso) */}
      <path d="M35 57 L27.5 48.5" stroke="#E3D20B" strokeWidth="10" strokeLinecap="round" />
      <path d="M27 48 L22.5 43" stroke={skinShade} strokeWidth="6.4" strokeLinecap="round" />
      <path d="M22.5 43 L20.5 30.5" stroke={skinShade} strokeWidth="5.8" strokeLinecap="round" />
      <g transform="translate(20.4 27.4) rotate(-10)" fill={skinShade}>
        <rect x="-4.3" y="-3.4" width="8.8" height="7.6" rx="3.4" />
        <rect x="-4.3" y="-8.6" width="2.1" height="7" rx="1.05" />
        <rect x="-2.0" y="-10" width="2.1" height="8" rx="1.05" />
        <rect x="0.3" y="-9.6" width="2.1" height="7.6" rx="1.05" />
        <rect x="2.5" y="-7.8" width="2" height="6" rx="1" />
        <rect x="3.2" y="-2.6" width="2" height="5.4" rx="1" transform="rotate(-38 4.2 0)" />
      </g>
      {/* legs + shoes */}
      <path d="M33 95 L30.8 132 L39.8 132 L45.5 101 Z" fill="#00353A" />
      <path d="M43.5 99 L48.6 132 L57.8 132 L57 95 Z" fill="#004045" />
      <rect x="32" y="93" width="25" height="9" rx="2" fill="#004045" />
      <path d="M29.6 130.6 L39.6 130.6 Q40.8 130.6 41.4 131.8 L42 133 Q44.8 133.6 45.4 135.6 L45.4 137.4 L27.6 137.4 L27.8 133 Q28 130.6 29.6 130.6 Z" fill="#26292A" />
      <path d="M48.4 130.6 L57.6 130.6 Q58.8 130.6 59.4 131.6 L60.2 132.8 Q65.6 133.4 66.4 135.8 L66.4 137.4 L47.6 137.4 L47.6 132.2 Q47.6 130.6 48.4 130.6 Z" fill="#2F3334" />
      <path d="M34.8 132.4 L37.6 131.8 M35.6 134 L38.6 133.2 M54 132.4 L56.8 131.8 M54.8 134 L57.8 133.2" stroke="#8A8677" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="27.4" y="136.4" width="18.2" height="2.4" rx="1.2" fill="#FBF7EC" />
      <rect x="47.4" y="136.4" width="19.2" height="2.4" rx="1.2" fill="#FBF7EC" />
      {/* polo */}
      <path d="M41 46 L48 46 L48.5 52 L40.5 52 Z" fill={skinShade} />
      <path d="M31.5 58 Q32 51 40 50 L49.5 50 Q57.5 51 58 58 L58.5 98 Q45 100.5 31 98 Z" fill="#F5E516" />
      <path d="M31.5 58 Q32 51 40 50 L41 50 Q37 60 37.5 99 Q34 98.7 31 98 Z" fill="#E3D20B" />
      <path d="M39.5 50 L44.8 57.5 L50 50 L47.5 49 L44.8 53.5 L42 49 Z" fill="#FBF3A0" />
      <line x1="44.8" y1="57.5" x2="44.8" y2="63" stroke="#C9B800" strokeWidth="1" />
      <rect x="49.5" y="60" width="5" height="3.4" rx="0.8" fill="#007078" />
      {/* head */}
      {/* face in three-quarter view: jaw rounds toward the chin, nose breaks the right edge */}
      <path d="M36.6 36 Q36.4 46.6 44.4 47.6 Q50.6 48 52 43.4 L52.6 41.6 L53.9 40.8 Q54.3 40.2 53.6 39.6 L52.6 38.6 L52.6 36 Z" fill={skin} />
      <path d="M36.6 35.6 L41 35.6 Q40.4 41 41.8 44.2 Q38.2 43.6 37 40.4 Q36.5 38 36.6 35.6 Z" fill="#2B2E2C" />
      <ellipse cx="39.6" cy="40.4" rx="1.7" ry="2.3" fill={skinShade} />
      <path d="M39.1 39.6 Q40.1 40.2 39.4 41.4" fill="none" stroke="#8E5B3E" strokeWidth="0.6" strokeLinecap="round" />
      <path d="M46.4 37.2 Q48.2 36.4 50 37" fill="none" stroke="#2B2E2C" strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="48.4" cy="39.5" rx="1" ry="1.25" fill="#2B2E2C" />
      <circle cx="48.75" cy="39.1" r="0.32" fill="#FFFFFF" />
      <circle cx="47" cy="43" r="1.7" fill="#D9805F" opacity="0.45" />
      <path d="M48.2 44.4 Q50.4 46.2 52.2 44.2" fill="#FFFFFF" stroke="#7A3E2A" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M36 36 Q36 26.8 44.6 26.8 Q53.2 26.8 53.2 36 Z" fill="#004045" />
      <path d="M48.5 34.2 Q57 33.6 59.4 36.2 Q57.6 37.8 49 37.2 Z" fill="#00353A" />
      <circle cx="44.6" cy="30.6" r="1.6" fill="#F5E516" />
      {/* carrying arm + insulated bag */}
      <path d="M55.5 56 L59.5 64" stroke="#F5E516" strokeWidth="10" strokeLinecap="round" />
      <path d="M59.5 64 L63 71.5" stroke={skin} strokeWidth="6.4" strokeLinecap="round" />
      <path d="M63 71.5 L65.5 84" stroke={skin} strokeWidth="5.8" strokeLinecap="round" />
      <path d="M61 93 Q61.5 84.5 66 84.5 Q70.5 84.5 71 93" fill="none" stroke="#004045" strokeWidth="2" />
      <rect x="56" y="92" width="22" height="25" rx="3.5" fill="#FBF7EC" />
      <rect x="56" y="92" width="5.5" height="25" rx="2.5" fill="#ECE6D5" />
      <rect x="56" y="92" width="22" height="4.5" rx="2" fill="#D9D1B7" />
      <rect x="62" y="101" width="13" height="8.5" rx="2" fill="#F5E516" />
      <text x="68.5" y="107.4" textAnchor="middle" fontSize="4.8" fontWeight="800" fill="#004045">SFK</text>
      <g fill={skin}>
        <rect x="62.4" y="83.2" width="7.4" height="7.4" rx="3" />
        <rect x="61.6" y="83.6" width="2.6" height="4.6" rx="1.3" />
      </g>
      <path d="M64.2 86.4 L69 86.4 M64.4 88.6 L68.8 88.6" stroke={skinShade} strokeWidth="0.7" strokeLinecap="round" />
      <path d="M71 89 q-2.6 -3.6 0 -7.2 q2.6 -3.6 0 -7.2 M75.5 89 q-2.6 -3.6 0 -7.2 q2.6 -3.6 0 -7.2" fill="none" stroke="#B85C36" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/**
 * Today header background: a quiet street at the bottom of the header. A small SFK van drives along the
 * road towards a drop-off pin, with a soft city and trees behind. Tonal on purpose (teal on mint with
 * white highlights, one muted yellow and coral accent) so the greeting and progress bar on top stay readable.
 * Drawn for a 390 × 180 header; the shift card covers roughly the bottom 32 px.
 */
export function HeaderScene({ className }: { className?: string }) {
  const ink = "#004045";
  // Buildings: [x, width, height, roof] from the road line (y = 141).
  const blocks: [number, number, number, "flat" | "step" | "peak"][] = [
    [214, 22, 46, "flat"],
    [238, 30, 70, "step"],
    [270, 18, 54, "peak"],
    [290, 34, 88, "flat"],
    [326, 22, 60, "step"],
    [350, 40, 76, "flat"],
  ];
  return (
    <svg viewBox="0 0 390 180" preserveAspectRatio="xMaxYMax slice" aria-hidden className={cn("block", className)}>
      <defs>
        <linearGradient id="hs-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="hs-mask">
          <rect width="390" height="180" fill="url(#hs-fade)" />
        </mask>
      </defs>

      <g mask="url(#hs-mask)">
        {/* sky: two soft clouds */}
        <path transform="translate(14 42)" d="M150 58 q4 -10 15 -8 q5 -9 16 -5 q10 -2 12 8 q8 1 8 7 q0 6 -8 6 h-38 q-9 0 -9 -6 q0 -5 4 -2 z" fill="#fff" opacity="0.5" />
        <path d="M320 104 q3 -7 11 -6 q4 -6 11 -3 q7 -1 8 5 q6 1 6 5 q0 4 -6 4 h-27 q-6 0 -6 -4 q0 -3 3 -1 z" fill="#fff" opacity="0.4" />

        {/* far hills */}
        <path d="M80 145 Q130 117 182 132 Q220 140 250 128 Q300 108 340 122 Q370 132 390 126 V180 H80 Z" fill="#fff" opacity="0.3" />

        {/* city: tonal blocks with window rows cut in */}
        {blocks.map(([x, w, h, roof], i) => {
          const top = 141 - h;
          const cols = Math.max(1, Math.floor((w - 6) / 8));
          return (
            <g key={i} opacity={i % 2 ? 0.075 : 0.055} fill={ink}>
              <rect x={x} y={top} width={w} height={h} rx="1.5" />
              {roof === "step" && <rect x={x + w * 0.25} y={top - 8} width={w * 0.5} height="9" rx="1" />}
              {roof === "peak" && <path d={`M${x} ${top + 1} L${x + w / 2} ${top - 12} L${x + w} ${top + 1} Z`} />}
              {/* window strips, like an illustrator's quick vertical marks; the lower floors stay solid */}
              {Array.from({ length: cols }).map((_, c) => (
                <rect key={c} x={x + 4 + c * 8} y={top + 6} width="2.6" height={Math.max(8, h * 0.62)} rx="1.3" fill="#fff" opacity="0.8" />
              ))}
            </g>
          );
        })}

        {/* trees along the road */}
        {[
          [200, 9],
          [232, 7],
          [318, 8],
          [372, 10],
        ].map(([x, r]) => (
          <g key={x} fill={ink} opacity="0.09">
            <rect x={x - 1} y={141 - r - 6} width="2" height={r + 6} rx="1" />
            <circle cx={x} cy={141 - r - 8} r={r} />
          </g>
        ))}

        {/* road with a dashed centre line */}
        <path d="M60 153 C150 143 250 145 390 139" stroke="#fff" strokeWidth="16" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M70 153 C150 143 250 145 390 139" stroke={ink} strokeWidth="1.2" strokeDasharray="7 9" strokeLinecap="round" fill="none" opacity="0.14" />

        {/* drop-off pin */}
        <g transform="translate(294 102)" opacity="0.55">
          <ellipse cx="7" cy="25" rx="5" ry="1.6" fill={ink} opacity="0.25" />
          <path d="M7 0 C3 0 0 3 0 6.9 C0 11.8 7 18 7 18 C7 18 14 11.8 14 6.9 C14 3 11 0 7 0 Z" fill="#B85C36" />
          <circle cx="7" cy="6.8" r="2.6" fill="#fff" />
        </g>

      </g>
    </svg>
  );
}

/**
 * Kitchen pickup, for the empty space on the pickup card: the SFK dock with its roll-up door open, a trolley of
 * packages (kraft bags with SFK stickers, an insulated hot carrier) and the van's open back. Tonal teal on white
 * so it stays quiet next to the coral "Scan" button.
 */
export function KitchenPickupScene({ className }: { className?: string }) {
  const ink = "#004045";
  return (
    <svg viewBox="0 0 320 200" className={cn("block", className)} aria-hidden>
      {/* ground */}
      <ellipse cx="160" cy="184" rx="150" ry="10" fill="#EFF6F5" />

      {/* kitchen building + dock */}
      <rect x="18" y="38" width="150" height="140" rx="8" fill="#EFF6F5" />
      <rect x="18" y="38" width="150" height="22" rx="8" fill="#DCEDED" />
      <rect x="64" y="44" width="58" height="11" rx="5.5" fill="#F5E516" />
      <text x="93" y="52.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={ink} letterSpacing="0.6">SFK KITCHEN</text>
      {/* open roll-up door: dark interior, rolled shutter at the top */}
      <rect x="38" y="76" width="96" height="102" rx="4" fill="#cfe4e3" />
      <rect x="38" y="76" width="96" height="102" rx="4" fill={ink} opacity="0.12" />
      <rect x="34" y="70" width="104" height="10" rx="5" fill="#DCEDED" stroke={ink} strokeOpacity="0.15" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1="40" x2="132" y1={86 + i * 7} y2={86 + i * 7} stroke={ink} strokeOpacity="0.07" strokeWidth="2" />
      ))}
      <text x="86" y="166" textAnchor="middle" fontSize="7" fontWeight="700" fill={ink} opacity="0.35" letterSpacing="1.2">BAY 2</text>

      {/* trolley with packages */}
      <g transform="translate(150 104)">
        <rect x="0" y="62" width="74" height="5" rx="2.5" fill={ink} opacity="0.55" />
        <rect x="68" y="4" width="4" height="62" rx="2" fill={ink} opacity="0.55" />
        <circle cx="10" cy="72" r="5" fill={ink} opacity="0.6" />
        <circle cx="62" cy="72" r="5" fill={ink} opacity="0.6" />
        {/* kraft bags */}
        {[
          [4, 18, 22, 44],
          [28, 28, 20, 34],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="2" fill="#C99A63" />
            <rect x={x} y={y} width={w} height="5" rx="2" fill="#B5864F" />
            <circle cx={x + w / 2} cy={y + h / 2 + 2} r="5" fill="#F5E516" />
          </g>
        ))}
        {/* insulated hot carrier */}
        <rect x="50" y="32" width="18" height="30" rx="3" fill="#1F5C60" />
        <rect x="52" y="52" width="14" height="5" rx="1" fill="#fff" />
        <circle cx="59" cy="54.5" r="1.4" fill="#B85C36" />
      </g>

      {/* van, open back doors facing the dock */}
      <g transform="translate(232 92)">
        <rect x="0" y="12" width="78" height="64" rx="8" fill="#fff" stroke={ink} strokeOpacity="0.18" strokeWidth="1.5" />
        <path d="M60 12 H70 Q78 12 78 20 V40 H60 Z" fill="#DCEDED" />
        <rect x="0" y="52" width="78" height="5" fill="#F5E516" opacity="0.85" />
        {/* open rear door */}
        <rect x="-14" y="14" width="13" height="60" rx="3" fill="#fff" stroke={ink} strokeOpacity="0.18" strokeWidth="1.5" />
        <rect x="2" y="16" width="30" height="34" rx="3" fill={ink} opacity="0.1" />
        <circle cx="18" cy="78" r="8" fill={ink} opacity="0.75" />
        <circle cx="18" cy="78" r="3" fill="#fff" />
        <circle cx="62" cy="78" r="8" fill={ink} opacity="0.75" />
        <circle cx="62" cy="78" r="3" fill="#fff" />
      </g>

      {/* dashed path: trolley → van */}
      <path d="M226 166 C 236 160, 238 150, 232 142" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" />
    </svg>
  );
}
