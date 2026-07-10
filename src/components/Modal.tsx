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
 * - Locks body scroll while open (with fail-safe recovery)
 * - Flat styling consistent with the app's design system
 * 
 * Note: Improved scroll lock handling prevents permanent freeze issues
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Store previous overflow values
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    
    // Lock scroll on both body and html
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      
      // Restore previous overflow values
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      
      // Safety: ensure scroll is never permanently locked
      // If no modals are open, force restore scroll
      setTimeout(() => {
        const hasOpenModals = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (!hasOpenModals) {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        }
      }, 50);
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
      {/* Backdrop - Nimiq standard */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel - Nimiq glass surface with 10px radius */}
      <div className={`relative w-full ${maxWidth} glass-strong rounded-[10px] shadow-2xl animate-modal-in`}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#1F2348]/10 dark:border-white/[0.08]">
            <div>
              {title && <h3 className="text-base font-bold text-[#1F2348] dark:text-white">{title}</h3>}
              {subtitle && <p className="text-xs text-[#1F2348]/70 dark:text-white/70/60 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#1F2348]/60 dark:text-white/60/55 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
              style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 pb-5 pt-2 flex gap-2 justify-end border-t border-[#1F2348]/10 dark:border-white/[0.08]">{footer}</div>
        )}
      </div>
    </div>
  );
}
