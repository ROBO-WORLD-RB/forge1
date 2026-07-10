export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable';

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Request the user's current position via the browser Geolocation API.
 * Optional — callers should handle rejection gracefully.
 */
export function captureBrowserLocation(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied'
            : error.code === error.TIMEOUT
              ? 'Location request timed out'
              : 'Unable to get your location';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}
