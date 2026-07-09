/**
 * NimAgent Icon System
 *
 * A unified, line-stroke icon set (Feather/Lucide style) so the whole app
 * shares one visual language instead of mismatched emojis. All icons inherit
 * `currentColor`, scale with the `size` prop, and accept a className.
 *
 * Usage: <Icon name="send" size={20} className="text-gold" />
 */

export type IconName =
  | 'send'
  | 'receive'
  | 'wallet'
  | 'balance'
  | 'gift-card'
  | 'airtime'
  | 'bill'
  | 'swap'
  | 'qr-code'
  | 'qr-scan'
  | 'delete'
  | 'history'
  | 'chat'
  | 'home'
  | 'explorer'
  | 'copy'
  | 'download'
  | 'check'
  | 'plus'
  | 'chevron-down'
  | 'chevron-right'
  | 'mic'
  | 'disconnect'
  | 'robot'
  | 'sparkles'
  | 'globe'
  | 'info'
  | 'alert'
  | 'lock'
  | 'unlock'
  | 'refresh'
  | 'settings'
  | 'gift'
  | 'trophy'
  | 'share'
  | 'calendar'
  | 'clock'
  | 'shield'
  | 'close'
  | 'phone'
  | 'document';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.9 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  switch (name) {
    case 'send':
      return (
        <svg {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
      );

    case 'receive':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      );

    case 'wallet':
    case 'balance':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5" />
          <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'gift-card':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M3 12h18" />
          <path d="M12 8v13" />
          <path d="M12 8c-1.5-3-5-3-5-1 0 1.5 2.5 1 5 1Z" />
          <path d="M12 8c1.5-3 5-3 5-1 0 1.5-2.5 1-5 1Z" />
        </svg>
      );

    case 'airtime':
      return (
        <svg {...common}>
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      );

    case 'bill':
      return (
        <svg {...common}>
          <path d="M13 2 4.5 12.5a.6.6 0 0 0 .5 1h6l-1 8L19.5 11a.6.6 0 0 0-.5-1h-6l1-8Z" />
        </svg>
      );

    case 'swap':
      return (
        <svg {...common}>
          <path d="M7 4 3 8l4 4" />
          <path d="M3 8h13a4 4 0 0 1 0 8h-1" />
          <path d="m17 20 4-4-4-4" />
          <path d="M21 16H8" />
        </svg>
      );

    case 'qr-code':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3" />
          <path d="M21 14v7h-7" />
          <path d="M17.5 17.5h.01" />
        </svg>
      );

    case 'qr-scan':
      return (
        <svg {...common}>
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <path d="M3 12h18" />
        </svg>
      );

    case 'delete':
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );

    case 'history':
      return (
        <svg {...common}>
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l4 2" />
        </svg>
      );

    case 'chat':
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );

    case 'home':
      return (
        <svg {...common}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );

    case 'explorer':
      return (
        <svg {...common}>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      );

    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );

    case 'download':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <path d="M12 15V3" />
        </svg>
      );

    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case 'chevron-down':
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );

    case 'chevron-right':
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );

    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 17v4" />
        </svg>
      );

    case 'disconnect':
      return (
        <svg {...common}>
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <path d="M12 2v10" />
        </svg>
      );

    case 'robot':
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="12" rx="3" />
          <path d="M12 8V4" />
          <circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
          <path d="M9 13h.01" />
          <path d="M15 13h.01" />
          <path d="M2 13v3" />
          <path d="M22 13v3" />
        </svg>
      );

    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <path d="m6.3 6.3 2.4 2.4" />
          <path d="m15.3 15.3 2.4 2.4" />
          <path d="m17.7 6.3-2.4 2.4" />
          <path d="m8.7 15.3-2.4 2.4" />
        </svg>
      );

    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );

    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );

    case 'alert':
      return (
        <svg {...common}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );

    case 'unlock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
          <path d="M8 11V7a4 4 0 0 1 7.5-2" />
        </svg>
      );

    case 'refresh':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74" />
          <path d="M3 3v4h4" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );

    case 'gift':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M3 12h18" />
          <path d="M12 8v13" />
          <path d="M12 8c-1.5-3-5-3-5-1 0 1.5 2.5 1 5 1Z" />
          <path d="M12 8c1.5-3 5-3 5-1 0 1.5-2.5 1-5 1Z" />
        </svg>
      );

    case 'trophy':
      return (
        <svg {...common}>
          <path d="M6 9H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2" />
          <path d="M9 22V9a3 3 0 0 1 6 0v13" />
          <path d="M12 12l-1.5 2.5 1.5 2.5L15 17" />
        </svg>
      );

    case 'share':
      return (
        <svg {...common}>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      );

    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );

    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );

    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      );

    case 'close':
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );

    case 'phone':
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );

    case 'document':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" />
        </svg>
      );

    default:
      return null;
  }
}