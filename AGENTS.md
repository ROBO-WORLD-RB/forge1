# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Forge is a **Vite + React 19 SPA** (repo root) backed by **Supabase** (Postgres, Auth,
Storage, Realtime, Edge Functions). There is no custom HTTP backend server — the browser
talks directly to Supabase. `marketing/` is a separate, optional Remotion video project and
is not needed to run or test the marketplace.

Standard commands live in `package.json` (`dev`, `build`, `preview`, `test`, `test:watch`,
`test:coverage`). The dev server runs on port **3000** (host `0.0.0.0`); see `vite.config.ts`.

### Running the app end-to-end (frontend + local Supabase backend)
The environment ships with Docker and the Supabase CLI already installed. To bring up a
fully working local stack:

1. Start the Docker daemon (if not already running):
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`.
   The daemon uses `fuse-overlayfs` with `containerd-snapshotter` disabled
   (`/etc/docker/daemon.json`) — required for Docker-in-Docker here.
2. `supabase start` — boots Postgres/Auth/Storage/etc. Get URLs/keys with `supabase status`.
3. Apply the database schema: `bash scripts/dev-db-setup.sh`.
4. Ensure `.env.local` exists (gitignored) pointing at local Supabase:
   `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=<anon key from
   `supabase status`>`.
5. `npm run dev` → open http://localhost:3000.

### Non-obvious gotchas
- **Do NOT run `supabase db reset` / rely on `supabase start` auto-applying migrations.**
  The base schema lives in `supabase-schema.sql` (repo root, NOT in `supabase/migrations/`),
  and the `migrations/` folder is ordered for manual Supabase Dashboard use — it also
  contains **destructive** relaunch scripts (`011_*`, `020_*wipe_all_users*`) and an
  out-of-order `add_worker_location.sql`. Use `scripts/dev-db-setup.sh`, which applies the
  base schema + migrations in the correct order (per `START-HERE.md`) and skips the wipe
  scripts. To rebuild the DB from scratch: `supabase db reset --no-seed` is still unsafe;
  instead `supabase stop --no-backup && supabase start` then re-run the bootstrap script.
- **Signup works with no email step.** Local Supabase has "Confirm email" OFF by default, so
  signup returns a session immediately and the app redirects to the dashboard. (Against a
  hosted project you must turn Confirm email OFF for the same behavior — see `START-HERE.md`.)
- `service_categories` (and some other tables) deny anonymous `SELECT` via RLS/grants, so
  unauthenticated REST reads return `42501 permission denied`; this is expected — data is
  read as an authenticated user.
- `npm test` currently has **9 pre-existing failures** (in `jobService.property.test.ts`,
  `ollamaService.property.test.ts`, `paymentWebhookService.property.test.ts`, and
  `tests/systemIntegration.test.ts`) out of 255 tests. These are test-logic/mock issues in
  the repo (e.g. a `vi.mock("./supabase")` missing `isSupabaseConfigured`), not environment
  problems. There is no lint script.
- Optional integrations (Paystack, OpenRouter/Gemini/Ollama AI, Sentry, Edge Functions) are
  unset by default; the app degrades gracefully. Edge Functions require `deno`/`supabase
  functions serve` and are not needed for core signup/browse flows.
