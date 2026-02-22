"use client";

export function GravityLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Gravity Claw logo"
      className="gc-logo"
    >
      <defs>
        <linearGradient id="gcLogoCore" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6df7ff" />
          <stop offset="50%" stopColor="#19d1c3" />
          <stop offset="100%" stopColor="#0a6c68" />
        </linearGradient>
        <linearGradient id="gcLogoRing" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#19d1c3" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#9af8ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#19d1c3" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="gcLogoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7df4ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7df4ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="gc-logo-pulse">
        <circle cx="60" cy="60" r="50" fill="url(#gcLogoGlow)" />
      </g>

      <g className="gc-logo-outer">
        <circle
          cx="60"
          cy="60"
          r="43"
          fill="none"
          stroke="url(#gcLogoRing)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="36 12 18 16"
        />
      </g>

      <g className="gc-logo-inner">
        <circle cx="60" cy="60" r="21" fill="#0b1b22" stroke="#1e3f4c" strokeWidth="2.8" />
        <path
          d="M60 42 L73 58 L60 74 L47 58 Z"
          fill="url(#gcLogoCore)"
          opacity="0.95"
        />
        <path
          d="M60 32 C64 40 64 48 60 54 C56 48 56 40 60 32 Z"
          fill="url(#gcLogoCore)"
          className="gc-logo-claw"
        />
        <path
          d="M40 56 C49 57 54 61 56 68 C49 67 43 64 40 56 Z"
          fill="url(#gcLogoCore)"
          className="gc-logo-claw-left"
        />
        <path
          d="M80 56 C71 57 66 61 64 68 C71 67 77 64 80 56 Z"
          fill="url(#gcLogoCore)"
          className="gc-logo-claw-right"
        />
      </g>
    </svg>
  );
}
