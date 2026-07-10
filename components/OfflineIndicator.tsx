import React, { useState, useEffect } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track when we go offline
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Show reconnected message when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show reconnected notification
  if (showReconnected) {
    return (
      <div className="fixed top-16 left-0 right-0 bg-forge-success text-white py-3 px-4 flex items-center justify-center gap-2 z-50 shadow-md">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">Back online! Syncing your data...</span>
      </div>
    );
  }

  // Don't show if online or dismissed
  if (isOnline || isDismissed) return null;

  return (
    <div className="fixed top-16 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 flex items-center justify-between z-50 shadow-md">
      <div className="flex items-center gap-3 flex-1 justify-center">
        <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">You're offline</span>
          <span className="text-xs opacity-90">Some features may be unavailable until you reconnect.</span>
        </div>
      </div>
      <button
        onClick={() => setIsDismissed(true)}
        className="p-2 hover:bg-white/20 rounded-full transition-colors ml-2"
        aria-label="Dismiss offline notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default OfflineIndicator;
