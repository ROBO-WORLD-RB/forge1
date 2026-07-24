# Profiles RLS — incident notes

## What happened

A user ran this in the browser console against production:

```js
fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
})
  .then((r) => r.json())
  .then(console.log);
```

They received **every** profile row. That was possible because migration `006_profile_public_read_rls.sql` created:

```sql
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (true);
```

## What is *not* a bug

- The **anon / publishable** key (`sb_publishable_…` or `eyJ…`) appears in the frontend by design. Supabase apps are secured with **Row Level Security**, not by hiding that key.
- **Passwords are not in `public.profiles`.** They live in `auth.users` and are not readable via the REST API with the anon key. Claims about “checking passwords” from this dump are incorrect.

## Fix

Run **`supabase/migrations/021_lock_down_profiles_rls.sql`** in the Supabase SQL Editor **immediately**.

After apply, the same console `select=*` dump must **not** return customers or the full user table — only active workers (and, when signed in, your own row / booking / chat counterparts).

## Verify

1. Signed out → browser console → same `fetch` → should not list all customers.
2. Signed in as a normal user → can load own dashboard / profile.
3. Worker search and public worker profile pages still work.
4. Attempt `DELETE` / `UPDATE` on another user’s profile with only the anon key → must fail.
