export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="RoastMyCode"
    >
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#18181B"/>
          <stop offset="100%" stopColor="#09090B"/>
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect width="40" height="40" rx="10" fill="url(#lm-bg)"/>
      <rect width="40" height="40" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

      {/* // — double forward slash, bold, slightly angled */}
      {/* Left slash */}
      <line x1="12" y1="28" x2="18" y2="12" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      {/* Right slash */}
      <line x1="20" y1="28" x2="26" y2="12" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>

      {/* Orange dot — the "critical" indicator */}
      <circle cx="31" cy="12" r="3.5" fill="#F97316"/>
    </svg>
  )
}
