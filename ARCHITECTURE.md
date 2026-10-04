# Bullion — Architecture Document

## Overview

Bullion is a standalone bullion (gold/silver) inventory and transaction management system. It is completely independent of Pawnify.

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 App Router | SSR, file-based routing, Server Actions |
| Language | TypeScript 5 | Type safety across the stack |
| Styling | Tailwind CSS v4 | Same design system as Pawnify ecosystem |
| ORM | Sequelize ORM | Mature, enterprise-grade promise-based ORM with TypeScript models & migrations |
| Database | MySQL (InnoDB) | High-performance, ACID-compliant relational DB with row-level locking |
| Auth | Better Auth | Modern, session-based, extensible (MySQL/Sequelize backed) |
| Validation | Zod | Schema-first runtime validation |
| Testing | Vitest | Fast unit tests compatible with TS |
| Icons | Lucide React | Consistent with Pawnify design language |

## Folder Structure

```
Bullion/
├── public/                  # Static assets
├── scripts/                 # Maintenance & seeding scripts
│   └── seed-mysql.ts        # Standard MySQL sync & initial master data seeder
├── src/
│   ├── app/
│   │   ├── (app)/           # Authenticated route group
│   │   │   ├── layout.tsx   # Auth guard + Sidebar layout
│   │   │   ├── dashboard/   # Dashboard page
│   │   │   ├── purchases/   # Purchase module
│   │   │   ├── sales/       # Sales module
│   │   │   ├── stock/       # Stock positions
│   │   │   ├── adjustments/ # Stock adjustments
│   │   │   ├── history/     # Transaction history
│   │   │   ├── reports/     # Reports
│   │   │   ├── profile/     # User profile
│   │   │   └── admin/       # Admin controls
│   │   ├── (auth)/          # Unauthenticated route group
│   │   │   └── login/       # Login page
│   │   ├── api/
│   │   │   └── auth/[...all]/ # Better Auth API handler
│   │   ├── layout.tsx       # Root layout (ThemeProvider, fonts)
│   │   ├── page.tsx         # Root redirect → /dashboard
│   │   └── globals.css      # Design system (tokens, components)
│   ├── components/
│   │   ├── sidebar.tsx      # Navigation sidebar
│   │   ├── page-header.tsx  # Standard page header
│   │   ├── loading.tsx      # Loading state component
│   │   ├── empty-state.tsx  # Empty state component
│   │   ├── theme-provider.tsx # Light/Dark theme context
│   │   └── ui/              # Primitive UI components
│   └── lib/
│       ├── actions/         # Next.js Server Actions (RPC mutations)
│       ├── auth/
│       │   ├── auth.ts      # Better Auth server config (MySQL adapter)
│       │   └── auth-client.ts # Better Auth browser client
│       ├── db/
│       │   ├── sequelize.ts # Sequelize instance & connection singleton
│       │   ├── index.ts     # Central model initialization & association registry
│       │   └── models/      # Strongly-typed Sequelize model definitions
│       │       ├── User.ts
│       │       ├── Metal.ts
│       │       ├── Purity.ts
│       │       ├── StockLedger.ts
│       │       ├── Purchase.ts
│       │       ├── Sale.ts
│       │       ├── StockAdjustment.ts
│       │       └── AppSetting.ts
│       ├── services/
│       │   └── stock-service.ts # Stock ledger mutations with managed transactions
│       ├── validations/
│       │   ├── purchase.ts  # Purchase Zod schemas
│       │   ├── sale.ts      # Sale Zod schemas
│       │   └── adjustment.ts # Adjustment Zod schemas
│       └── utils/
│           └── helpers.ts   # cn(), formatCurrency(), formatGrams(), formatDate()
└── tests/
    └── unit/
        ├── helpers.test.ts  # Utility function smoke tests
        └── stock-logic.test.ts # Stock math smoke tests
```

## Database Schema

### Core Design Principles

1. **Audit trail by design** — transactions use `status` enum (`POSTED | CANCELLED | VOIDED`). Cancelled transactions reverse their stock impact without deleting the record.
2. **Atomic stock mutations** — all stock changes go through `StockService` inside a managed `sequelize.transaction()` with pessimistic row locks to guarantee consistency.
3. **Stock is never negative** — `StockService.applySale()` enforces this at the service layer before committing.
4. **Historical rates are immutable** — purchase/sale rates are stored on the transaction record and never updated.

### Models

| Model | Purpose |
|-------|---------|
| `User` | Better Auth user + role (ADMIN/STAFF) |
| `Session` / `Account` / `Verification` | Better Auth required tables |
| `Metal` | Gold, Silver master record |
| `Purity` | Purity definitions per metal (22K, 999, etc.) |
| `StockLedger` | Running stock position per (Metal, Purity) |
| `Purchase` | Purchase transaction record |
| `Sale` | Sale transaction record |
| `StockAdjustment` | Authorized stock adjustment record |
| `AppSetting` | Key-value app settings |

### Stock Calculation

```
Available Weight
= Opening Weight
+ Purchased Weight
- Sold Weight
+ Net Adjusted Weight (positive = increase, negative = decrease)
```

## Authentication Architecture

- **Provider**: Better Auth with `emailAndPassword`
- **Storage**: MySQL via Sequelize / MySQL adapter
- **Sessions**: Server-side, 7-day expiry
- **Roles**: `ADMIN` | `STAFF` — stored on `User` record
- **Route protection**: Server-side in `(app)/layout.tsx` via `auth.api.getSession()`
- **Client**: `authClient` in `src/lib/auth/auth-client.ts` for browser-side sign-in/out

## Domain Boundaries

```
auth/          → User identity, sessions, roles
metals/        → Metal master (Gold, Silver)
purity/        → Purity definitions per metal
purchases/     → Purchase transactions + stock increase
sales/         → Sale transactions + stock decrease (no-negative guard)
inventory/     → StockLedger: running position per (metal, purity)
adjustments/   → Authorized stock adjustments ± with reason trail
reports/       → Read-only aggregations (Purchase Register, Sales Register, etc.)
```

## UI/UX Design Strategy

Bullion shares the **same visual language** as Pawnify's current Octis Jewellery UI:

- **Palette**: Warm honey brass (`#C59A58` / `#B38646`) accent on deep mahogany sidebar (`#351D14`)
- **Typography**: Poppins, same weight hierarchy
- **Cards**: `glass-card` with `--shadow-card` and `--border-card`
- **Tables**: `data-table` with `--bg-table-head` and hover states
- **Badges**: Status-specific badge classes (`badge-posted`, `badge-gold`, etc.)
- **Buttons**: `btn-primary` (gold gradient), `btn-secondary`, `btn-danger`
- **Inputs**: `input-field` with focus ring at `--accent` color
- **Sidebar**: Dark mahogany with gold accents, identical structure to Pawnify

No Pawnify source files are imported. Components are independently implemented.

## Independence Verification

| Check | Result |
|-------|--------|
| Separate `package.json` | ✅ |
| Separate `node_modules` | ✅ |
| Separate Sequelize models & migrations | ✅ |
| Separate MySQL database (`bullion_db`) | ✅ |
| Separate Better Auth instance | ✅ |
| Zero `../Pawnify/` imports | ✅ |
| Pawnify files unmodified | ✅ |