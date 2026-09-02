export interface MascotProps {
  /** Equipped scarf color — drawn as a worn band around the owl's neck. */
  scarfColor?: string | null;
}

export function Mascot({ scarfColor = null }: MascotProps) {
  return (
    <svg className="mascot" viewBox="0 0 140 150" role="img" aria-label="بومة رحلتي">
      <path d="M34 46 L40 12 L62 36 Z" fill="#8a5a2b" />
      <path d="M106 46 L100 12 L78 36 Z" fill="#8a5a2b" />
      <ellipse cx="70" cy="85" rx="50" ry="55" fill="#a9713d" />
      <ellipse cx="70" cy="97" rx="34" ry="40" fill="#f6e7c8" />
      <ellipse cx="24" cy="90" rx="13" ry="32" fill="#8a5a2b" transform="rotate(10 24 90)" />
      <ellipse cx="116" cy="90" rx="13" ry="32" fill="#8a5a2b" transform="rotate(-10 116 90)" />
      <circle cx="50" cy="64" r="17" fill="#ffffff" stroke="#8a5a2b" strokeWidth="3" />
      <circle cx="90" cy="64" r="17" fill="#ffffff" stroke="#8a5a2b" strokeWidth="3" />
      <circle cx="53" cy="66" r="7" fill="#2d1b12" />
      <circle cx="87" cy="66" r="7" fill="#2d1b12" />
      <circle cx="56" cy="62" r="2.5" fill="#ffffff" />
      <circle cx="90" cy="62" r="2.5" fill="#ffffff" />
      <path d="M70 76 L80 86 L70 96 L60 86 Z" fill="#f5a623" />
      {scarfColor !== null ? (
        <g data-part="scarf">
          <path d="M36 101 Q70 116 104 101 L104 112 Q70 127 36 112 Z" fill={scarfColor} />
          <path d="M47 112 L36 134 L54 127 Z" fill={scarfColor} />
          <path d="M36 101 Q70 116 104 101" stroke="rgba(0,0,0,0.18)" strokeWidth="2" fill="none" />
        </g>
      ) : null}
      <path
        d="M50 134 l-7 9 M50 134 l0 10 M50 134 l7 9"
        stroke="#f5a623"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M90 134 l-7 9 M90 134 l0 10 M90 134 l7 9"
        stroke="#f5a623"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
