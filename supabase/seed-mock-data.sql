-- ============================================
-- FORGE Marketplace Mock Data Seed Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- 0. EXTENSIONS: Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHEMA REPAIR: Ensure required tables and columns exist
-- This section creates missing tables if you haven't run the full schema yet

-- 1.1 Profiles table fixes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='worker_status') THEN
        ALTER TABLE profiles ADD COLUMN worker_status TEXT DEFAULT 'pending' CHECK (worker_status IN ('pending', 'pending_payment', 'active', 'suspended'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='specialties') THEN
        ALTER TABLE profiles ADD COLUMN specialties TEXT[];
    END IF;
END $$;

-- 1.2 Worker Profiles Table
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('GH', 'NG')),
  bio TEXT,
  hourly_rate_min DECIMAL(10,2),
  hourly_rate_max DECIMAL(10,2),
  currency TEXT CHECK (currency IN ('GHS', 'NGN')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  skills TEXT[],
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium')),
  verified BOOLEAN DEFAULT false,
  experience_years INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Worker Portfolios Table
CREATE TABLE IF NOT EXISTS worker_portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Worker Endorsements Table
CREATE TABLE IF NOT EXISTS worker_endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endorsement_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_users CHECK (referrer_id <> referee_id)
);

-- 2. Create Auth Users (Required for foreign key constraints)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
('00000000-0000-0000-0000-000000000001', 'kofi@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"worker"}', now(), now(), 'authenticated', 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000002', 'ama@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"worker"}', now(), now(), 'authenticated', 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000003', 'chidi@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"worker"}', now(), now(), 'authenticated', 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000004', 'zainab@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"worker"}', now(), now(), 'authenticated', 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000005', 'kwesi@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"customer"}', now(), now(), 'authenticated', 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000006', 'nneka@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"customer"}', now(), now(), 'authenticated', 'authenticated', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure Categories exist
INSERT INTO service_categories (name, slug, icon) VALUES
('Electrical', 'electrical', 'Zap'),
('Plumbing', 'plumbing', 'Droplet'),
('Carpentry', 'carpentry', 'Hammer'),
('Painting', 'painting', 'PaintBucket'),
('HVAC / AC', 'hvac', 'Wind'),
('Cleaning', 'cleaning', 'Sparkles'),
('Catering', 'catering', 'Utensils'),
('Event Decor', 'event-decor', 'Flower'),
('Event Planning', 'event-planning', 'Calendar'),
('Fashion Design', 'fashion-design', 'Scissors'),
('Photography', 'photography', 'Camera'),
('Makeup Artistry', 'makeup', 'Palette'),
('Auto Repair', 'auto-repair', 'Car'),
('Gardening', 'gardening', 'Leaf'),
('Interior Design', 'interior-design', 'Layout')
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- 4. Create Public Profiles
INSERT INTO profiles (id, phone, role, first_name, last_name, username, bio, location, country, avatar_url, profile_completed, worker_status)
VALUES
('00000000-0000-0000-0000-000000000001', '+233501234567', 'worker', 'Kofi', 'Mensah', '@kofisparks', 'Expert electrician with 10 years experience in domestic and industrial wiring.', 'Accra', 'GH', 'https://images.unsplash.com/photo-1540560085334-6e0ad303d291?w=400&auto=format&fit=crop&q=60', true, 'active'),
('00000000-0000-0000-0000-000000000002', '+233501234568', 'worker', 'Ama', 'Osei', '@ama_decor', 'Passionate interior designer specializing in modern African aesthetics.', 'Kumasi', 'GH', 'https://images.unsplash.com/photo-1531123897727-8f129e16fd3c?w=400&auto=format&fit=crop&q=60', true, 'active'),
('00000000-0000-0000-0000-000000000003', '+234801234567', 'worker', 'Chidi', 'Okonkwo', '@chidi_pipes', 'Reliable plumber for all your leak fixes and installations.', 'Lagos', 'NG', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=60', true, 'active'),
('00000000-0000-0000-0000-000000000004', '+234801234568', 'worker', 'Zainab', 'Bello', '@zainab_events', 'Professional event planner with a knack for details and elegance.', 'Abuja', 'NG', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=60', true, 'active'),
('00000000-0000-0000-0000-000000000005', '+233501234569', 'customer', 'Kwesi', 'Appiah', '@kwesi_appiah', null, 'Accra', 'GH', null, true, 'active'),
('00000000-0000-0000-0000-000000000006', '+234801234569', 'customer', 'Nneka', 'Eze', '@nneka_eze', null, 'Lagos', 'NG', null, true, 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Create Worker Profiles
INSERT INTO worker_profiles (user_id, name, role, location, country, bio, hourly_rate_min, hourly_rate_max, currency, skills, tier, verified)
VALUES
('00000000-0000-0000-0000-000000000001', 'Kofi Mensah', 'Electrician', 'Accra', 'GH', 'Expert electrician with 10 years experience in domestic and industrial wiring.', 20.00, 50.00, 'GHS', ARRAY['Wiring', 'Solar Panels', 'Fault Finding'], 'premium', true),
('00000000-0000-0000-0000-000000000002', 'Ama Osei', 'Interior Design', 'Kumasi', 'GH', 'Passionate interior designer specializing in modern African aesthetics.', 50.00, 150.00, 'GHS', ARRAY['Decor', 'Space Planning', 'Furniture'], 'basic', true),
('00000000-0000-0000-0000-000000000003', 'Chidi Okonkwo', 'Plumbing', 'Lagos', 'NG', 'Reliable plumber for all your leak fixes and installations.', 5000.00, 15000.00, 'NGN', ARRAY['Piping', 'Taps', 'Sewage'], 'free', false),
('00000000-0000-0000-0000-000000000004', 'Zainab Bello', 'Event Planning', 'Abuja', 'NG', 'Professional event planner with a knack for details and elegance.', 15000.00, 40000.00, 'NGN', ARRAY['Weddings', 'Corporate', 'Parties'], 'premium', true)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Create Mock Portfolios
INSERT INTO worker_portfolios (worker_id, title, description, media_urls)
VALUES
('00000000-0000-0000-0000-000000000001', 'Penthouse Wiring', 'Full electrical installation for a luxury penthouse in East Legon.', ARRAY['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500']),
('00000000-0000-0000-0000-000000000002', 'Lakeside Villa Decor', 'Minimalist interior redesign for a lakeside retreat.', ARRAY['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500']),
('00000000-0000-0000-0000-000000000004', 'Lagos Tech Summit', 'Organized a 3-day tech summit for 500+ attendees.', ARRAY['https://images.unsplash.com/photo-1540575861501-7c03b177a9a5?w=500'])
ON CONFLICT DO NOTHING;

-- 7. Create Mock Endorsements
INSERT INTO worker_endorsements (referrer_id, referee_id, endorsement_text)
VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Ama is hands down the best designer I have worked with on large projects.'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Kofi is extremely reliable. I always recommend him to my plumbing clients for electrical needs.')
ON CONFLICT DO NOTHING;

-- 8. Create Mock Jobs
INSERT INTO jobs (poster_user_id, title, description, category, location, country, budget_min, budget_max, currency, status)
VALUES
('00000000-0000-0000-0000-000000000005', 'AC Repair Needed', 'My office AC is making strange noises and not cooling properly.', 'hvac', 'Accra', 'GH', 100, 300, 'GHS', 'open'),
('00000000-0000-0000-0000-000000000006', 'House Painting', 'Need to repaint a 3-bedroom apartment in Lekki Phase 1.', 'painting', 'Lagos', 'NG', 40000, 80000, 'NGN', 'open')
ON CONFLICT DO NOTHING;
