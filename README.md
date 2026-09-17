# NEXUS WAYS — Phase 1 Foundation

Next-generation multimodal supply chain & logistics platform. Phase 1 provides the shared monorepo scaffold, Supabase schema with Row Level Security (RLS), authentication engine (email/password & Google OAuth with session exchange and httpOnly cookie management), bare React app shell, design tokens, complete India states/districts dataset, and CI pipeline.

---

## 1. Monorepo Structure

```
nexus-ways/
├── apps/
│   ├── web/                # React + TypeScript + Vite + Tailwind CSS
│   └── api/                # Node.js + TypeScript + NestJS
├── packages/
│   └── shared/             # Shared TypeScript types, theme tokens, India locations dataset
├── supabase/
│   └── migrations/         # Numbered SQL migration files
├── .github/
│   └── workflows/
│       └── ci.yml          # Continuous Integration workflow (Lint, Build, Test)
├── package.json            # Root workspace configuration
├── .env.example            # Monorepo environment blueprint
└── README.md
```

---

## 2. Prerequisites & Supabase Setup

1. **Supabase Project**:
   - Create a project on [supabase.com](https://supabase.com).
   - In Supabase **Authentication -> Providers**:
     - Enable **Email**
     - Enable **Google** (Configure Google OAuth Client ID & Secret from Google Cloud Console).
   - Note down:
     - Project URL (`SUPABASE_URL` / `VITE_SUPABASE_URL`)
     - Anon public key (`VITE_SUPABASE_ANON_KEY`)
     - Service role secret key (`SUPABASE_SERVICE_ROLE_KEY`)
     - JWT Secret (`SUPABASE_JWT_SECRET` from Project Settings -> API)

2. **Supabase CLI**:
   - Install CLI: `npm install -g supabase`
   - Login: `supabase login`
   - Link project: `supabase link --project-ref <your-project-ref>`

---

## 3. Database Schema & Migration Execution

Apply migrations using the Supabase CLI:

```bash
supabase db push
```

Migration file located at [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) creates:
- `user_role` enum: `'manager' | 'operator' | 'driver' | 'crew'`
- `organizations` table with full address & India location metadata
- `users` table linked to `auth.users` with cascading foreign keys
- Row Level Security (RLS) policies for tenant isolation:
  - `org_select_own`: Users can only read their organization's row
  - `users_select_same_org`: Users can read co-members in their organization
  - `users_update_self`: Users can update only their own profile

---

## 4. Environment Variables Configuration

Copy environment templates:

```bash
# Backend environment
cp apps/api/.env.example apps/api/.env

# Frontend environment
cp apps/web/.env.example apps/web/.env
```

### Backend (`apps/api/.env`)
```env
PORT=4000
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_JWT_SECRET=<your-supabase-jwt-secret>
COOKIE_DOMAIN=localhost
FRONTEND_ORIGIN=http://localhost:5173
```

### Frontend (`apps/web/.env`)
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_BASE_URL=http://localhost:4000
```

---

## 5. Development, Testing & Building

### Install Dependencies
```bash
npm install
```

### Run Locally (Runs both Web & API concurrently)
```bash
npm run dev
```
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

### Run Tests
```bash
npm run test
```

### Run Typecheck & Lint
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```

---

## 6. Authentication Architecture

1. **Sign-up / Onboarding Flow**:
   - User enters credentials, organization name, and selects location via cascading India dropdowns (Country: India -> State -> District -> Address).
   - Frontend calls `POST /auth/register` on NestJS API.
   - NestJS API creates Supabase auth user, inserts `organizations` record, inserts `public.users` record with role `manager`, sets httpOnly session cookies (`nw_access`, `nw_refresh`), and returns authenticated user profile.
   - If any step fails, created records are immediately rolled back.

2. **Sign-in Flow (Email/Password or Google OAuth)**:
   - Frontend authenticates with Supabase directly (`signInWithPassword` or `signInWithOAuth`).
   - Obtains access & refresh tokens.
   - Calls `POST /auth/session` on NestJS API.
   - NestJS verifies JWT signature using `SUPABASE_JWT_SECRET`, provisions public user/org if first OAuth sign-in, and sets secure httpOnly cookies.

3. **Session Guards & Roles**:
   - `JwtAuthGuard` checks `nw_access` cookie or Authorization Bearer header.
   - `RolesGuard` enforces role-based authorization based on `@Roles('manager', ...)` decorator.
   - Frontend `<ProtectedRoute>` automatically protects internal routes and redirects unauthenticated visits to `/roadways/login`.
