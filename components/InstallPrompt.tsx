import React, { useState, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import { isServiceWorkerSupported } from '../services/serviceWorker';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isStandalone) return;
      const dismissed = localStorage.getItem('forge-ios-install-dismissed');
      if (!dismissed) {
        setShowIOSInstructions(true);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsDismissed(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setIsDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (isIOS) {
      localStorage.setItem('forge-ios-install-dismissed', 'true');
      setShowIOSInstructions(false);
    }
  }, [isIOS]);

  if (isDismissed) return null;
  if (!deferredPrompt && !showIOSInstructions) return null;
  if (!isServiceWorkerSupported()) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-forge-navy text-white rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-forge-orange" />
          </div>
          <div className="flex-1 min-w-0">
            {showIOSInstructions ? (
              <>
                <p className="text-sm font-semibold mb-1">Install FORGE</p>
                <p className="text-xs text-white/70 leading-relaxed">
                  Tap the share button <span className="inline-block px-1 py-0.5 bg-white/10 rounded text-[11px] font-mono">⎔</span> then scroll down and tap <strong>"Add to Home Screen"</strong>.
                </p>
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
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {deferredPrompt && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-forge-orange text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-orange-600 transition-colors active:scale-[0.98]"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 text-xs text-white/60 hover:text-white transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
