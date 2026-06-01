interface LogoProps {
  size?: number;
  className?: string;
  /** Adds a soft glow behind the mark */
  glow?: boolean;
}

/**
 * NimHub brand mark — an "N" formed as a payment node graph.
 * Two terminal nodes (gold) and one accent node (purple) suggest
 * a network/hub routing value between points.
 */
export default function Logo({ size = 32, className = '', glow = false }: LogoProps) {
  return (
    <div
      className={`relative inline-flex ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          className="absolute inset-0 rounded-[28%] blur-md opacity-40"
          style={{ background: 'rgba(245, 166, 35, 0.5)' }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative"
      >
        <defs>
          <linearGradient id="logo-bg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F5A623" />
            <stop offset="1" stopColor="#F5A623" />
          </linearGradient>
          <linearGradient id="logo-stroke" x1="20" y1="18" x2="44" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0A0C17" />
            <stop offset="1" stopColor="#0A0C17" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#logo-bg)" />
        <rect x="0.5" y="0.5" width="63" height="63" rx="17.5" stroke="#ffffff" strokeOpacity="0.18" />
        <path
          d="M21 45 V 21 L 43 45 V 21"
          stroke="url(#logo-stroke)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="21" cy="21" r="3.4" fill="#0A0C17" />
        <circle cx="43" cy="45" r="3.4" fill="#0A0C17" />
        <circle cx="43" cy="21" r="3.4" fill="#7C3AED" />
      </svg>
    </div>
  );
}