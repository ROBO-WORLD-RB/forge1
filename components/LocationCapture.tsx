import React, { useState } from 'react';
import { MapPin, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { captureBrowserLocation, isGeolocationSupported, type GeoCoordinates } from '../utils/geolocation';

interface LocationCaptureProps {
  coordinates: GeoCoordinates | null;
  onCapture: (coords: GeoCoordinates | null) => void;
  className?: string;
}

/**
 * Optional UI for capturing browser geolocation (location_lat/lng) for search ranking.
 */
const LocationCapture: React.FC<LocationCaptureProps> = ({ coordinates, onCapture, className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    if (!isGeolocationSupported()) {
      setError('Geolocation is not supported in this browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const coords = await captureBrowserLocation();
      onCapture(coords);
    } catch (err: any) {
      setError(err.message || 'Could not get your location');
      onCapture(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setError(null);
    onCapture(null);
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-gray-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white rounded-lg border border-gray-100">
          <MapPin className="w-5 h-5 text-forge-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">Pin your location (optional)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Helps customers find you in nearby search results. Your exact address is never shown.
          </p>

          {coordinates && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>
                Location saved ({coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)})
              </span>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCapture}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-forge-navy text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {coordinates ? 'Update location' : 'Use my location'}
            </button>
            {coordinates && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationCapture;
