/**
 * Nimiq Loading Spinner Component
 * 
 * Based on Nimiq UI Kit standards:
 * - Uses Nimiq Gold (#E9B213) as primary color
 * - Nimiq easing: cubic-bezier(0.25, 0, 0, 1)
 * - Multiple size variants
 * - Supports both light and dark mode
 */

interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom color override (defaults to Nimiq Gold) */
  color?: 'gold' | 'blue' | 'white' | 'current';
  /** Optional className for additional styling */
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'md', 
  color = 'gold',
  className = '' 
}: LoadingSpinnerProps) {
  // Size mappings
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-[2.5px]',
    lg: 'w-10 h-10 border-3',
  };

  // Color mappings - using Nimiq brand colors with better visibility
  const colorMap = {
    gold: 'border-[#E9B213]/20 dark:border-[#E9B213]/30 border-t-[#E9B213]',
    blue: 'border-[#0582CA]/20 dark:border-[#0582CA]/30 border-t-[#0582CA]',
    white: 'border-white/30 border-t-white',
    current: 'border-current/30 border-t-current',
  };

  return (
    <div
      className={`
        ${sizeMap[size]}
        ${colorMap[color]}
        rounded-full
        animate-spin
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      style={{
        animationDuration: '0.8s',
        animationTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)', // Nimiq easing
      }}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Inline Loading Spinner - For use inside buttons or inline content
 */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return <LoadingSpinner size="sm" color="current" className={className} />;
}

/**
 * Page Loading Spinner - For full-page loading states with message
 */
interface PageLoadingProps {
  message?: string;
  submessage?: string;
}

export function PageLoading({ message = 'Loading...', submessage }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <LoadingSpinner size="lg" />
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
