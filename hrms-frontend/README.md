# HRMS Frontend — Phase 1 & 2

Next.js 15 (App Router) + TypeScript + TailwindCSS frontend for the HRMS backend
(`../hrms-backend`). Implements the end-to-end flows for everything built so far:

- **Auth** — company signup (`/register`), sign in (`/login`), token refresh handled
  transparently by the API client, sign out.
- **Dashboard** (`/dashboard`) — the Employee Self-Service view: profile, today's
  attendance, leave balances, pending requests, upcoming holidays.
- **Employees** (`/employees`) — searchable, paginated list + a quick-add form.
- **Attendance** (`/attendance`) — clock in / clock out, recent history table.
- **Leave** (`/leave`) — leave balances, submit a request, view/cancel my requests,
  plus an **Approvals** panel (visible only to users whose role grants `leave.approve` —
  HR, HR Manager, Department Head, Team Lead) to approve or reject pending requests
  from others. The panel is shown/hidden by probing the endpoint rather than
  decoding permissions client-side, since the backend is the source of truth.

## Design

A small custom design system rather than a generic template: a cool neutral
"paper" background, a single deep-teal accent, a restrained serif (Fraunces) for
headings paired with Inter for UI text, and a "ledger tab" signature mark (a
small colored bar) on page/section titles plus monospace "record codes" for
employee IDs — nodding to the personnel-file metaphor without over-decorating a
data-dense admin tool. See `tailwind.config.ts` and `app/globals.css`.

## Getting Started

### 1. Make sure the backend is running

See `../hrms-backend/README.md`. By default it listens on `http://localhost:3001`
with API prefix `/api/v1`, and its `CORS_ORIGIN` defaults to `http://localhost:3000`
— exactly where this app runs in dev, so no CORS config changes are needed locally.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
# defaults already point at the local backend — edit if yours runs elsewhere
```

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`. You'll be redirected to `/login`.

- To try the seeded **Super Admin**, leave "Company workspace" blank and use the
  credentials printed by the backend's `npm run prisma:seed`.
- To try a **tenant flow** end-to-end, go to `/register` and create a new company —
  this creates the Company + an Owner user + an Employee record in one step, so
  you land straight on a working dashboard.

## How auth works here

- `lib/auth.ts` stores the access/refresh token pair in `localStorage` (a real
  production build would likely move the refresh token to an httpOnly cookie set
  by a Next.js route handler instead — noted as a follow-up, not done here to
  keep the client/server split simple for this scaffold).
- `lib/api-client.ts` is an Axios instance that attaches the access token to every
  request and, on a `401`, automatically calls `/auth/refresh` once, replays the
  original request, and queues any other requests that failed at the same time —
  so a token expiring mid-session doesn't interrupt the user.
- `app/(app)/layout.tsx` is a client-side auth guard: it redirects to `/login` if
  there's no access token before rendering any protected page.

## Project Structure

```
app/
├── page.tsx              # redirects to /login or /dashboard
├── login/page.tsx
├── register/page.tsx
└── (app)/                 # protected route group — sidebar + topbar shell
    ├── layout.tsx          # auth guard
    ├── dashboard/page.tsx
    ├── employees/page.tsx
    ├── attendance/page.tsx
    └── leave/page.tsx
components/
├── sidebar.tsx / topbar.tsx
├── providers.tsx           # TanStack Query client
└── ui/                     # Button, Input, Card, Badge — the local design system
lib/
├── api-client.ts           # Axios instance, token refresh interceptor
├── auth.ts                 # token storage helpers
└── types.ts                # TS types mirroring backend DTOs
```

## Next Steps

- Wire up `/roles` (RBAC admin UI) and `/companies` (Super Admin tenant management)
  once those flows need a UI beyond Swagger.
- Add a Payroll section once Phase 3 lands on the backend.
- Move refresh-token storage to an httpOnly cookie via a Next.js route handler for
  production hardening.
