# HRMS Backend — Phase 1 & 2

NestJS + Prisma + PostgreSQL backend for the Enterprise HRMS SaaS Platform.

**Phase 1 — Foundation**
- ✅ Authentication (JWT access + refresh tokens, rotation & revocation)
- ✅ Authorization (RBAC — system roles + custom per-tenant roles + granular permissions)
- ✅ Multi-tenancy (Company = tenant root; every resource is scoped to a `companyId`)
- ✅ Company management (self-service profile + platform Super Admin controls)
- ✅ Branch, Department (nested), Team, Designation management
- ✅ Employee management (CRUD, lifecycle status, optional linked login account)

**Phase 2 — Core HR**
- ✅ Shift management (define shifts, working days, grace period; bulk-assign to employees)
- ✅ Holiday management (company-wide or per-branch, optional/restricted holidays)
- ✅ Attendance (self clock-in/out with geo + source tracking, HR manual entry/correction,
  filterable admin views)
- ✅ Leave management (leave types, per-employee/year balances, request → approve/reject/cancel
  workflow with automatic balance deduction and overlap detection)
- ✅ Employee Self-Service (`/me` — profile, dashboard combining today's attendance, leave
  balances, pending requests, and upcoming holidays)

Everything else in the spec (payroll, recruitment, performance, etc.) builds on top of this
foundation in later phases, reusing the same tenant + RBAC patterns.

## Stack

Node.js 24 · NestJS 10 · TypeScript · Prisma ORM · PostgreSQL 16 · Redis 7 · JWT · Swagger

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# edit .env if needed (defaults work with the docker-compose setup below)
```

### 3. Start Postgres + Redis

```bash
docker compose up -d postgres redis
```

### 4. Run migrations & seed

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

The seed script creates:
- The base **permission catalog** (module.action, e.g. `employee.create`)
- All 12 **system roles** (Super Admin, Company Owner, HR, HR Manager, Payroll Manager,
  Recruiter, Finance, Department Head, Team Lead, Employee, Auditor, Guest) with sensible
  default permission grants
- A demo company (`demo-company`) and a platform **Super Admin** user
  (credentials printed to the console, configurable via `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`)

### 5. Run the API

```bash
npm run start:dev
```

- API base URL: `http://localhost:3001/api/v1`
- Swagger docs: `http://localhost:3001/docs`

### Or run everything in Docker

```bash
docker compose up --build
```

## Multi-Tenancy Model

`Company` is the tenant root. Every tenant-scoped table (`Branch`, `Department`, `Team`,
`Designation`, `Employee`, `User`, `Role`, `AuditLog`) carries a `companyId` foreign key.

- Tenant users log in with `email + password + companySlug` (email is unique **per company**,
  not globally — two different companies can each have a `hr@company.com` user).
- The platform **Super Admin** has `companyId = null` and logs in without a `companySlug`.
- Every authenticated request carries the caller's `companyId` inside the JWT; the
  `@TenantId()` param decorator extracts it, and every service method filters by it —
  so tenants can never see or modify each other's data.

## RBAC Model

- **Permissions** are fine-grained strings like `employee.create`, `payroll.approve`,
  following a `module.action` convention.
- **Roles** bundle permissions. There are two kinds:
  - *System roles* (`companyId = null`, `isSystem = true`) — the 12 roles from the spec,
    shared as read-only templates across all tenants.
  - *Custom roles* (`companyId = <tenant>`) — created by a Company Owner / HR Manager via
    `POST /roles`, letting each tenant build its own role beyond the defaults.
- **Users** get roles via `UserRole` (many-to-many), so a user can hold multiple roles;
  effective permissions are the union of all assigned roles' permissions.
- Route protection uses two guards:
  - `@Roles(SystemRole.HR_MANAGER)` + `RolesGuard` — coarse, role-slug based (used for
    platform-admin-only routes like suspending a tenant).
  - `@Permissions('employee.create')` + `PermissionsGuard` — fine-grained, used on almost
    all tenant CRUD routes. This is the recommended pattern going forward.
- `SUPER_ADMIN` implicitly passes every guard.

## Auth Flow

```
POST /auth/register   { companyName, companySlug, firstName, lastName, email, password }
                       -> creates Company + Owner User + Employee record, returns tokens

POST /auth/login       { email, password, companySlug? }
                       -> returns { accessToken, refreshToken, expiresIn }

POST /auth/refresh     { refreshToken }
                       -> rotates refresh token, returns a new pair

POST /auth/logout      { refreshToken }   (requires Bearer access token)
POST /auth/logout-all                     (requires Bearer access token)
```

Access tokens are short-lived (15m default); refresh tokens are long-lived (7d default),
hashed at rest, single-use (rotated on every refresh), and revocable.

## Attendance & Leave Flow

```
POST /attendance/clock-in    { source?, lat?, lng?, notes? }     (self)
POST /attendance/clock-out   { lat?, lng?, notes? }               (self)
GET  /attendance/me/today                                          (self)
GET  /attendance/me/history                                        (self)
GET  /attendance?employeeId=&departmentId=&from=&to=               (HR, attendance.approve)
POST /attendance              (HR manual entry / backfill)
PATCH /attendance/:id         (HR correction)

POST /leave/requests          { leaveTypeId, startDate, endDate, reason? }   (self)
GET  /leave/requests/me                                                       (self)
POST /leave/requests/:id/cancel                                               (self)
GET  /leave/balances/me?year=2026                                             (self)
GET  /leave/requests?status=PENDING                              (HR, leave.approve)
POST /leave/requests/:id/approve                                  (HR — deducts balance)
POST /leave/requests/:id/reject   { rejectionReason }              (HR)
POST /leave/balances          { employeeId, leaveTypeId, year, allocated }   (HR, allocate/adjust)

GET  /me/profile   |   PATCH /me/profile   |   GET /me/dashboard
```

Leave requests check for date-overlap against the employee's own existing requests and,
for paid leave types, validate sufficient balance (`allocated + carriedForward - used`)
before allowing submission. Approving a request atomically increments `used` on the
corresponding `LeaveBalance` row (creating one if it doesn't exist yet).

## Project Structure

```
src/
├── auth/            # JWT strategy, login/register/refresh/logout
├── companies/        # Tenant self-service + Super Admin tenant management
├── branches/          # Branch CRUD (tenant-scoped)
├── departments/       # Department CRUD, nested hierarchy (tenant-scoped)
├── employees/         # Employee CRUD, lifecycle status, linked login accounts
├── roles/             # RBAC: permissions catalog, custom roles, role assignment
├── shifts/            # Shift definitions + bulk assignment to employees
├── holidays/          # Company-wide / per-branch holiday calendar
├── attendance/        # Self clock-in/out + HR attendance management
├── leave/             # Leave types, balances, request/approval workflow
├── ess/               # Employee Self-Service: /me profile + dashboard
├── common/
│   ├── decorators/    # @Public, @Roles, @Permissions, @CurrentUser, @TenantId
│   ├── guards/        # JwtAuthGuard (global), RolesGuard, PermissionsGuard
│   ├── filters/        # Global HTTP exception filter (incl. Prisma error mapping)
│   ├── interceptors/  # Response envelope transformer
│   └── dto/           # Shared pagination DTO
├── prisma/            # PrismaService/PrismaModule (global)
├── config/            # Typed configuration loader
├── health/            # Public health check endpoint
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma       # Full Phase 1 + Phase 2 data model
└── seed.ts             # Permissions + system roles + demo company + super admin
```

## Next Steps (Phase 3+)

This foundation is designed so later phases plug in cleanly:
- **Payroll** — salary structures, payroll engine, payslips, loans, reimbursements.
- **Talent Management** — recruitment/ATS, onboarding, performance, training, offboarding.
- **Enterprise & SaaS** — reports/analytics, integrations, billing (Stripe), white-label,
  API keys, full audit trail (the `AuditLog` model is already in place to extend).
- **Advanced** — mobile apps, biometric sync, AI assistant, workflow builder.

Each new module should: add its Prisma models with a `companyId` column, register new
`module.action` permission codes in `prisma/seed.ts`, and reuse the existing guards/decorators.
