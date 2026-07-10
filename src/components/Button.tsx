/**
 * Nimiq Button Component
 * 
 * Standardized button following Nimiq UI Kit specifications:
 * - 13.5px border radius (Nimiq standard)
 * - Nimiq easing: cubic-bezier(0.25, 0, 0, 1)
 * - Complete states: default, hover, focus, active, disabled, loading
 * - Functional color variants: gold (crypto), blue (commerce), secondary (outline)
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import Icon, { IconName } from './Icon';
import { InlineSpinner } from './LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'blue' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'gold',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  // Size configurations
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  // Variant styles
  const variants = {
    gold: {
      base: 'bg-[#E9B213] text-[#1F2348] font-bold shadow-[0_2px_8px_rgba(233,178,19,0.25)]',
      hover: 'hover:bg-[#FC8702] hover:shadow-[0_4px_16px_rgba(233,178,19,0.35)] hover:-translate-y-0.5',
      active: 'active:translate-y-0',
      focus: 'focus:outline-none focus:ring-3 focus:ring-[#E9B213]/25',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-[#E9B213]',
    },
    blue: {
      base: 'bg-[#0582CA] text-white font-bold shadow-[0_2px_8px_rgba(5,130,202,0.25)]',
      hover: 'hover:bg-[#0CA6FE] hover:shadow-[0_4px_16px_rgba(5,130,202,0.35)] hover:-translate-y-0.5',
      active: 'active:translate-y-0',
      focus: 'focus:outline-none focus:ring-3 focus:ring-[#0582CA]/25',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-[#0582CA]',
    },
    secondary: {
      base: 'bg-gray-100 dark:bg-white/5 text-[#E9B213] border border-[#E9B213]/30 font-bold',
      hover: 'hover:bg-[#E9B213]/10 hover:-translate-y-0.5',
      active: 'active:translate-y-0',
      focus: 'focus:outline-none focus:ring-3 focus:ring-[#E9B213]/25',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-gray-100',
    },
    ghost: {
      base: 'bg-transparent text-gray-700 dark:text-white/70 font-semibold',
      hover: 'hover:bg-gray-100 dark:hover:bg-white/5',
      active: 'active:bg-gray-200 dark:active:bg-white/10',
      focus: 'focus:outline-none focus:ring-3 focus:ring-gray-300/25 dark:focus:ring-white/10',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    },
  };

  const variantClasses = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        relative
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-[13.5px]
        transition-all
        duration-200
        ${sizes[size]}
        ${variantClasses.base}
        ${!isDisabled ? variantClasses.hover : ''}
        ${!isDisabled ? variantClasses.active : ''}
        ${variantClasses.focus}
        ${variantClasses.disabled}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)',
      }}
      disabled={isDisabled}
      {...props}
    >
      {loading && <InlineSpinner />}
      {!loading && icon && iconPosition === 'left' && (
        <Icon name={icon} size={iconSizes[size]} strokeWidth={2} />
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <Icon name={icon} size={iconSizes[size]} strokeWidth={2} />
      )}
    </button>
  );
}
