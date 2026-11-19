import { useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const V3_SHIELD_PATH =
  'M 256 98 C 262 98 268 100 273 104 C 302 126 336 136 368 138 C 380 139 388 147 388 160 ' +
  'L 388 242 C 388 324 334 382 266 413 C 260 416 252 416 246 413 ' +
  'C 178 382 124 324 124 242 L 124 160 C 124 147 132 139 144 138 ' +
  'C 176 136 210 126 239 104 C 244 100 250 98 256 98 Z ' +
  'M 207.2 230.8 A 21.5 21.5 0 0 0 176.8 261.2 L 220.8 305.2 A 21.5 21.5 0 0 0 251.2 305.2 ' +
  'L 339.2 217.2 A 21.5 21.5 0 0 0 308.8 186.8 L 236.0 259.59 Z';

/**
 * Brand logo component - renders unified V3 inline SVG for Header, Footer, and FooterCTA.
 */
export function Logo({ size = 40, className = '' }: LogoProps) {
  const uid = useId();
  const gradId = `${uid}-grad`;
  const sheenId = `${uid}-sheen`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={`flex-shrink-0 rounded-[22%] ${className}`}
      aria-label="SafeUnfollow logo"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5B6BE0" />
          <stop offset="50%" stopColor="#9B5DE5" />
          <stop offset="100%" stopColor="#E05B9B" />
        </linearGradient>
        <radialGradient id={sheenId} cx="28%" cy="20%" r="72%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={`url(#${gradId})`} />
      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={`url(#${sheenId})`} />

      <path fill="#FFFFFF" fillRule="evenodd" d={V3_SHIELD_PATH} />
    </svg>
  );
}
