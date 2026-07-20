import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Sticky action bar below the scrollable body */
  footer?: React.ReactNode;
  /** Block Escape, backdrop, and X while a critical action runs */
  preventClose?: boolean;
  /** Accessible name when title is omitted */
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
}

/**
 * Shared modal shell for real interactions (confirmations, forms).
 * Header + scrollable body + optional sticky footer; max-height for mobile.
 */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  preventClose = false,
  ariaLabel,
  className = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) onClose();
    };

    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, preventClose]);

  if (!open) return null;

  const requestClose = () => {
    if (!preventClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Dialog'}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={requestClose}
        disabled={preventClose}
      />
      <div
        className={`relative flex w-full max-h-[92vh] sm:max-h-[90vh] flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl sm:max-w-lg ${className}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-forge-navy truncate pr-2">
            {title || 'Dialog'}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={preventClose}
            className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-forge-navy disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-5 ${bodyClassName}`}>
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-5 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Modal;
