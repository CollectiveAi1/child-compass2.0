import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { resetDemoStore } from './store';

async function login(app: ReturnType<typeof createApp>['app'], email: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'demo123' });
  return response.body.token as string;
}

describe('Child Care Compass API', () => {
  beforeEach(() => resetDemoStore());

  it('logs each demo role into a distinct scoped session', async () => {
    const { app } = createApp();
    for (const [email, role] of [
      ['admin@compass.demo', 'admin'],
      ['teacher@compass.demo', 'teacher'],
      ['parent@compass.demo', 'parent'],
    ] as const) {
      const response = await request(app).post('/api/auth/login').send({ email, password: 'demo123' });
      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe(role);
      expect(response.body.token).toEqual(expect.any(String));
    }
  });

  it('rejects invalid credentials', async () => {
    const { app } = createApp();
    const response = await request(app).post('/api/auth/login').send({ email: 'admin@compass.demo', password: 'wrong' });
    expect(response.status).toBe(401);
  });

  it('allows teachers to check in a classroom child and updates dashboard totals', async () => {
    const { app } = createApp();
    const token = await login(app, 'teacher@compass.demo');
    const response = await request(app)
      .patch('/api/attendance/child-4')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'present' });
    expect(response.status).toBe(200);
    expect(response.body.attendanceStatus).toBe('present');

    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.stats.present).toBeGreaterThan(0);
  });

  it('prevents parents from changing attendance', async () => {
    const { app } = createApp();
    const token = await login(app, 'parent@compass.demo');
    const response = await request(app)
      .patch('/api/attendance/child-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'went_home' });
    expect(response.status).toBe(403);
  });

  it('creates activities and exposes them to the linked parent', async () => {
    const { app } = createApp();
    const teacherToken = await login(app, 'teacher@compass.demo');
    const parentToken = await login(app, 'parent@compass.demo');
    const created = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ childIds: ['child-1'], type: 'meal', title: 'Lunch', body: 'Ate every bite', value: 'All' });
    expect(created.status).toBe(201);
    const parentDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${parentToken}`);
    expect(parentDashboard.body.activities.some((activity: { id: string }) => activity.id === created.body.id)).toBe(true);
  });

  it('keeps parent invoices scoped to their family', async () => {
    const { app } = createApp();
    const token = await login(app, 'parent@compass.demo');
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.invoices.length).toBeGreaterThan(0);
    expect(dashboard.body.invoices.every((invoice: { guardianId: string }) => invoice.guardianId === 'user-parent')).toBe(true);
  });

  it('delivers a parent message to classroom staff', async () => {
    const { app } = createApp();
    const token = await login(app, 'parent@compass.demo');
    const response = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ childId: 'child-1', body: 'Grandma will pick up today.' });
    expect(response.status).toBe(201);
    expect(response.body.recipientIds).toContain('user-teacher');
  });

  it('prevents a parent from messaging about another family’s child', async () => {
    const { app } = createApp();
    const token = await login(app, 'parent@compass.demo');
    const response = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ childId: 'child-2', body: 'Hello' });
    expect(response.status).toBe(404);
  });

  it('prevents a teacher from messaging about a child outside their classrooms', async () => {
    const { app } = createApp();
    const token = await login(app, 'teacher@compass.demo');
    const response = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ childId: 'child-9', body: 'Hello' });
    expect(response.status).toBe(404);
  });

  it('hides activities from parents whose children are not tagged', async () => {
    const { app } = createApp();
    const token = await login(app, 'priya@compass.demo');
    const response = await request(app)
      .patch('/api/activities/activity-2/like')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('lets admins add a child who then appears on the roster', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const created = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Sunny', lastName: 'Rae', birthday: '2023-02-14', classroomId: 'room-sunbeams', guardianName: 'Jo Rae', guardianPhone: '(614) 555-0999' });
    expect(created.status).toBe(201);
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.children.some((child: { id: string }) => child.id === created.body.id)).toBe(true);
  });

  it('keeps siblings on one family file and enrolls them all together', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    // The Bell family application starts with two children; a third sibling
    // joins the same file instead of a new application.
    const appended = await request(app)
      .post('/api/enrollments/enrollment-1/children')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Henry Bell', birthday: '2022-06-15', classroomId: 'room-meadow' });
    expect(appended.status).toBe(201);
    expect(appended.body.children).toHaveLength(3);

    const before = (await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)).body;
    const response = await request(app)
      .patch('/api/enrollments/enrollment-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'enrolled' });
    expect(response.status).toBe(200);
    const after = (await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)).body;
    expect(after.children.length).toBe(before.children.length + 3);
    const bells = after.children.filter((child: { lastName: string }) => child.lastName === 'Bell');
    expect(bells).toHaveLength(3);
    expect(new Set(bells.map((child: { guardianName: string }) => child.guardianName))).toEqual(new Set(['Jamie Bell']));
    // Each enrolled sibling is billed their room's registration fee.
    const registrations = after.invoices.filter((invoice: { childId: string; description: string }) => bells.some((child: { id: string }) => child.id === invoice.childId) && invoice.description.startsWith('Registration fee'));
    expect(registrations).toHaveLength(3);
    // Closed applications no longer accept new children.
    const closed = await request(app)
      .post('/api/enrollments/enrollment-1/children')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Late Bell', birthday: '2024-01-01', classroomId: 'room-nest' });
    expect(closed.status).toBe(409);
  });

  it('records a manual payment against an invoice', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const response = await request(app)
      .post('/api/invoices/invoice-3/record-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'Check' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('paid');
    expect(response.body.method).toBe('Check');
  });

  it('lets teachers upload and download documents but keeps parents out', async () => {
    const { app } = createApp();
    const teacherToken = await login(app, 'teacher@compass.demo');
    const parentToken = await login(app, 'parent@compass.demo');
    const uploaded = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Weekly plan.txt', category: 'curriculum', contentType: 'text/plain', size: 11, dataUrl: 'data:text/plain;base64,aGVsbG8gdGhlcmU=' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.dataUrl).toBeUndefined();

    const downloaded = await request(app).get(`/api/documents/${uploaded.body.id}`).set('Authorization', `Bearer ${teacherToken}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body.dataUrl).toBe('data:text/plain;base64,aGVsbG8gdGhlcmU=');

    const forbidden = await request(app).get(`/api/documents/${uploaded.body.id}`).set('Authorization', `Bearer ${parentToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('blocks teachers from deleting documents they did not upload', async () => {
    const { app } = createApp();
    const teacherToken = await login(app, 'teacher@compass.demo');
    const adminToken = await login(app, 'admin@compass.demo');
    const denied = await request(app).delete('/api/documents/document-1').set('Authorization', `Bearer ${teacherToken}`);
    expect(denied.status).toBe(403);
    const allowed = await request(app).delete('/api/documents/document-1').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
  });

  it('upserts CACFP meal counts per date and meal', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const date = new Date().toISOString().slice(0, 10);
    const first = await request(app).post('/api/meals').set('Authorization', `Bearer ${token}`).send({ date, meal: 'snack', childCount: 12, adultCount: 3 });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/meals').set('Authorization', `Bearer ${token}`).send({ date, meal: 'snack', childCount: 14, adultCount: 3 });
    expect(second.status).toBe(200);
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const snacks = dashboard.body.meals.filter((record: { date: string; meal: string }) => record.date === date && record.meal === 'snack');
    expect(snacks).toHaveLength(1);
    expect(snacks[0].childCount).toBe(14);
  });

  it('keeps the attendance log in step with live check-ins', async () => {
    const { app } = createApp();
    const token = await login(app, 'teacher@compass.demo');
    const date = new Date().toISOString().slice(0, 10);
    await request(app).patch('/api/attendance/child-4').set('Authorization', `Bearer ${token}`).send({ status: 'present' });
    let dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.attendanceLog.some((entry: { date: string; childId: string; status: string }) => entry.date === date && entry.childId === 'child-4' && entry.status === 'present')).toBe(true);
    await request(app).patch('/api/attendance/child-4').set('Authorization', `Bearer ${token}`).send({ status: 'expected' });
    dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.attendanceLog.some((entry: { date: string; childId: string }) => entry.date === date && entry.childId === 'child-4')).toBe(false);
  });

  it('lets admins update the center profile', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const response = await request(app).patch('/api/center').set('Authorization', `Bearer ${token}`).send({ phone: '(614) 555-0400', capacity: 52 });
    expect(response.status).toBe(200);
    expect(response.body.phone).toBe('(614) 555-0400');
    expect(response.body.capacity).toBe(52);
  });

  it('runs the licensing lifecycle: inspection, violation, corrective action, drill, checklist', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const inspection = await request(app).post('/api/inspections').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-08-01', type: 'follow_up', inspector: 'D. Okafor, ODJFS', status: 'scheduled', findings: 0, notes: 'Verify surfacing fix.' });
    expect(inspection.status).toBe(201);
    const violation = await request(app).post('/api/violations').set('Authorization', `Bearer ${token}`)
      .send({ code: '5101:2-12-07', description: 'Posted menu missing substitution note.', severity: 'low', citedOn: '2026-07-18', inspectionId: inspection.body.id });
    expect(violation.status).toBe(201);
    const action = await request(app).post('/api/corrective-actions').set('Authorization', `Bearer ${token}`)
      .send({ violationId: violation.body.id, description: 'Post substitution note with weekly menu.', assignedTo: 'Sofia Martinez', dueDate: '2026-07-25' });
    expect(action.status).toBe(201);
    const completed = await request(app).patch(`/api/corrective-actions/${action.body.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'completed' });
    expect(completed.body.status).toBe('completed');
    expect(completed.body.completedOn).toBeTruthy();
    const drill = await request(app).post('/api/drills').set('Authorization', `Bearer ${token}`)
      .send({ type: 'fire', date: '2026-07-18', timeOfDay: '10:05 AM', durationMinutes: 4, participants: 18 });
    expect(drill.status).toBe(201);
    expect(drill.body.conductedBy).toBe('Sarah Johnson');
    const check = await request(app).patch('/api/compliance-checks/check-4').set('Authorization', `Bearer ${token}`).send({ status: 'compliant' });
    expect(check.body.status).toBe('compliant');
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.inspections.some((item: { id: string }) => item.id === inspection.body.id)).toBe(true);
    expect(dashboard.body.drills[0].id).toBe(drill.body.id);
  });

  it('keeps licensing data away from teachers and parents', async () => {
    const { app } = createApp();
    const teacherToken = await login(app, 'teacher@compass.demo');
    const parentToken = await login(app, 'parent@compass.demo');
    for (const token of [teacherToken, parentToken]) {
      const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
      expect(dashboard.body.inspections).toEqual([]);
      expect(dashboard.body.violations).toEqual([]);
      expect(dashboard.body.complianceChecks).toEqual([]);
      const denied = await request(app).post('/api/drills').set('Authorization', `Bearer ${token}`)
        .send({ type: 'fire', date: '2026-07-18', timeOfDay: '10:05 AM', durationMinutes: 4, participants: 18 });
      expect(denied.status).toBe(403);
    }
  });

  it('manages classroom tuition rates and creates classrooms', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const updated = await request(app).patch('/api/classrooms/room-sunbeams').set('Authorization', `Bearer ${token}`)
      .send({ rates: { registrationFee: 16000, weeklyTuition: 32500, lateFee: 3000, miscFee: 2000 } });
    expect(updated.status).toBe(200);
    expect(updated.body.rates.weeklyTuition).toBe(32500);
    const created = await request(app).post('/api/classrooms').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rainbow Room', ageRange: '4–5 years', capacity: 16, ratioLimit: 12, rates: { registrationFee: 15000, weeklyTuition: 26000, lateFee: 2500, miscFee: 1500 } });
    expect(created.status).toBe(201);
    expect(created.body.color).toMatch(/^#/);
    const teacherToken = await login(app, 'teacher@compass.demo');
    const denied = await request(app).patch('/api/classrooms/room-sunbeams').set('Authorization', `Bearer ${teacherToken}`).send({ rates: { registrationFee: 0, weeklyTuition: 0, lateFee: 0, miscFee: 0 } });
    expect(denied.status).toBe(403);
  });

  it('generates recurring weekly tuition invoices idempotently from classroom rates', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const before = (await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)).body.invoices.length;
    const first = await request(app).post('/api/billing/run-weekly').set('Authorization', `Bearer ${token}`).send({});
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(18);
    const second = await request(app).post('/api/billing/run-weekly').set('Authorization', `Bearer ${token}`).send({});
    expect(second.body.created).toBe(0);
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.invoices.length).toBe(before + 18);
    const weekly = dashboard.body.invoices.find((invoice: { childId: string; description: string }) => invoice.childId === 'child-1' && invoice.description.startsWith('Weekly tuition'));
    expect(weekly.amount).toBe(31000);
    expect(weekly.description).toContain('Sunbeam Studio');
  });

  it('runs weekly billing lazily when auto-billing is on and bills registration on enrollment', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    await request(app).patch('/api/center').set('Authorization', `Bearer ${token}`).send({ autoWeeklyBilling: true });
    const parentToken = await login(app, 'parent@compass.demo');
    const parentDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${parentToken}`);
    expect(parentDashboard.body.invoices.some((invoice: { description: string }) => invoice.description.startsWith('Weekly tuition — Sunbeam Studio'))).toBe(true);
    const child = await request(app).post('/api/children').set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Reg', lastName: 'Fee', birthday: '2023-05-05', classroomId: 'room-nest' });
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const registration = dashboard.body.invoices.find((invoice: { childId: string; description: string }) => invoice.childId === child.body.id && invoice.description.startsWith('Registration fee'));
    expect(registration.amount).toBe(17500);
  });

  it('runs the staff time clock: clock in, block double punch, clock out, scoped visibility', async () => {
    const { app } = createApp();
    const teacherToken = await login(app, 'sofia@compass.demo');
    const clockIn = await request(app).post('/api/time-clock/clock-in').set('Authorization', `Bearer ${teacherToken}`).send({});
    expect(clockIn.status).toBe(201);
    expect(clockIn.body.clockOut).toBeUndefined();
    const double = await request(app).post('/api/time-clock/clock-in').set('Authorization', `Bearer ${teacherToken}`).send({});
    expect(double.status).toBe(409);
    const clockOut = await request(app).post('/api/time-clock/clock-out').set('Authorization', `Bearer ${teacherToken}`).send({});
    expect(clockOut.status).toBe(200);
    expect(clockOut.body.clockOut).toBeTruthy();
    const teacherDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${teacherToken}`);
    expect(teacherDashboard.body.timeEntries.every((entry: { userId: string }) => entry.userId === 'user-teacher-2')).toBe(true);
    const adminToken = await login(app, 'admin@compass.demo');
    const adminDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(new Set(adminDashboard.body.timeEntries.map((entry: { userId: string }) => entry.userId)).size).toBeGreaterThan(1);
    const parentToken = await login(app, 'parent@compass.demo');
    const parentDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${parentToken}`);
    expect(parentDashboard.body.timeEntries).toEqual([]);
    const parentDenied = await request(app).post('/api/time-clock/clock-in').set('Authorization', `Bearer ${parentToken}`).send({});
    expect(parentDenied.status).toBe(403);
  });

  it('lets admins add and remove manual time entries', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const created = await request(app).post('/api/time-clock/entries').set('Authorization', `Bearer ${token}`)
      .send({ userId: 'user-teacher-3', clockIn: '2026-07-15T08:00:00.000Z', clockOut: '2026-07-15T12:30:00.000Z' });
    expect(created.status).toBe(201);
    expect(created.body.date).toBe('2026-07-15');
    const invalid = await request(app).post('/api/time-clock/entries').set('Authorization', `Bearer ${token}`)
      .send({ userId: 'user-teacher-3', clockIn: '2026-07-15T12:00:00.000Z', clockOut: '2026-07-15T08:00:00.000Z' });
    expect(invalid.status).toBe(400);
    const removed = await request(app).delete(`/api/time-clock/entries/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
  });

  it('strips document bytes from the dashboard payload', async () => {
    const { app } = createApp();
    const token = await login(app, 'admin@compass.demo');
    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.documents.length).toBeGreaterThan(0);
    expect(dashboard.body.documents.every((document: Record<string, unknown>) => document.dataUrl === undefined)).toBe(true);
  });
});
