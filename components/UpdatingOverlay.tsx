import React from 'react';

interface UpdatingOverlayProps {
  onDismiss?: () => void;
  onUpdate?: () => void;
}

/** Full-screen overlay when a new app version is available. */
const UpdatingOverlay: React.FC<UpdatingOverlayProps> = ({ onDismiss, onUpdate }) => {
  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-forge-navy text-white px-safe pt-safe pb-safe animate-in fade-in duration-200"
      role="status"
      aria-live="polite"
      aria-label="Update available"
    >
      <div className="flex flex-col items-center justify-center gap-6 px-6 text-center max-w-sm">
        <img
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 object-contain animate-pulse"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Updating FORGE</h1>
          <p className="text-sm text-white/70">A new version is available.</p>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-white/20" />
          <div className="absolute h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-forge-orange" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {onUpdate && (
            <button
              type="button"
              onClick={onUpdate}
              className="min-h-[44px] px-4 py-2 bg-forge-orange hover:bg-forge-orange/90 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Update Now
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-[44px] px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatingOverlay;
