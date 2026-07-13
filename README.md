# Child Care Compass

A connected child-care operations platform with distinct Admin, Teacher, and Parent experiences. Built as “soft software”: calm, playful, tactile, and fast enough for real classroom days.

## Demo accounts

All demo accounts use password `demo123`.

| Portal | Email | What it demonstrates |
|---|---|---|
| Admin | `admin@compass.demo` | Center control, classroom pulse, people, billing, and compliance |
| Teacher | `teacher@compass.demo` | Living dashboard, attendance Kanban, quick logs, handover, curriculum, and messages |
| Parent | `parent@compass.demo` | Daily stories, live feed, secure messages, billing, and child profile |

## Run locally

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API and Socket.IO server run on `http://localhost:4000`.

## Validate

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

- `apps/web`: React 18, Vite, HashRouter, TanStack Query, Zustand, Framer Motion, Tailwind, Lucide.
- `apps/api`: Express, JWT RBAC, Zod, Socket.IO, and `pg-mem` PostgreSQL-compatible demo storage.
- `packages/shared`: shared entities, role routing, workflow contracts, and formatting helpers.

Every primary entity is scoped by `centerId`. REST mutations emit real-time events so attendance, activities, messages, and billing stay synchronized across connected devices. The demo database resets when the API restarts; swap the store adapter for a managed PostgreSQL database before storing real center data.

## Production build

`npm run build` creates both applications. `npm start` serves the API, WebSocket transport, and compiled web app from one Node process. A Dockerfile and Render blueprint are included.

For production, set a strong `JWT_SECRET`, connect a persistent PostgreSQL provider, terminate TLS at the host, and configure backups and media storage.
