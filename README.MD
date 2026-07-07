# MER — Monthly Expense Report System

Enterprise-grade MERN expense management application with analytics, reporting, JWT auth, and role-based access.

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React (Vite), Redux Toolkit, React Router, Mantine, Recharts, TanStack Table patterns, React Hook Form, xlsx |
| Backend | Node.js, Express 5, MongoDB, Mongoose, JWT, Multer, ExcelJS, PDFKit |
| Tooling | pnpm workspaces, ESLint, Prettier, Docker |

## Project structure

```
Mer-App/
├── client/          # React frontend
├── server/          # Express API
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json     # Root scripts
```

## Quick start (local)

### Prerequisites

- Node.js 20+
- pnpm 9+
- MongoDB 7+ (local or Docker)

### 1. Install dependencies

```bash
cd Mer-App
pnpm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your MongoDB URI and JWT secrets.

### 3. Seed company master data (optional)

Companies and branches are upserted automatically on every startup. To re-sync them manually:

```bash
pnpm --filter server seed:companies
```

**Default accounts** (created automatically on first startup with an empty database):

| Role | Email | Password |
|------|-------|----------|
| Superadmin | superadmin@mer.com | super123 |
| Admin | admin@mer.com | admin123 |
| User (regular) | user@mer.com | user123 |

### MER approval workflow

| Role | Permissions |
|------|-------------|
| **Regular (user)** | Create MER entries (start as **Pending**), edit/delete own pending entries |
| **Admin** | Approve: Pending → **Approved** |
| **Superadmin** | Complete: Approved → **Completed** (included in reports & dashboard KPIs) |

Payment status (Paid/Pending/Cancelled) is separate from approval status.

### 4. Run development

```bash
# Terminal 1 — API (port 5002)
pnpm dev:server

# Terminal 2 — UI (port 5174)
pnpm dev:client
```

Or both in parallel:

```bash
pnpm dev
```

Open **http://localhost:5174**

## Docker

```bash
docker compose up -d mongodb
pnpm --filter server seed:companies   # optional: sync company master data
docker compose up --build
```

- API: http://localhost:5002/api/v1/health
- UI: http://localhost (nginx)

## API overview

Base URL: `/api/v1`

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /me` |
| Expenses | CRUD `/expenses`, filters, pagination, invoice upload |
| Dashboard | `GET /dashboard` — KPIs + charts data |
| Reports | Summary, head/monthly; Excel download on summary (`GET /reports/export/excel`) |
| Analytics | Trends, vendors, quarterly, FY comparison |
| Masters | Lookups, vendors, companies, locations, expense heads, users |

## Features

- **Authentication:** JWT + refresh tokens, forgot/reset password, session persistence
- **Dashboard:** 8 KPI cards, expense trends, capital/revenue, bank/cash, heads, quarterly & FY charts
- **MER entries:** Full CRUD, 27-column data model, GST auto-calc, draft save, invoice PDF/JPG/PNG
- **Filtering:** Timeframe, FY, month, quarter, vendor, company, status, MER type (bank/cash), global search
- **Reports:** Summary report with head-wise and monthly breakdowns (Excel download); financial year analytics
- **Settings:** Profile, user management (admin)
- **UI:** Dark/light mode, responsive ERP layout, sidebar navigation

## Production build

```bash
pnpm build
pnpm --filter server start
pnpm --filter client preview
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run client + server |
| `pnpm dev:client` | Vite dev server |
| `pnpm dev:server` | API with watch |
| `pnpm build` | Build client + server |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Prettier write |
| `pnpm --filter server seed:companies` | Sync company master data |

## Indian financial year

FY runs **April → March** (e.g. `2025-26`). Quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.

## License

Private / internal use.
