/**
 * A San Francisco skyline for header backgrounds, read left to right like the view from the bay:
 * Golden Gate Bridge, Sutro Tower on Twin Peaks, the Painted Ladies, Coit Tower on Telegraph Hill,
 * downtown with the Transamerica Pyramid and Salesforce Tower, then the Bay Bridge. Hills sit behind
 * at half strength for depth. Windows and details are cut out (even-odd) so the shapes read at a
 * glance even as a one-colour silhouette. Fill is `currentColor`; the parent sets tint and opacity.
 */
export function Skyline({ className }: { className?: string }) {
  const houses = [138, 150, 162, 174, 186];
  // Golden Gate deck sits at y=60; suspender cables hang from the main cable down to it.
  const suspenders = [38, 46, 54, 61, 68, 76, 84];
  const cableY = (x: number) => 54 - ((x - 61.5) / 35) ** 2 * 45; // same curve as the main cable path

  return (
    <svg viewBox="0 0 400 90" preserveAspectRatio="xMidYMax meet" aria-hidden className={className}>
      <g fill="currentColor">
        {/* Back layer: SF's hills, Twin Peaks with Sutro Tower */}
        <g opacity="0.45">
          <path d="M0 90 V74 Q20 66 45 70 Q75 76 100 66 Q118 56 133 57 Q148 58 160 68 Q190 80 220 70 Q250 62 280 70 Q320 78 360 70 Q385 66 400 70 V90 Z" />
          <path d="M129.5 58 L131.6 30 H132.4 L134.5 58 Z" />
          <rect x="126.5" y="33" width="11" height="1.8" />
          <rect x="127.5" y="43" width="9" height="1.6" />
          <rect x="126.5" y="22" width="1.6" height="12" />
          <rect x="131.2" y="19" width="1.6" height="12" />
          <rect x="135.9" y="22" width="1.6" height="12" />
        </g>

        {/* Golden Gate Bridge: art-deco portal towers, deck with truss, main cable and suspenders */}
        {[22, 92].map((x) => (
          <path
            key={x}
            fillRule="evenodd"
            d={`M${x} 8 H${x + 9} V90 H${x} Z M${x + 2.6} 17 H${x + 6.4} V26 H${x + 2.6} Z M${x + 2.6} 30 H${x + 6.4} V40 H${x + 2.6} Z M${x + 2.6} 44 H${x + 6.4} V56 H${x + 2.6} Z M${x + 2.6} 65 H${x + 6.4} V90 H${x + 2.6} Z`}
          />
        ))}
        <rect x="0" y="58" width="124" height="4" />
        <path d="M26.5 9 Q61 99 96.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M0 50 Q15 44 26.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M96.5 9 Q108 44 124 54" fill="none" stroke="currentColor" strokeWidth="1.8" />
        {suspenders.map((x) => (
          <rect key={x} x={x - 0.35} y={cableY(x)} width="0.7" height={58 - cableY(x)} />
        ))}

        {/* Painted Ladies: gabled Victorians with bay windows and doors cut out */}
        {houses.map((x) => (
          <path
            key={x}
            fillRule="evenodd"
            d={`M${x} 90 V67 L${x + 5.5} 58 L${x + 11} 67 V90 Z M${x + 4.5} 63 H${x + 6.5} V66 H${x + 4.5} Z M${x + 2} 70 H${x + 9} V76 H${x + 2} Z M${x + 2} 80 H${x + 4.5} V90 H${x + 2} Z M${x + 6} 80 H${x + 9} V85 H${x + 6} Z`}
          />
        ))}

        {/* Coit Tower on Telegraph Hill: fluted column with an arched crown */}
        <path d="M198 90 Q213 64 228 90 Z" />
        <path
          fillRule="evenodd"
          d="M209.5 82 V50 H216.5 V82 Z M211 52 H212 V80 H211 Z M214 52 H215 V80 H214 Z"
        />
        <path fillRule="evenodd" d="M208.5 50 V44 H217.5 V50 Z M210 45.5 H211.5 V48.5 H210 Z M212.25 45.5 H213.75 V48.5 H212.25 Z M214.5 45.5 H216 V48.5 H214.5 Z" />

        {/* Downtown */}
        <rect x="230" y="60" width="9" height="30" />
        {/* Transamerica Pyramid: tall taper, side "wings" near the top, needle spire */}
        <polygon points="240,90 248.5,14 257,90" />
        <polygon points="245.6,40 243,40 244.2,30 246.5,32" />
        <polygon points="251.4,40 254,40 252.8,30 250.5,32" />
        <rect x="248.1" y="4" width="0.8" height="11" />
        <rect x="259" y="46" width="10" height="44" />
        <rect x="271" y="56" width="8" height="34" />
        <rect x="281" y="38" width="10" height="52" />
        {/* Salesforce Tower: rounded obelisk with an open lattice crown */}
        <path fillRule="evenodd" d="M293 90 V28 Q293 14 300.5 7 Q308 14 308 28 V90 Z M295.5 20 H305.5 V22 H295.5 Z M295 25 H306 V27 H295 Z" />
        <rect x="310" y="44" width="10" height="46" />
        <rect x="322" y="58" width="8" height="32" />

        {/* Bay Bridge: twin suspension towers heading east */}
        <rect x="331" y="68" width="69" height="2.6" />
        <path fillRule="evenodd" d="M350 38 H354 V90 H350 Z M351.2 48 H352.8 V54 H351.2 Z" />
        <path fillRule="evenodd" d="M382 38 H386 V90 H382 Z M383.2 48 H384.8 V54 H383.2 Z" />
        <path d="M331 64 Q343 60 352 39 Q368 80 384 39 Q392 58 400 62" fill="none" stroke="currentColor" strokeWidth="1.4" />

        {/* Waterline */}
        <rect x="0" y="87" width="400" height="3" />
      </g>
    </svg>
  );
}
