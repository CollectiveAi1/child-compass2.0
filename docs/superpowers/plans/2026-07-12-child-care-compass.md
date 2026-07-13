# Child Care Compass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a connected three-role child-care operations SaaS from the approved PRD.

**Architecture:** TypeScript npm workspace with a Vite React client, Express/Socket.IO API, shared contracts, and a PostgreSQL-compatible in-memory demo database. Role-scoped REST mutations drive real-time cache synchronization across portals.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind, Framer Motion, Zustand, TanStack Query, Express, Socket.IO, JWT, Zod, pg-mem, Vitest, Testing Library, Playwright.

## Global Constraints

- HashRouter for deployment compatibility.
- Every primary record is tenant-scoped by `centerId`.
- Demo password is exactly `demo123` for Admin, Teacher, and Parent.
- Spring motion uses damping 25 and stiffness 200.
- Interfaces are responsive, keyboard accessible, and respect reduced motion.
- No inert primary controls or placeholder panels.

### Task 1: Workspace, contracts, and test harness

**Files:** root package/configuration files, `packages/shared/src/*`, Vitest configuration.

- [ ] Write failing shared-contract tests for attendance transitions and role navigation.
- [ ] Run tests and verify failure.
- [ ] Implement types, constants, and helpers.
- [ ] Run tests and verify pass.

### Task 2: API authentication and seeded data

**Files:** `apps/api/src/db.ts`, `auth.ts`, `server.ts`, API tests.

- [ ] Write failing login/RBAC/tenant tests.
- [ ] Implement seeded pg-mem schema and JWT middleware.
- [ ] Implement role-scoped session and dashboard endpoints.
- [ ] Verify tests pass.

### Task 3: Connected operational APIs

**Files:** API feature routers and integration tests.

- [ ] Write failing attendance, activity, messaging, curriculum, and billing tests.
- [ ] Implement validated CRUD and Socket.IO event broadcasting.
- [ ] Verify role permissions and test pass.

### Task 4: Design system and application shell

**Files:** `apps/web/src/styles.css`, UI primitives, auth store, API client, router.

- [ ] Write failing login and protected-route component tests.
- [ ] Implement tokens, responsive shell, role switching via login, toast and loading states.
- [ ] Verify component tests and accessibility assertions.

### Task 5: Admin portal

**Files:** admin dashboard and feature components.

- [ ] Implement Control Center metrics, rooms, children/staff list, billing, compliance, and context timeline.
- [ ] Connect filters, selection, and mutations to API queries.
- [ ] Verify desktop and stacked responsive states.

### Task 6: Teacher portal

**Files:** living dashboard, attendance board, quick log, curriculum drawer, handover modal.

- [ ] Implement time-aware greeting and focus state.
- [ ] Implement attendance state transitions with sound and ratio updates.
- [ ] Implement activity composer, daily timeline, lesson plan, signature handover, and messaging.
- [ ] Verify connected state changes.

### Task 7: Parent portal

**Files:** parent home, stories/feed, messaging, billing, child profile.

- [ ] Implement mobile-first stories and activity feed.
- [ ] Implement conversation composer, invoice ledger, notifications, and navigation.
- [ ] Verify role-scoped data and mobile interaction.

### Task 8: Browser QA and publish

**Files:** Playwright tests, screenshots, README, deployment configuration.

- [ ] Run lint, typecheck, unit/integration tests, and production build.
- [ ] Run browser workflows at 1440×1000 and 390×844.
- [ ] Inspect screenshots, record fidelity ledger, and repair material issues.
- [ ] Commit, push `agent/child-care-compass-platform`, and open a PR against `main` if tooling permits.

