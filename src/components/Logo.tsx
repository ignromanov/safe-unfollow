interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Brand logo component - renders inline SVG for CSS animation support.
 * Used in Header, Footer, and FooterCTA.
 */
export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={`flex-shrink-0 ${className}`}
      aria-label="SafeUnfollow logo"
      role="img"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5B6BE0" />
          <stop offset="50%" stopColor="#9B5DE5" />
          <stop offset="100%" stopColor="#E05B9B" />
        </linearGradient>
      </defs>

      {/* Rounded rectangle background */}
      <rect x="16" y="16" width="480" height="480" rx="96" ry="96" fill="url(#logoGradient)" />

      {/* ShieldCheck icon (Lucide) - centered and scaled */}
      <g
        transform="translate(116, 116) scale(11.67)"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Shield path */}
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        {/* Checkmark path */}
        <path d="m9 12 2 2 4-4" />
      </g>
    </svg>
  );
}
