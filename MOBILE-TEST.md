# Mobile testing (local dev)

## URL to open on your phone

**http://10.13.150.22:3000/**

Use the Wi‑Fi IPv4 address (`10.13.150.22`), not `localhost` or the Hyper-V address (`172.23.112.1`).

## QR code

- Open **`mobile-test-qr.html`** in your browser (double-click in Explorer) and scan the code on screen.
- Optional PNG: **`mobile-test-qr.png`** (if generated).

## Steps

1. Keep **`npm run dev`** running on this PC.
2. Connect your phone to the **same Wi‑Fi** network.
3. Scan the QR or type the URL above in mobile Safari/Chrome.
4. If it fails to connect, check **Windows Defender Firewall** → allow **Node.js** or **Vite** on **Private** networks.

## Dev server notes

- Port: **3000** (configured in `vite.config.ts`, not Vite default 5173).
- `server.host` is **`0.0.0.0`**, so LAN access works without extra `--host` flags.
- Current dev server was **already running** when this guide was created; restart with `npm run dev` if you stop it.

## IP changed?

Run `ipconfig` and use the **Wi‑Fi** adapter IPv4, then update this file and `mobile-test-qr.html`.

## Google sign-in on your phone

Supabase only allows OAuth redirects to URLs you explicitly whitelist. When testing from your phone at `http://10.13.150.22:3000`, you must add that exact callback URL in Supabase:

1. [Supabase Dashboard](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub) → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add (replace IP if yours changed):
   ```
   http://10.13.150.22:3000/auth/callback
   ```
3. Optionally set **Site URL** to `http://10.13.150.22:3000` while mobile-testing (switch back to `http://localhost:3000` for desktop dev).
4. Ensure **Providers** → **Google** is enabled with Client ID + Secret — see [START-HERE.md](./START-HERE.md) Step 2.

Without the LAN redirect URL, Google sign-in returns to your app but Supabase rejects the callback and you stay logged out.
