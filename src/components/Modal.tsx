'use client';

import { useEffect, type ReactNode } from 'react';
import Icon from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional footer (e.g. action buttons) */
  footer?: ReactNode;
  maxWidth?: string;
}

/**
 * Accessible, professional modal dialog.
 * - Click backdrop or press Escape to close
 * - Locks body scroll while open
 * - Flat styling consistent with the app's design system
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-sm',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-in"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative w-full ${maxWidth} bg-white dark:bg-[rgba(20,22,34,0.98)] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl animate-modal-in backdrop-blur-xl`}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-gray-200 dark:border-white/[0.06]">
            <div>
              {title && <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>}
              {subtitle && <p className="text-xs text-gray-500 dark:text-white/45 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 pb-5 pt-1 flex gap-2 justify-end">{footer}</div>
        )}
      </div>
    </div>
  );
}