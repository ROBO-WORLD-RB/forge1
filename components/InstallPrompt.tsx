import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { isServiceWorkerSupported } from '../services/serviceWorker';
import { setInstallPromptVisible } from '../utils/installPromptVisibility';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __forgeDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Capture beforeinstallprompt as early as possible (before React mounts). */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__forgeDeferredInstallPrompt = e as BeforeInstallPromptEvent;
  });
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSUa = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ can report as MacIntel with touch
  const iPadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return (iOSUa || iPadOs) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const ios = isIOSDevice();
    setIsIOS(ios);

    if (ios) {
      if (isStandaloneDisplay()) return;
      const dismissed = localStorage.getItem('forge-ios-install-dismissed');
      if (!dismissed) {
        setShowIOSInstructions(true);
      }
      return;
    }

    // Pick up prompt captured before this component mounted
    const early = window.__forgeDeferredInstallPrompt ?? null;
    if (early) {
      setDeferredPrompt(early);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__forgeDeferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const onInstalled = () => {
      window.__forgeDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      setIsDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        window.__forgeDeferredInstallPrompt = null;
        setDeferredPrompt(null);
      }
    } finally {
      setIsDismissed(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (isIOS) {
      localStorage.setItem('forge-ios-install-dismissed', 'true');
      setShowIOSInstructions(false);
    }
  }, [isIOS]);

  const isVisible =
    !isDismissed &&
    (!!deferredPrompt || showIOSInstructions) &&
    isServiceWorkerSupported();

  // Let other fixed UI (AI FAB) yield while the install banner is on screen
  useEffect(() => {
    setInstallPromptVisible(isVisible);
    return () => setInstallPromptVisible(false);
  }, [isVisible]);

  if (!isVisible) return null;

  const canNativeInstall = !!deferredPrompt && !showIOSInstructions;

  return (
    <div
      className="fixed inset-x-3 z-[60] animate-slide-up pointer-events-none bottom-above-nav"
      role="dialog"
      aria-label="Install FORGE"
      aria-modal="false"
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-forge-navy text-white rounded-2xl p-4 shadow-2xl border border-white/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-forge-orange" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            {showIOSInstructions ? (
              <>
                <p className="text-sm font-semibold mb-1.5">Install FORGE</p>
                <p className="text-xs text-white/75 leading-relaxed mb-2">
                  Add FORGE to your Home Screen for a full-screen app experience.
                </p>
                <ol className="text-xs text-white/85 space-y-1.5 list-none p-0 m-0">
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-forge-orange">
                      1
                    </span>
                    <span className="leading-relaxed">
                      Tap{' '}
                      <Share className="inline-block w-3.5 h-3.5 align-text-bottom text-forge-orange" aria-hidden />{' '}
                      <strong>Share</strong> in Safari&apos;s toolbar
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-forge-orange">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Scroll and tap{' '}
                      <PlusSquare className="inline-block w-3.5 h-3.5 align-text-bottom text-forge-orange" aria-hidden />{' '}
                      <strong>Add to Home Screen</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-forge-orange">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Tap <strong>Add</strong> to confirm
                    </span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold mb-1">Install FORGE App</p>
                <p className="text-xs text-white/70 leading-relaxed">
                  Install our app for the best experience — works offline and loads faster.
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 -mr-1 -mt-1 hover:bg-white/10 rounded-lg transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Always show a clear CTA row — never leave users with only the X */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {canNativeInstall ? (
            <>
              <button
                type="button"
                onClick={handleInstall}
                className="w-full sm:flex-1 bg-forge-orange text-white text-sm font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors active:scale-[0.98] min-h-[44px]"
              >
                Install
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto sm:min-w-[7rem] text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors py-3 rounded-xl min-h-[44px]"
              >
                Not now
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:flex-1 bg-forge-orange text-white text-sm font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors active:scale-[0.98] min-h-[44px]"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto sm:min-w-[7rem] text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors py-3 rounded-xl min-h-[44px]"
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
