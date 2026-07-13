# Child Care Compass — Product Design

## Product experience

Child Care Compass is a multi-role child-care operations platform with a soft, reassuring visual language. Organic contours, airy pastel surfaces, doodle accents, glass depth, large touch targets, and spring motion make operational software feel calm without compromising information density or accessibility.

## Roles and portals

- **Admin:** Control Center for center-wide attendance, staffing ratios, billing, compliance, classroom health, children, staff, and contextual child timelines.
- **Teacher:** Time-aware Living Dashboard, one-hand attendance Kanban, quick activity logging, curriculum drawer, handover signatures, classroom messaging, and daily summaries.
- **Parent:** Mobile-first stories and activity feed, child daily timeline, secure messaging, invoices, notifications, and profile controls.

All roles operate on the same center, classroom, child, attendance, activity, message, and billing records. Mutations broadcast through Socket.IO and refresh React Query caches on every connected client.

## Architecture

The repository is a TypeScript npm workspace with `apps/web`, `apps/api`, and `packages/shared`. The React/Vite client uses HashRouter, TanStack Query for server state, Zustand for session/UI state, Tailwind CSS, Framer Motion, Lucide icons, and accessible reusable primitives. The Express API uses JWT RBAC, Zod validation, Socket.IO, and a PostgreSQL-compatible `pg-mem` store seeded with a realistic demo center.

Demo credentials use the shared password `demo123` with `admin@compass.demo`, `teacher@compass.demo`, and `parent@compass.demo`. Authentication returns only role-authorized data. All primary records carry `centerId`, and server middleware enforces tenant scope.

## Functional boundaries

- Authentication: login, current session, logout, protected role routes.
- Dashboard: role-aware aggregate metrics and time-sensitive focus.
- Attendance: Expected → Present → Went Home, ratio calculation, handover signature.
- Activities: meal, nap, learning, photo-style moment, note, incident; tagged children and parent visibility.
- Messaging: role-scoped conversations, optimistic send, real-time delivery.
- Curriculum: daily goal, schedule, materials, and downloadable-document metadata.
- Billing: invoices, payment status, parent ledger, admin revenue summary.
- Administration: center/classroom/child/staff overview and compliance alerts.

## Reliability and error handling

API errors use a stable `{ error, message, details? }` shape. Client queries expose loading, empty, retry, and toast states. Invalid JWTs return 401, forbidden roles return 403, tenant mismatches return 404, and malformed writes return 400. Optimistic interactions roll back on failure.

## Accessibility and responsiveness

All controls are keyboard-operable, focus-visible, labeled, and at least 44px on touch surfaces. Color is never the only status signal. Motion respects `prefers-reduced-motion`. Admin layouts adapt from three columns to stacked panels; teacher Kanban becomes horizontally scrollable; the parent portal is optimized for 390px mobile and remains coherent on desktop.

## Verification

Unit tests cover role access, attendance transitions, activity creation, message visibility, and billing scope. Component tests cover login and role routing. Playwright verifies all three login journeys, teacher check-in/activity logging, admin overview, parent feed/message, responsive mobile layout, and screenshot QA.

