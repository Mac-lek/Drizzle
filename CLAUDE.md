# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # Watch mode API server
npm run worker:dev         # Watch mode background worker

# Build
npm run build              # Compile TypeScript → dist/

# Testing
npm test                   # Unit tests
npm run test:watch         # Unit tests in watch mode
npm run test:cov           # Unit tests with coverage
npm run test:e2e           # End-to-end tests

# Code quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

# Database
npm run db:generate        # Generate Prisma client after schema changes
npm run db:migrate:dev     # Create and apply dev migration
npm run db:migrate:deploy  # Apply migrations to production
npm run db:seed            # Seed lookup tables
npm run db:studio          # Open Prisma Studio
```

## Architecture

**Drizzle** is a Scheduled Savings Disbursement API for the Nigerian market. Despite the project name, it uses **Prisma ORM** (not Drizzle ORM).

### Two-Process Model

The app runs as two separate NestJS processes controlled by `PROCESS_TYPE` env var:
- **`web`**: HTTP API server (`src/main.ts` → `AppModule`)
- **`worker`**: Background job processor (`src/worker.ts` → `WorkerModule`) using BullMQ + Redis

In production, these scale independently via Docker Compose services.

### Module Structure

Each domain is a self-contained NestJS module under `src/`:

| Module | Domain |
|--------|--------|
| `auth` | JWT + Passport authentication |
| `users` | User accounts and profiles |
| `kyc` | Identity verification (Dojah Tier 1, Smile Identity Tier 2) |
| `wallet` | User wallet management |
| `vault` | Savings vault core logic |
| `disbursement` | Scheduled drip disbursement processing |
| `ledger` | Double-entry financial ledger |
| `payments` | Paystack payment processing |
| `notifications` | Termii SMS + Firebase push notifications |
| `reconciliation` | Async webhook event reconciliation |
| `admin` | Admin operations |
| `health` | Health check endpoints |

### Path Aliases

TypeScript paths are configured for clean imports:
```
@common/*      → src/common/
@config/*      → src/config/
@prisma-client/* → src/prisma/
@auth/*        → src/auth/
@users/*       → src/users/
@kyc/*         → src/kyc/
@wallet/*      → src/wallet/
@vault/*       → src/vault/
@disbursement/* → src/disbursement/
@ledger/*      → src/ledger/
@payments/*    → src/payments/
@notifications/* → src/notifications/
@admin/*       → src/admin/
```

### Shared Infrastructure (`src/common/`)

- **Guards**: `JwtAuthGuard` — applied globally; routes opt out via `@Public()` decorator
- **Decorators**: `@CurrentUser()` extracts user from JWT payload; `@Public()` bypasses auth
- **Filters**: `AllExceptionsFilter` (global) + `PrismaExceptionFilter` (maps Prisma errors: P2002→409, P2025→404, P2003→400)
- **Interceptors**: `IdempotencyInterceptor` — caches responses by `Idempotency-Key` header for 24h in Redis
- **Utils**: `util.money.ts` (Kobo↔Naira, uses BigInt); `util.phone.ts` (Nigerian E.164 normalization)
- **Messages**: `lib.enum.messages.ts` — standardized API response strings

### Key Design Decisions

**Financial precision**: All monetary values are stored and calculated in **Kobo** (1 Naira = 100 Kobo). BigInt is used to prevent floating-point errors. Convert only at API boundaries using `util.money.ts`.

**Lookup tables**: Domain enums (VaultStatus, DisbursementStatus, KycStatus, etc.) are stored as database tables seeded by `prisma/seed.ts`, not as Prisma enums. This lets clients query available values dynamically.

**Idempotency**: POST/PATCH requests should include an `Idempotency-Key` header. The interceptor returns cached responses for 24h to prevent duplicate processing.

**BVN encryption**: Bank Verification Numbers are encrypted at rest using Google Cloud KMS.

**Enumeration resistance**: Unauthenticated endpoints must never reveal whether a phone number, email, or user exists. `POST /auth/signup` always returns the same success response regardless of whether the phone is already registered. `POST /auth/login` and `POST /auth/verify-otp` always return the same generic error when credentials are wrong — never distinguish "user not found" from "wrong PIN/OTP".

### API Conventions

- Global prefix: `/api/v1`
- Swagger docs: `/api/docs` (development only)
- JWT tokens: access (15m TTL), refresh (30d TTL)
- Global `ValidationPipe` with `whitelist: true` and `transform: true`

### External Integrations

| Service | Purpose |
|---------|---------|
| Paystack | Payment processing + webhooks |
| Dojah | KYC Tier 1 (identity verification) |
| Smile Identity | KYC Tier 2 (advanced verification) |
| Termii | SMS delivery |
| Firebase FCM | Push notifications |
| Sentry | Error tracking |
| Google Cloud KMS | BVN encryption |

## Project Health Check Prompt

Use this prompt at the start of any session to get a full project status review:

```
You are reviewing the Drizzle API — a NestJS + Prisma scheduled-savings disbursement backend (Nigerian market).
Two-process model: `web` (HTTP API) and `worker` (BullMQ background jobs).

Do a full project health check. Cover all of the following:

1. GIT STATE
   - What is committed and merged to `main`?
   - What is on the current branch but not yet committed (untracked `??` or modified `M` in git status)?
   - Are there any stale/orphan branches?

2. FEATURE COMPLETENESS — for each module in src/:
   auth | users | wallet | vault | ledger | payments | disbursement | kyc | notifications | reconciliation | admin | health | worker
   - Is the module wired into AppModule (or WorkerModule)?
   - Does it have: module file, service, controller (if applicable), DTOs, tests?
   - Is it fully functional or a stub/empty directory?

3. SCHEMA vs CODE GAPS
   - Are there Prisma model fields that exist in the schema but are never written to in any service?
   - Are there services that assume lookup-table rows exist without guaranteeing they were seeded?

4. CORRECTNESS ISSUES — check for:
   - Race conditions (balance checks outside transactions, double-spend)
   - Missing env vars (compare env.validation.ts against all providers/configs)
   - Endpoints that are implemented but not registered in the module
   - Security gaps on public endpoints (missing signature verification, missing auth guard bypass)

5. WHAT TO MERGE — list which branches/commits are ready to PR to main, and what must be fixed first.

6. WHAT'S NEXT — ordered by criticality, what are the next things to build?

Be specific: cite file paths and line numbers. Don't speculate — read the actual files.
```
