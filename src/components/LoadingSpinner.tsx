/**
 * Nimiq Loading Components
 * 
 * Based on Nimiq UI Kit standards (https://nimiqtoolbox.github.io/nimiq-ui-kit/#vc-feedback):
 * 
 * 1. Loading Spinner (Dot-based): For large/heavy operations
 *    - Three animated dots
 *    - Use for: page loads, initial data fetching, major state changes
 * 
 * 2. Circular Spinner (Ring-based): For quick operations
 *    - Rotating circular ring
 *    - Use for: refresh, small updates, button actions
 * 
 * Both use Nimiq easing: cubic-bezier(0.25, 0, 0, 1)
 */

interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Spinner type: 'loading' for dots (heavy ops), 'circular' for ring (quick ops) */
  type?: 'loading' | 'circular';
  /** Custom color override (defaults to Nimiq Gold) */
  color?: 'gold' | 'blue' | 'white' | 'current';
  /** Optional className for additional styling */
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'md',
  type = 'circular', // Default to circular for backwards compatibility
  color = 'gold',
  className = '' 
}: LoadingSpinnerProps) {
  if (type === 'loading') {
    return <LoadingSpinnerDots size={size} color={color} className={className} />;
  }
  return <CircularSpinner size={size} color={color} className={className} />;
}

/**
 * Loading Spinner (Dot-based) - For large/heavy operations
 * Three animated dots that pulse in sequence
 */
function LoadingSpinnerDots({
  size = 'md',
  color = 'gold',
  className = '',
}: Omit<LoadingSpinnerProps, 'type'>) {
  // Dot size mappings
  const dotSizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  // Gap between dots
  const gapMap = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2',
  };

  // Color mappings
  const colorMap = {
    gold: 'bg-[#E9B213]',
    blue: 'bg-[#0582CA]',
    white: 'bg-white',
    current: 'bg-current',
  };

  const dotClass = `${dotSizeMap[size]} ${colorMap[color]} rounded-full`;

  return (
    <div
      className={`flex items-center ${gapMap[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div 
        className={`${dotClass} animate-pulse`}
        style={{
          animationDuration: '1.4s',
          animationTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)',
          animationDelay: '0s',
        }}
      />
      <div 
        className={`${dotClass} animate-pulse`}
        style={{
          animationDuration: '1.4s',
          animationTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)',
          animationDelay: '0.2s',
        }}
      />
      <div 
        className={`${dotClass} animate-pulse`}
        style={{
          animationDuration: '1.4s',
          animationTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)',
          animationDelay: '0.4s',
        }}
      />
    </div>
  );
}

/**
 * Circular Spinner (Ring-based) - For quick operations
 * Rotating circular ring
 */
function CircularSpinner({
  size = 'md',
  color = 'gold',
  className = '',
}: Omit<LoadingSpinnerProps, 'type'>) {
  // Size mappings (diameter in pixels)
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 40,
  };

  const diameter = sizeMap[size];
  const radius = diameter / 2 - 2; // Account for stroke width
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference * 0.75} ${circumference}`;

  // Color mappings
  const colorMap = {
    gold: '#E9B213',
    blue: '#0582CA',
    white: '#FFFFFF',
    current: 'currentColor',
  };

  const strokeColor = colorMap[color];

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      className={`animate-spin ${className}`}
      style={{
        animationDuration: '0.8s',
        animationTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)', // Nimiq easing
      }}
      role="status"
      aria-label="Loading"
    >
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        opacity={color === 'current' ? 1 : 0.9}
      />
    </svg>
  );
}

/**
 * Inline Loading Spinner - For use inside buttons or inline content
 * Uses circular spinner for quick operations
 */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return <LoadingSpinner size="sm" type="circular" color="current" className={className} />;
}

/**
 * Page Loading Spinner - For full-page loading states with message
 * Uses loading (dot-based) spinner for heavy operations
 */
interface PageLoadingProps {
  message?: string;
  submessage?: string;
}

export function PageLoading({ message = 'Loading...', submessage }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <LoadingSpinner size="lg" type="loading" />
      <p className="mt-4 text-sm font-semibold text-[#1F2348] dark:text-white/75">
        {message}
      </p>
      {submessage && (
        <p className="mt-1 text-xs text-[#1F2348]/60 dark:text-white/55">
          {submessage}
        </p>
      )}
    </div>
  );
}
