import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface UpdatePromptProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

const UpdatePrompt: React.FC<UpdatePromptProps> = ({ onUpdate, onDismiss }) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-forge-navy text-white rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-forge-orange/20 rounded-full flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-forge-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Update Available</h3>
          <p className="text-sm text-gray-300 mt-1">
            A new version of Forge is available. Refresh to get the latest features.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onUpdate}
              className="px-4 py-2 bg-forge-orange hover:bg-forge-orange/90 text-white text-sm font-medium rounded-md transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-md transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
