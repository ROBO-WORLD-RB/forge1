# Forge Marketplace

Forge is a premium, localized service marketplace platform designed for skilled workers and customers in **Ghana (🇬🇭)** and **Nigeria (🇳🇬)**. It connects professionals like electricians, plumbers, and developers with people who need their services.

## 🚀 Key Features

- **Dual AI Integration**: Intelligent task assistance using **Google Gemini** (cloud) and **Ollama** (local).
- **Localized Payments**: Support for GHS and NGN currencies and localized service tiers.
- **Real-time Chat**: Direct messaging between workers and customers.
- **Worker Verification**: KYC system for worker trust and safety.
- **PWA Ready**: Installable as a mobile app with offline support.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS (Vanilla CSS & Tailwind Utility Classes).
- **Backend/Auth**: Supabase (PostgreSQL, Auth, Storage).
- **Routing**: React Router 7.
- **Monitoring**: Sentry Integration.
- **AI**: Google Generative AI (Gemini) & Local Ollama Proxy.

## ⚙️ Local Setup

1.  **Clone and Install**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env.local` file with the following keys:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_GEMINI_API_KEY=your_gemini_key
    ```

3.  **Supabase Database**:
    - Run the [supabase-schema.sql](file:///c:/Users/HP/Desktop/APPS/fg/supabase-schema.sql) in your Supabase SQL Editor.
    - Ensure **Email**, **Phone**, and **Google** auth providers are enabled.
    - Create public storage buckets: `avatars`, `job-media`, and `verification-documents`.

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## 🤖 AI Configuration

Forge uses a hybrid AI approach:
- **Primary**: Local Ollama instance (port 11434).
- **Fallback**: Google Gemini Pro.
- **Proxy**: The Vite dev server proxies `/ollama` to avoid CORS issues and handles connection failures gracefully.

## 🔐 Authentication Notes

- **Redirect URIs**: Ensure `http://localhost:3000/auth/callback` is added to your Supabase and Google Cloud Console redirect whitelists.
- **Profile Synchronization**: Profiles are automatically created via a database trigger (`on_auth_user_created`) and synchronized with application metadata.

## 📦 Build for Production

```bash
npm run build
```
The optimized assets will be in the `dist/` directory.
