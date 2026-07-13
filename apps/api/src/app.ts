import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import type { Activity, AttendanceStatus, Message } from '@compass/shared';
import { allow, authenticate, signUser, type AuthRequest } from './auth';
import { store } from './store';

type Broadcast = (event: string, payload: unknown) => void;
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const attendanceSchema = z.object({ status: z.enum(['expected', 'present', 'went_home']), signature: z.string().optional() });
const activitySchema = z.object({ childIds: z.array(z.string()).min(1), type: z.enum(['moment', 'meal', 'nap', 'learning', 'note', 'incident']), title: z.string().min(1).max(80), body: z.string().min(1).max(600), value: z.string().max(80).optional(), mediaUrl: z.string().optional() });
const messageSchema = z.object({ childId: z.string(), body: z.string().min(1).max(1000) });

function parseBody<T>(schema: z.ZodType<T>, body: unknown, res: express.Response): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', message: 'Please check the highlighted information.', details: parsed.error.flatten() });
    return undefined;
  }
  return parsed.data;
}

function scopedDashboard(user: NonNullable<AuthRequest['user']>) {
  const data = store();
  const childIds = user.role === 'parent' ? user.childIds : [];
  const classrooms = user.role === 'teacher' ? data.classrooms.filter(room => user.classroomIds.includes(room.id)) : user.role === 'parent' ? data.classrooms.filter(room => data.children.some(child => childIds.includes(child.id) && child.classroomId === room.id)) : data.classrooms;
  const roomIds = classrooms.map(room => room.id);
  const children = user.role === 'parent' ? data.children.filter(child => childIds.includes(child.id)) : user.role === 'teacher' ? data.children.filter(child => roomIds.includes(child.classroomId)) : data.children;
  const visibleChildIds = children.map(child => child.id);
  const activities = data.activities.filter(activity => activity.childIds.some(id => visibleChildIds.includes(id)));
  const messages = data.messages.filter(message => user.role === 'admin' || message.senderId === user.id || message.recipientIds.includes(user.id) || visibleChildIds.includes(message.childId));
  const invoices = user.role === 'admin' ? data.invoices : user.role === 'parent' ? data.invoices.filter(invoice => invoice.guardianId === user.id) : [];
  const curriculum = user.role === 'parent' ? [] : data.curriculum.filter(item => user.role === 'admin' || roomIds.includes(item.classroomId));
  const staff = user.role === 'admin' ? data.users.filter(item => item.role !== 'parent') : data.users.filter(item => item.role === 'teacher' && item.classroomIds.some(id => roomIds.includes(id)));
  const revenueCollected = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const revenueOutstanding = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  return {
    center: data.center, classrooms, children, activities: [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    messages: [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), invoices, curriculum, staff,
    stats: {
      present: children.filter(child => child.attendanceStatus === 'present').length,
      expected: children.filter(child => child.attendanceStatus === 'expected').length,
      wentHome: children.filter(child => child.attendanceStatus === 'went_home').length,
      capacity: classrooms.reduce((sum, room) => sum + room.capacity, 0),
      staffOnSite: staff.filter(item => item.role === 'teacher').length,
      unreadMessages: messages.filter(message => !message.readBy.includes(user.id) && message.senderId !== user.id).length,
      revenueCollected, revenueOutstanding,
    },
  };
}

export function createApp(broadcast: Broadcast = () => undefined) {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Child Care Compass' }));

  app.post('/api/auth/login', (req, res) => {
    const body = parseBody(loginSchema, req.body, res);
    if (!body) return;
    const user = store().users.find(item => item.email.toLowerCase() === body.email.toLowerCase());
    if (!user || body.password !== 'demo123') return res.status(401).json({ error: 'invalid_credentials', message: 'That email and password do not match.' });
    return res.json({ token: signUser(user), user });
  });
  app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => res.json({ user: req.user }));
  app.get('/api/dashboard', authenticate, (req: AuthRequest, res) => res.json(scopedDashboard(req.user!)));

  app.patch('/api/attendance/:childId', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(attendanceSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === req.params.childId && item.centerId === req.user!.centerId);
    if (!child || (req.user!.role === 'teacher' && !req.user!.classroomIds.includes(child.classroomId))) return res.status(404).json({ error: 'not_found', message: 'Child not found in your classroom.' });
    child.attendanceStatus = body.status as AttendanceStatus;
    if (body.status === 'present') { child.checkedInAt = new Date().toISOString(); child.checkedOutAt = undefined; }
    if (body.status === 'went_home') child.checkedOutAt = new Date().toISOString();
    if (body.status === 'expected') { child.checkedInAt = undefined; child.checkedOutAt = undefined; }
    broadcast('attendance:updated', child);
    return res.json(child);
  });

  app.post('/api/activities', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(activitySchema, req.body, res);
    if (!body) return;
    const children = store().children.filter(child => body.childIds.includes(child.id) && child.centerId === req.user!.centerId);
    if (children.length !== body.childIds.length || (req.user!.role === 'teacher' && children.some(child => !req.user!.classroomIds.includes(child.classroomId)))) return res.status(403).json({ error: 'forbidden', message: 'One or more selected children are outside your classroom.' });
    const activity: Activity = { id: `activity-${Date.now()}`, centerId: req.user!.centerId, classroomId: children[0]!.classroomId, childIds: body.childIds, authorId: req.user!.id, authorName: req.user!.name, type: body.type, title: body.title, body: body.body, value: body.value, mediaUrl: body.mediaUrl, createdAt: new Date().toISOString(), likedBy: [] };
    store().activities.unshift(activity);
    broadcast('activity:created', activity);
    return res.status(201).json(activity);
  });
  app.patch('/api/activities/:activityId/like', authenticate, (req: AuthRequest, res) => {
    const activity = store().activities.find(item => item.id === req.params.activityId && item.centerId === req.user!.centerId);
    if (!activity) return res.status(404).json({ error: 'not_found', message: 'Moment not found.' });
    activity.likedBy = activity.likedBy.includes(req.user!.id) ? activity.likedBy.filter(id => id !== req.user!.id) : [...activity.likedBy, req.user!.id];
    broadcast('activity:updated', activity);
    return res.json(activity);
  });

  app.post('/api/messages', authenticate, (req: AuthRequest, res) => {
    const body = parseBody(messageSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === body.childId && item.centerId === req.user!.centerId);
    if (!child) return res.status(404).json({ error: 'not_found', message: 'Child conversation not found.' });
    const classroom = store().classrooms.find(room => room.id === child.classroomId)!;
    const recipientIds = req.user!.role === 'parent' ? classroom.teacherIds : child.guardianIds;
    const message: Message = { id: `message-${Date.now()}`, centerId: req.user!.centerId, childId: child.id, senderId: req.user!.id, recipientIds, body: body.body, createdAt: new Date().toISOString(), readBy: [req.user!.id] };
    store().messages.push(message);
    broadcast('message:created', message);
    return res.status(201).json(message);
  });
  app.patch('/api/messages/:messageId/read', authenticate, (req: AuthRequest, res) => {
    const message = store().messages.find(item => item.id === req.params.messageId && item.centerId === req.user!.centerId);
    if (!message) return res.status(404).json({ error: 'not_found', message: 'Message not found.' });
    if (!message.readBy.includes(req.user!.id)) message.readBy.push(req.user!.id);
    return res.json(message);
  });

  app.post('/api/invoices/:invoiceId/pay', authenticate, allow('admin', 'parent'), (req: AuthRequest, res) => {
    const invoice = store().invoices.find(item => item.id === req.params.invoiceId && item.centerId === req.user!.centerId && (req.user!.role === 'admin' || item.guardianId === req.user!.id));
    if (!invoice) return res.status(404).json({ error: 'not_found', message: 'Invoice not found.' });
    invoice.status = 'paid';
    broadcast('invoice:updated', invoice);
    return res.json(invoice);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found', message: 'That route does not exist.' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  });
  return { app };
}
