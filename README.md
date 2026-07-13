# Child Care Compass

A connected child-care operations platform with distinct Admin, Teacher, and Parent experiences. Built as “soft software”: calm, playful, tactile, and fast enough for real classroom days.

Ships as one codebase with four delivery targets: **Vercel** (web + serverless API), an installable **PWA**, native **iOS/Android** shells via Capacitor, and a **desktop** app via Electron.

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

## Deploy to Vercel

The repo is preconfigured for Vercel: `vercel.json` builds the web app as a static site and runs the whole Express API as a single serverless function (`api/index.ts`).

```bash
npm i -g vercel
vercel
```

Or import the repo at [vercel.com/new](https://vercel.com/new) — no build settings needed. Then set a strong `JWT_SECRET` in the project’s environment variables.

Serverless notes:

- **Real-time sync**: Vercel functions can’t hold WebSocket connections, so the client automatically falls back from Socket.IO to 15-second polling. The self-hosted server (`npm start`) keeps full WebSocket sync.
- **Demo storage**: data lives in the function instance’s memory and resets whenever the instance recycles. Swap the store adapter for a managed PostgreSQL database (e.g. Vercel Postgres/Neon) before storing real center data.

## Mobile

The deployed site is a full **PWA**: visit it on a phone and use “Add to Home Screen” to install it (offline shell, home-screen icon, standalone window). The same works on desktop Chrome/Edge via the install icon in the address bar.

For native store builds, **Capacitor** wraps the web app (config in `apps/web/capacitor.config.ts`). Native shells talk to your deployed API, so bake its origin in at build time:

```bash
VITE_API_URL=https://your-app.vercel.app npm run build:web
npm run mobile:add:ios -w @compass/web      # once; requires Xcode
npm run mobile:add:android -w @compass/web  # once; requires Android Studio
npm run mobile:sync -w @compass/web
npm run mobile:ios -w @compass/web          # or mobile:android
```

## Desktop

`apps/desktop` is a lightweight Electron shell (kept outside the npm workspaces so the Electron binary is only downloaded when you want it):

```bash
cd apps/desktop
npm install
npm start                                    # loads http://localhost:5173 (run `npm run dev` first)
COMPASS_APP_URL=https://your-app.vercel.app npm start   # or load the deployed app
```

To package installers (dmg/nsis/AppImage), set your deployed URL in `apps/desktop/app-url.json`, then run `npm run dist` in `apps/desktop`.

## Validate

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

- `apps/web`: React 18, Vite, HashRouter, TanStack Query, Zustand, Framer Motion, Tailwind, Lucide. PWA manifest + service worker in `public/`, Capacitor config for native shells.
- `apps/api`: Express, JWT RBAC, Zod, Socket.IO, and `pg-mem` PostgreSQL-compatible demo storage. Runs as a long-lived server locally (`npm start`) and as a Vercel serverless function in production (`api/index.ts`).
- `apps/desktop`: Electron shell that loads the web app (dev server or deployed URL).
- `packages/shared`: shared entities, role routing, workflow contracts, and formatting helpers.

Every primary entity is scoped by `centerId`. REST mutations emit real-time events (WebSocket when available, polling otherwise) so attendance, activities, messages, and billing stay synchronized across connected devices. The demo database resets when the API restarts; swap the store adapter for a managed PostgreSQL database before storing real center data.

## Self-hosted production build

`npm run build` creates both applications. `npm start` serves the API, WebSocket transport, and compiled web app from one Node process on any Node host.

For production, set a strong `JWT_SECRET`, connect a persistent PostgreSQL provider, terminate TLS at the host, and configure backups and media storage.
