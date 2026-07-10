\*\*Implementation Plan: Forge Marketplace Enhancements\*\*

\---

\#\#\# \*\*Project Overview\*\*  
\*\*Forge\*\* is expanding to support a wider range of skilled professionals (electricians, plumbers, caterers, decorators, painters, event planners, fashion designers, etc.) while introducing manual authentication, role-based interfaces, a worker onboarding payment gateway, and a polished UI/UX.

\---

\#\#\# \*\*1. New Features Scope\*\*

\#\#\#\# \*\*1.1 Expanded Service Categories\*\*  
\- \*\*Dynamic Categories\*\*: Move from hardcoded categories to a database-driven list.  
\- New categories include: Catering, Event Decor, Painting, Event Planning, Fashion Design, Photography, Makeup Artistry, etc.  
\- Workers can select multiple categories/specialties during onboarding.

\#\#\#\# \*\*1.2 Manual Authentication (Email/Phone)\*\*  
\- \*\*Signup Flow\*\*:  
  \- Role selection: \`Customer\` or \`Worker\`  
  \- Fields: \`first\_name\`, \`last\_name\`, \`email\`, \`phone\`, \`country\`, \`password\`  
  \- Strong password validation (≥8 chars, uppercase, lowercase, number, symbol)  
\- \*\*Signin\*\*: Email \+ Password or Phone \+ Password (with OTP fallback)  
\- \*\*Hybrid Auth\*\*: Google OAuth remains \+ new manual auth via Supabase.

\#\#\#\# \*\*1.3 Role-Based Interfaces\*\*  
\- \*\*Customer Dashboard\*\* (\`/dashboard/customer\`)  
\- \*\*Worker Dashboard\*\* (\`/dashboard/worker\`)  
\- Route protection based on \`user\_role\` (stored in Supabase \`profiles\` table).

\#\#\#\# \*\*1.4 Worker Payment Gateways (₵10 Onboarding Fee)\*\*  
\- One-time 10 GHS fee before full worker dashboard access.  
\- Payment via \*\*Paystack\*\* (recommended for Ghana/Nigeria) or Flutterwave.  
\- Status: \`worker\_status\` → \`pending\_payment\` → \`active\`

\#\#\#\# \*\*1.5 UI/UX Enhancement\*\*  
\- \*\*Color Palette\*\*: Enhanced via Coolors (maintain existing brand colors).  
\- \*\*Typography\*\*:   
  \- Headings: \*\*Inter SemiBold\*\*  
  \- Buttons/Navigation: \*\*Inter Medium\*\*  
  \- Body: \*\*Inter Regular\*\*  
\- Modern, mobile-first design with Tailwind \+ custom CSS.

\---

\#\#\# \*\*2. Database Schema Updates (Supabase)\*\*

Update \`supabase-schema.sql\`:

\`\`\`sql  
\-- Profiles table enhancement  
CREATE TABLE profiles (  
  id UUID PRIMARY KEY REFERENCES auth.users,  
  first\_name TEXT,  
  last\_name TEXT,  
  phone TEXT UNIQUE,  
  country TEXT DEFAULT 'GH',  
  role TEXT CHECK (role IN ('customer', 'worker')),  
  worker\_status TEXT DEFAULT 'pending' CHECK (worker\_status IN ('pending', 'pending\_payment', 'active', 'suspended')),  
  specialties TEXT\[\],           \-- e.g., ARRAY\['Catering', 'Decor'\]  
  avatar\_url TEXT,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Service Categories  
CREATE TABLE service\_categories (  
  id SERIAL PRIMARY KEY,  
  name TEXT UNIQUE NOT NULL,  
  slug TEXT UNIQUE NOT NULL,  
  icon TEXT,  
  is\_active BOOLEAN DEFAULT true  
);

\-- Payments  
CREATE TABLE worker\_payments (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES profiles(id),  
  amount NUMERIC(10,2) NOT NULL,  
  currency TEXT DEFAULT 'GHS',  
  payment\_reference TEXT UNIQUE,  
  status TEXT DEFAULT 'pending',  
  paid\_at TIMESTAMPTZ,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);  
\`\`\`

\*\*Triggers\*\*:  
\- \`on\_auth\_user\_created\` → create profile with role.  
\- Function to check \`worker\_status\` on dashboard access.

\---

\#\#\# \*\*3. Authentication Implementation\*\*

\#\#\#\# \*\*Frontend (React 19 \+ React Router 7)\*\*  
\- Create \`src/auth/\` folder:  
  \- \`AuthProvider.tsx\`  
  \- \`SignupForm.tsx\`  
  \- \`LoginForm.tsx\`  
  \- \`RoleSelector.tsx\`  
  \- \`PasswordStrengthMeter.tsx\`

\*\*Password Validation\*\* (using \`zod\`):  
\`\`\`ts  
const passwordSchema \= z.string()  
  .min(8)  
  .regex(/\[A-Z\]/, "Uppercase required")  
  .regex(/\[a-z\]/, "Lowercase required")  
  .regex(/\[0-9\]/, "Number required")  
  .regex(/\[^A-Za-z0-9\]/, "Symbol required");  
\`\`\`

\*\*Supabase Auth\*\*:  
\- Use \`supabase.auth.signUp()\` with metadata for role.  
\- Custom \`signUpWithEmail\` function handling profile creation.

\#\#\#\# \*\*Protected Routes\*\*  
\`\`\`tsx  
// src/components/ProtectedRoute.tsx  
const WorkerRoute \= () \=\> {  
  const { user } \= useAuth();  
  if (user?.role \!== 'worker' || user?.worker\_status \!== 'active') {  
    return \<Navigate to="/worker/onboard" /\>;  
  }  
  return \<Outlet /\>;  
};  
\`\`\`

\---

\#\#\# \*\*4. Payment Integration (₵10)\*\*

\*\*Recommended\*\*: \*\*Paystack\*\*

1\. Install: \`npm install @paystack/inline-js\`  
2\. Create \`WorkerOnboardingPayment.tsx\`  
3\. After successful payment → update \`profiles.worker\_status \= 'active'\` via Supabase RLS-protected function.  
4\. Store transaction in \`worker\_payments\` table.

\*\*Flow\*\*:  
\- Signup as Worker → Profile created (\`pending\_payment\`) → Redirect to \`/worker/onboard/payment\`  
\- Pay ₵10 → Webhook verifies → Update status → Redirect to Worker Dashboard

\*\*Environment Variables\*\*:  
\`\`\`env  
VITE\_PAYSTACK\_PUBLIC\_KEY=pk\_...  
SUPABASE\_SERVICE\_ROLE\_KEY=...   \# for webhook verification (Edge Function)  
\`\`\`

\---

\#\#\# \*\*5. UI/UX Implementation Plan\*\*

\#\#\#\# \*\*Design System\*\*  
\- \*\*Colors\*\* (Coolors recommended palette):  
  \- Primary: \`\#00A651\` (Green \- Ghanaian vibe)  
  \- Secondary: \`\#FF7A00\` (Orange accent)  
  \- Neutral: \`\#1A1A1A\`, \`\#F8F9FA\`, \`\#6B7280\`  
  \- Success: \`\#00A651\`, Danger: \`\#EF4444\`

\- \*\*Tailwind Config\*\* (\`tailwind.config.js\`):  
\`\`\`js  
theme: {  
  extend: {  
    fontFamily: {  
      heading: \['Inter', 'sans-serif'\],  
      body: \['Inter', 'sans-serif'\],  
    },  
    colors: { ... }  
  }  
}  
\`\`\`

\- \*\*Components\*\*:  
  \- Reusable: \`Button\`, \`Input\`, \`Card\`, \`DashboardLayout\`  
  \- Worker Dashboard: Job listings, earnings, profile completion meter  
  \- Customer Dashboard: Browse workers, post jobs, booking history

\*\*Fonts\*\*:  
\`\`\`html  
\<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600\&display=swap" rel="stylesheet"\>  
\`\`\`

\---

\#\#\# \*\*6. Routing Structure (React Router 7)\*\*

\`\`\`  
/ (Landing)  
/auth/signup  
/auth/login  
/dashboard/customer  
/dashboard/worker  
/worker/onboard          → Profile completion \+ specialties  
/worker/onboard/payment  → ₵10 payment  
/jobs/post  
/jobs/:id  
/workers/:id  
\`\`\`

\---

\#\#\# \*\*7. Step-by-Step Implementation Order\*\*

1\. \*\*Database & Schema\*\* (1 day)  
   \- Update tables, RLS policies, triggers

2\. \*\*Authentication\*\* (2-3 days)  
   \- Manual signup/signin with validation  
   \- Role selection & profile sync

3\. \*\*Payment Integration\*\* (2 days)  
   \- Paystack setup \+ webhook

4\. \*\*Role-Based Dashboards\*\* (3-4 days)  
   \- Separate layouts and protected routes

5\. \*\*Service Categories\*\* (1 day)  
   \- Dynamic categories \+ multi-select

6\. \*\*UI/UX Polish\*\* (3 days)  
   \- Typography, color system, responsive components

7\. \*\*Testing & Edge Cases\*\* (2 days)  
   \- Password strength, payment failures, role access

\---

\#\#\# \*\*8. Recommended Packages\*\*

\`\`\`bash  
npm install zod react-hook-form @hookform/resolvers   
npm install @paystack/inline-js lucide-react  
npm install framer-motion   \# for smooth transitions  
\`\`\`

\---

\#\#\# \*\*9. Security Considerations\*\*

\- RLS (Row Level Security) on all tables  
\- Rate limiting on auth endpoints  
\- Phone number verification (optional via Supabase)  
\- Sanitize inputs  
\- Secure payment webhook verification using Supabase Edge Functions

\---

\#\#\# \*\*10. Future Enhancements\*\*

\- Wallet system for workers  
\- Booking & scheduling calendar  
\- Reviews & ratings  
\- AI-powered matching (Gemini)  
\- Admin dashboard

\---

\*\*Next Steps\*\*:  
1\. Update Supabase schema first.  
2\. Implement auth module.  
3\. Set up Paystack test account.

