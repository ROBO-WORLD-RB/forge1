-- ============================================
-- Forge: Collision-proof username generation
-- Migration 004
-- ============================================
-- APPLY THIS MIGRATION in Supabase Dashboard → SQL Editor:
--   1. Open your Forge project in https://supabase.com/dashboard
--   2. Go to SQL Editor → New query
--   3. Paste this entire file and click Run
--
-- Fixes:
--   • handle_new_user() default usernames use the full UUID hex (32 chars)
--     so zero-padded / similar UUIDs no longer collide as @user000000000000
--   • Custom usernames retry with UUID + random suffixes until unique
--   • Exception fallback also uses full hex + random (never truncates to 12 zeros)
--   • Empty phones still stored as NULL
--
-- Safe to run even if 003 partially applied (CREATE OR REPLACE only).
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  assigned_role TEXT;
  final_phone TEXT;
  base_username TEXT;
  final_username TEXT;
  id_hex TEXT;
  attempt INT := 0;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  IF meta_role IN ('worker', 'customer') THEN
    assigned_role := meta_role;
  ELSE
    assigned_role := 'customer';
  END IF;

  -- Never store '' for phone — UNIQUE treats '' as a real value (one empty slot only)
  final_phone := NULLIF(
    btrim(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')),
    ''
  );

  -- Full UUID without dashes (32 hex chars) — unique per auth.users row
  id_hex := replace(NEW.id::text, '-', '');

  base_username := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  IF base_username IS NOT NULL THEN
    base_username := lower(regexp_replace(base_username, '^@+', '', 'g'));
    base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    -- Guaranteed unique: @user + full 32-char hex of the auth user id
    final_username := '@user' || id_hex;
  ELSE
    final_username := '@' || base_username;
  END IF;

  -- Resolve collisions (chosen username taken, or rare race)
  WHILE EXISTS (
    SELECT 1 FROM public.profiles WHERE username = final_username
  ) AND attempt < 32
  LOOP
    attempt := attempt + 1;
    IF attempt = 1 THEN
      final_username :=
        '@' || COALESCE(NULLIF(base_username, ''), 'user')
        || '_' || id_hex;
    ELSE
      final_username :=
        '@' || COALESCE(NULLIF(base_username, ''), 'user')
        || '_' || substr(id_hex, 1, 8)
        || substr(md5(random()::text || clock_timestamp()::text || attempt::text), 1, 8);
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.profiles (
      id,
      phone,
      role,
      first_name,
      last_name,
      username,
      country,
      profile_completed,
      worker_status,
      verified
    )
    VALUES (
      NEW.id,
      final_phone,
      assigned_role,
      NEW.raw_user_meta_data->>'firstName',
      NEW.raw_user_meta_data->>'lastName',
      final_username,
      COALESCE(NEW.raw_user_meta_data->>'country', 'GH'),
      (assigned_role = 'customer'),
      CASE WHEN assigned_role = 'worker' THEN 'pending' ELSE 'active' END,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- Phone/username race: still create a profile so Auth signup succeeds
      INSERT INTO public.profiles (
        id,
        phone,
        role,
        first_name,
        last_name,
        username,
        country,
        profile_completed,
        worker_status,
        verified
      )
      VALUES (
        NEW.id,
        NULL,
        assigned_role,
        NEW.raw_user_meta_data->>'firstName',
        NEW.raw_user_meta_data->>'lastName',
        '@user' || id_hex || '_'
          || substr(md5(random()::text || clock_timestamp()::text), 1, 8),
        COALESCE(NEW.raw_user_meta_data->>'country', 'GH'),
        (assigned_role = 'customer'),
        CASE WHEN assigned_role = 'worker' THEN 'pending' ELSE 'active' END,
        false
      )
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
