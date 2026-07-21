import React from 'react';

/** Full-screen overlay while a service worker or version update is applying. */
const UpdatingOverlay: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-forge-navy text-white px-safe pt-safe pb-safe animate-in fade-in duration-200"
      role="status"
      aria-live="polite"
      aria-label="Updating app"
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
          <p className="text-sm text-white/70">Getting the latest version for you…</p>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-white/20" />
          <div className="absolute h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-forge-orange" />
        </div>
      </div>
    </div>
  );
};

export default UpdatingOverlay;
