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
});
