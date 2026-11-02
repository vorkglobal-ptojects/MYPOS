# Rupasinghe Pawning Hub & Microfinance Enterprise Monorepo

Production-grade, full-stack Monorepo architecture designed for high-concurrency Sri Lankan pawn brokering, lending operations, dual-branch vault balancing, and automated double-entry general ledger accounting.

---

## 1. System Architecture & Monorepo Topology

```
d:\Auramstudio\Myfosrecretion/
├── backend/                  # Dedicated Node.js (Express + TypeScript) API Server
│   ├── prisma/
│   │   └── schema.prisma     # 32+ Enterprise models mapped with strict Decimal(19, 4)
│   ├── src/
│   │   ├── config/           # Prisma client singleton, Supabase admin client, Zod env validation
│   │   ├── middleware/       # Auth/RBAC verification (Admin, Manager, Teller, Auditor), error handler
│   │   ├── modules/          # Domain services: auth, clients, loans, pawning, cash-management, accounting, audit
│   │   ├── routes/           # REST API v1 routes (/api/v1/...)
│   │   └── utils/            # Decimal.js financial math helpers & canonical branch mapping
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Next.js 16 Client UI Layer (Connected strictly via REST API)
│   ├── src/
│   │   ├── app/              # Dashboard, loans, clients, finance, cash drawers, reports, accounting
│   │   ├── components/       # Radix/Tailwind design system & enterprise UI widgets
│   │   ├── lib/              # Typed REST API Client (api-client.ts), auth headers, date helpers
│   │   └── types/            # Enterprise pawn and accounting domain types
│   ├── Dockerfile
│   ├── components.json       # Shadcn UI configuration
│   ├── eslint.config.mjs
│   ├── next.config.ts        # Turbopack root & /api/v1 reverse proxy rewrites
│   └── package.json
├── services/
│   ├── cctv-agent/           # Automated branch surveillance evidence capture daemon
│   └── printer-service/      # Web Bluetooth ESC/POS + TSPL thermal receipt & barcode printer
├── docs/                     # Technical specifications, audit reports, database dumps, bill templates
│   ├── Camera Setup/
│   ├── database/
│   ├── LOGO/
│   └── CASH_MANAGEMENT_TECHNICAL_AUDIT.md
├── docker-compose.yml        # Full-stack container orchestration (backend, frontend, postgres, pgadmin)
└── package.json              # Monorepo root workspace runner
```

---

## 2. Core Architectural Principles & Financial Invariants

1. **Strict Financial Precision (Zero Floats)**:
   - Floating-point arithmetic is banned for financial balances.
   - All monetary fields (`loan principal`, `interest amounts`, `daily cash drawer balances`, `vault totals`, `pawn valuations`) and gold weights are strictly stored as `@db.Decimal(19, 4)`.
   - In-memory calculations use `Decimal.js` to eliminate rounding errors.

2. **ACID Transactions & Negative Balance Prevention**:
   - Every financial mutation (Loan Disbursement, Redemption, Cash-In, Cash-Out, Vault Transfer, Branch Expense) executes within `prisma.$transaction(async (tx) => { ... })`.
   - Real-time balance validation prevents teller and vault cash drawers from dropping below zero.

3. **Double-Entry General Ledger Balance Invariant**:
   - All accounting entries enforce balanced double-entry accounting:
     $$\sum \text{Debit} = \sum \text{Credit}$$
   - Any unbalanced posting attempt throws a validation error and aborts the database transaction.

4. **Multi-Tenant Branch Isolation & RBAC**:
   - Four distinct security roles: `ADMIN`, `MANAGER`, `AUDITOR`, `TELLER`.
   - Loans $\ge \text{Rs. } 100,000$ enter `PENDING_APPROVAL` status requiring dual-authorization before funds disbursement.
   - Tellers are strictly scoped to their assigned active branch (`x-branch-id`), preventing cross-branch cash leakage.

---

## 3. Environment Variables Configuration

### Backend (`/backend/.env`)
```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Supabase PostgreSQL Database Connections
DATABASE_URL=postgresql://postgres.ielkaetihagxgnrrasch:[PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=15
DIRECT_URL=postgresql://postgres.ielkaetihagxgnrrasch:[PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?connect_timeout=15

# Supabase Auth & JWT
SUPABASE_URL=https://ielkaetihagxgnrrasch.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
SUPABASE_ANON_KEY=[ANON_KEY]
JWT_SECRET=[SECURE_SECRET]
```

### Frontend (`/frontend/.env`)
```env
# Backend REST API Server URL (No direct client DB access)
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Supabase Public Keys (Auth helpers only)
NEXT_PUBLIC_SUPABASE_URL=https://ielkaetihagxgnrrasch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
```

---

## 4. Getting Started & Development

### Monorepo Workspaces Installation
From the project root:
```bash
npm install
```

### Running the Services Concurrently
```bash
# Start both Backend and Frontend in development mode
npm run dev:all

# Or start individually:
npm run dev:backend    # Backend on http://localhost:4000
npm run dev:frontend   # Frontend on http://localhost:3000
```

### Building for Production
```bash
# Compiles both TypeScript backend and Next.js frontend
npm run build
```

---

## 5. Docker Deployment

Deploy the entire production ecosystem via Docker Compose:
```bash
# Build and run backend + frontend containers
docker compose up -d --build

# View container logs
docker compose logs -f
```

---

## 6. API Reference (v1)

| Route | Method | Description | Access |
|---|---|---|---|
| `/api/v1/health` | GET | Health check & Supabase connection test | Public |
| `/api/v1/branches` | GET | Master branch directory | Public |
| `/api/v1/auth/login` | POST | Authenticate user, verify branch & issue JWT | Public |
| `/api/v1/dashboard/metrics` | GET | Real-time portfolio totals, active tickets & recent activity | Authenticated |
| `/api/v1/reports/summary` | GET | Comprehensive active portfolio, aging buckets & transaction breakdown | Authenticated |
| `/api/v1/loans` | GET / POST | Search & create pawn loan tickets | Teller / Manager / Admin |
| `/api/v1/loans/:id/disburse` | POST | Disburse approved loan & deduct cash drawer | Teller / Manager / Admin |
| `/api/v1/loans/:id/redeem` | POST | Settle loan principal + interest & deposit drawer cash | Teller / Manager / Admin |
| `/api/v1/cash/drawer/:branchId` | GET | Query real-time branch cash drawer balance | Authenticated |
| `/api/v1/cash/in` | POST | Record branch cash-in injection with GL posting | Manager / Admin |
| `/api/v1/cash/out` | POST | Safe cash-out deduction (prevents negative drawer) | Manager / Admin |
| `/api/v1/accounting/journal-entries` | POST | Post balanced double-entry GL journal entry | Auditor / Admin |
| `/api/v1/accounting/trial-balance` | GET | Generate balanced Trial Balance statement | Auditor / Admin |
| `/api/v1/transactions` | GET / POST | Operational financial transactions audit log | Authenticated |

