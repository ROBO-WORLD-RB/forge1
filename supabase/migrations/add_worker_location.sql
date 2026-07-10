-- Add optional geolocation to worker_profiles for distance-based ranking.
-- Safe to run on existing databases (columns are nullable).

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_location
  ON worker_profiles (location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
