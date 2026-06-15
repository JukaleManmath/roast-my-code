export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PanelReview"
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

      {/*
        Five vertical bars — the five-agent panel.
        Heights vary to suggest different perspectives/voices, not a uniform wall.
        Bar 3 (center) is tallest — the synthesis agent anchoring the debate.
      */}
      <rect x="7"  y="18" width="3.5" height="14" rx="1.75" fill="white" fillOpacity="0.7"/>
      <rect x="13" y="13" width="3.5" height="19" rx="1.75" fill="white" fillOpacity="0.85"/>
      <rect x="19" y="10" width="3.5" height="22" rx="1.75" fill="white"/>
      <rect x="25" y="14" width="3.5" height="18" rx="1.75" fill="white" fillOpacity="0.85"/>
      <rect x="31" y="19" width="3.5" height="13" rx="1.75" fill="white" fillOpacity="0.7"/>

      {/* Orange dot — the conflict indicator, sits above the tallest bar */}
      <circle cx="20.75" cy="7" r="2.5" fill="#F97316"/>
    </svg>
  )
}
