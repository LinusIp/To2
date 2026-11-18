// Icons from docs/prototypes/mobile-app.html (inline SVG, currentColor).
import { brand } from "@/config/brand";
type P = { size?: number; className?: string };

export const HomeIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" />
  </svg>
);
export const BookIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0zM12 5c2.5-1.5 5-1.5 8 0v15c-3-1.5-5.5-1.5-8 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
export const ChartIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <g fill="currentColor">
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="16" y="3" width="4" height="17" rx="1" />
    </g>
  </svg>
);
export const GearIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </g>
  </svg>
);
export const FlameIcon = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 2c1.5 4.5 6 6 6 12a6 6 0 0 1-12 0c0-2.6 1.3-4 2.6-5.2.2 2.3 1.3 3.4 2.4 3.4 0-3.6-1.4-6 1-10.2z" fill="#ff7a1a" />
    <path d="M12 12c.8 2 2.6 2.7 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.5.9-2.4 1.6-3 .1 1 .6 1.5 1 1.5 0-1.5-.6-2.5 0-3.5z" fill="#ffd23f" />
  </svg>
);
export const StarIcon = ({ size = 40, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" fill="#ffc42e" stroke="#f0a400" strokeWidth="1" />
  </svg>
);
export const TrophyIcon = ({ size = 46, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffc42e" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" fill="none" stroke="#f0a400" strokeWidth="1.6" />
    <rect x="10.5" y="12.5" width="3" height="4" fill="#f0a400" />
    <rect x="7.5" y="16.5" width="9" height="3" rx="1" fill="#e08e00" />
    <path d="M12 4.5l.9 1.8 2 .2-1.5 1.3.4 2-1.8-1-1.8 1 .4-2L9.1 6.5l2-.2z" fill="#fff6d6" />
  </svg>
);
export const BackIcon = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ArrowIcon = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ChevronIcon = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className={className} aria-hidden>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const CloseIcon = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" className={className} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const MicIcon = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={className} aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);
export const SpeakerIcon = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
    <path d="M16 9a4 4 0 0 1 0 6" />
    <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
// mockup v2 tab icons
export const CupIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M7 4h10v5a5 5 0 01-10 0zM4 5h3v3a3 3 0 01-3-3zM20 5h-3v3a3 3 0 003-3zM10 15h4v3h3v3H7v-3h3z" />
  </svg>
);
export const UserIcon = ({ size = 24, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-5 5-7 8-7s7 2 8 7z" />
  </svg>
);
export const CheckIcon = ({ size = 16, className, color = "currentColor" }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const LockIcon = ({ size = 12, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const TriangleIcon = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" aria-hidden>
    <path d="M12 4l9 16H3z" />
  </svg>
);
export const BarsIcon = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
    <rect x="3" y="13" width="4" height="8" rx="1" />
    <rect x="10" y="8" width="4" height="13" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);
export const KeyboardIcon = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </svg>
);
export const ReplayIcon = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 12a8 8 0 1 0 3-6.2" />
    <path d="M4 4v5h5" />
  </svg>
);
export const Logo = ({ size = 36 }: { size?: number }) => (
  <span style={{ fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, fontSize: size }}>
    {brand.wordmark[0]}
    <span style={{ color: "#2563eb" }}>{brand.wordmark[1]}</span>
  </span>
);
