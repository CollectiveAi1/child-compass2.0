import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import type { Activity, AttendanceStatus, CenterDocumentFile, CenterEvent, Child, Classroom, Complaint, CorrectiveAction, EmergencyDrill, EnrollmentApplication, Inspection, Invoice, MealRecord, Message, TimeEntry, User, Violation } from '@compass/shared';
import { weekMondayOf } from '@compass/shared';
import { allow, authenticate, signUser, type AuthRequest } from './auth';
import { store, today } from './store';

type Broadcast = (event: string, payload: unknown) => void;
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const attendanceSchema = z.object({ status: z.enum(['expected', 'present', 'went_home']), signature: z.string().optional() });
const activitySchema = z.object({ childIds: z.array(z.string()).min(1), type: z.enum(['moment', 'meal', 'nap', 'learning', 'note', 'incident']), title: z.string().min(1).max(80), body: z.string().min(1).max(600), value: z.string().max(80).optional(), mediaUrl: z.string().optional() });
const messageSchema = z.object({ childId: z.string(), body: z.string().min(1).max(1000) });
const immunizationSchema = z.object({ name: z.string().min(1).max(60), date: z.string(), status: z.enum(['complete', 'due', 'overdue']) });
const medicalSchema = z.object({
  physician: z.string().max(80), physicianPhone: z.string().max(30), conditions: z.string().max(400), medications: z.string().max(400), lastPhysical: z.string().max(20),
  immunizations: z.array(immunizationSchema).max(30), emergencyContacts: z.array(z.object({ name: z.string().min(1).max(80), relation: z.string().max(40), phone: z.string().max(30) })).max(10),
});
const childCreateSchema = z.object({
  firstName: z.string().min(1).max(40), lastName: z.string().min(1).max(40), birthday: z.string().min(4).max(20), classroomId: z.string(),
  guardianName: z.string().max(80).optional(), guardianPhone: z.string().max(30).optional(), allergies: z.array(z.string().max(40)).max(12).optional(),
  notes: z.string().max(400).optional(), authorizedPickup: z.array(z.string().max(80)).max(8).optional(),
});
const childUpdateSchema = z.object({
  firstName: z.string().min(1).max(40).optional(), lastName: z.string().min(1).max(40).optional(), classroomId: z.string().optional(),
  guardianName: z.string().max(80).optional(), guardianPhone: z.string().max(30).optional(), allergies: z.array(z.string().max(40)).max(12).optional(),
  notes: z.string().max(400).optional(), authorizedPickup: z.array(z.string().max(80)).max(8).optional(), medical: medicalSchema.optional(),
});
const enrollmentChildSchema = z.object({ name: z.string().min(1).max(80), birthday: z.string().min(4).max(20), classroomId: z.string() });
const enrollmentCreateSchema = z.object({
  guardianName: z.string().min(1).max(80), guardianEmail: z.string().email(), guardianPhone: z.string().max(30),
  children: z.array(enrollmentChildSchema).min(1).max(8), requestedStart: z.string().max(20), notes: z.string().max(400).optional(),
});
const enrollmentUpdateSchema = z.object({ status: z.enum(['inquiry', 'toured', 'waitlist', 'approved', 'enrolled', 'declined']).optional(), notes: z.string().max(400).optional() });
const credentialSchema = z.object({ name: z.string().min(1).max(80), issued: z.string().max(20), expires: z.string().max(20) });
const staffCreateSchema = z.object({ name: z.string().min(1).max(80), email: z.string().email(), title: z.string().max(60).optional(), phone: z.string().max(30).optional(), classroomIds: z.array(z.string()).max(6).optional(), credentials: z.array(credentialSchema).max(12).optional() });
const staffUpdateSchema = z.object({ title: z.string().max(60).optional(), phone: z.string().max(30).optional(), classroomIds: z.array(z.string()).max(6).optional(), credentials: z.array(credentialSchema).max(12).optional() });
const mealSchema = z.object({ date: z.string().min(8).max(10), meal: z.enum(['breakfast', 'lunch', 'snack']), childCount: z.number().int().min(0).max(500), adultCount: z.number().int().min(0).max(100) });
const eventSchema = z.object({ title: z.string().min(1).max(120), date: z.string().min(8).max(10), time: z.string().max(40).optional(), detail: z.string().max(300).optional(), attendees: z.number().int().min(0).max(1000).optional() });
// dataUrl length cap keeps uploads under Vercel's serverless body limit (~4.5 MB).
const documentSchema = z.object({ name: z.string().min(1).max(120), category: z.enum(['attendance', 'financial', 'medical', 'enrollment', 'licensing', 'curriculum', 'other']), contentType: z.string().min(1).max(100), size: z.number().int().min(0), dataUrl: z.string().startsWith('data:').max(4_200_000) });
const centerSchema = z.object({ name: z.string().min(1).max(100).optional(), address: z.string().max(160).optional(), phone: z.string().max(30).optional(), license: z.string().max(40).optional(), capacity: z.number().int().min(1).max(500).optional(), autoWeeklyBilling: z.boolean().optional() });
const ratesSchema = z.object({ registrationFee: z.number().int().min(0).max(10_000_000), weeklyTuition: z.number().int().min(0).max(10_000_000), lateFee: z.number().int().min(0).max(10_000_000), miscFee: z.number().int().min(0).max(10_000_000) });
const classroomCreateSchema = z.object({ name: z.string().min(1).max(60), ageRange: z.string().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), capacity: z.number().int().min(1).max(100), ratioLimit: z.number().int().min(1).max(30), rates: ratesSchema });
const classroomUpdateSchema = z.object({ name: z.string().min(1).max(60).optional(), ageRange: z.string().min(1).max(40).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), capacity: z.number().int().min(1).max(100).optional(), ratioLimit: z.number().int().min(1).max(30).optional(), rates: ratesSchema.optional() });
const invoiceCreateSchema = z.object({ childId: z.string(), amount: z.number().int().min(1).max(10_000_000), dueDate: z.string().min(8).max(10), description: z.string().min(1).max(120) });
const timeEntrySchema = z.object({ userId: z.string(), clockIn: z.string().datetime({ offset: true }), clockOut: z.string().datetime({ offset: true }) }).refine(body => new Date(body.clockOut).getTime() > new Date(body.clockIn).getTime(), { message: 'Clock-out must be after clock-in.' });
const recordPaymentSchema = z.object({ method: z.string().min(1).max(60) });
const inspectionCreateSchema = z.object({ date: z.string().min(8).max(10), type: z.enum(['annual', 'renewal', 'monitoring', 'follow_up', 'complaint']), inspector: z.string().min(1).max(80), status: z.enum(['scheduled', 'passed', 'findings', 'failed']), findings: z.number().int().min(0).max(200), notes: z.string().max(500) });
const inspectionUpdateSchema = inspectionCreateSchema.partial();
const complaintCreateSchema = z.object({ receivedOn: z.string().min(8).max(10), source: z.enum(['parent', 'staff', 'anonymous', 'state']), summary: z.string().min(1).max(500) });
const complaintUpdateSchema = z.object({ status: z.enum(['open', 'investigating', 'resolved', 'unfounded']).optional(), resolution: z.string().max(500).optional() });
const violationCreateSchema = z.object({ code: z.string().min(1).max(40), description: z.string().min(1).max(400), severity: z.enum(['low', 'moderate', 'serious']), citedOn: z.string().min(8).max(10), inspectionId: z.string().optional() });
const violationUpdateSchema = z.object({ status: z.enum(['open', 'corrected', 'verified']) });
const actionCreateSchema = z.object({ violationId: z.string().optional(), description: z.string().min(1).max(400), assignedTo: z.string().min(1).max(80), dueDate: z.string().min(8).max(10) });
const actionUpdateSchema = z.object({ status: z.enum(['open', 'in_progress', 'completed', 'verified']) });
const drillCreateSchema = z.object({ type: z.enum(['fire', 'tornado', 'lockdown', 'evacuation']), date: z.string().min(8).max(10), timeOfDay: z.string().min(1).max(20), durationMinutes: z.number().int().min(1).max(240), participants: z.number().int().min(0).max(500), notes: z.string().max(300).optional() });
const complianceCheckUpdateSchema = z.object({ status: z.enum(['compliant', 'action_needed', 'pending']) });

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// A child is "in someone's care" when the admin runs the center, the teacher
// covers the child's classroom, or the parent is one of the child's guardians.
function inCareOf(user: NonNullable<AuthRequest['user']>, child: { classroomId: string; guardianIds: string[] }): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return user.classroomIds.includes(child.classroomId);
  return child.guardianIds.includes(user.id);
}

// Keeps today's row in the attendance history in step with the live check-in board.
function syncTodayAttendanceLog(child: Child) {
  const log = store().attendanceLog;
  const index = log.findIndex(entry => entry.date === today() && entry.childId === child.id);
  if (child.attendanceStatus === 'expected') {
    if (index >= 0) log.splice(index, 1);
    return;
  }
  const entry = { id: `attendance-${today()}-${child.id}`, centerId: child.centerId, childId: child.id, date: today(), status: 'present' as const, checkedInAt: child.checkedInAt, checkedOutAt: child.checkedOutAt };
  if (index >= 0) log[index] = entry; else log.push(entry);
}

// Generates this week's tuition invoice for every enrolled child from their
// classroom's saved weekly rate. Idempotent: children already invoiced for the
// week are skipped, so it can run on demand or lazily on every dashboard load.
function runWeeklyBilling(centerId: string): { week: string; created: Invoice[] } {
  const data = store();
  const week = weekMondayOf();
  const dueDate = new Date(`${week}T12:00:00`);
  dueDate.setDate(dueDate.getDate() + 4);
  const created: Invoice[] = [];
  for (const child of data.children.filter(item => item.centerId === centerId)) {
    const room = data.classrooms.find(item => item.id === child.classroomId);
    if (!room || room.rates.weeklyTuition <= 0) continue;
    const description = `Weekly tuition — ${room.name} (week of ${new Date(`${week}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    if (data.invoices.some(invoice => invoice.childId === child.id && invoice.description === description)) continue;
    const invoice: Invoice = { id: uid('invoice'), centerId, guardianId: child.guardianIds[0] ?? '', childId: child.id, amount: room.rates.weeklyTuition, dueDate: dueDate.toISOString().slice(0, 10), status: 'due', description };
    data.invoices.push(invoice);
    created.push(invoice);
  }
  return { week, created };
}

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
  const enrollments = user.role === 'admin' ? data.enrollments : [];
  const meals = user.role === 'parent' ? [] : data.meals;
  const cacfpClaims = user.role === 'admin' ? data.cacfpClaims : [];
  const isAdmin = user.role === 'admin';
  // Document bytes stay out of the dashboard payload; GET /documents/:id serves them.
  const documents = user.role === 'parent' ? [] : data.documents.map(({ dataUrl: _dataUrl, ...meta }) => meta);
  const attendanceLog = data.attendanceLog.filter(entry => visibleChildIds.includes(entry.childId));
  const timeEntries = isAdmin ? data.timeEntries : user.role === 'teacher' ? data.timeEntries.filter(entry => entry.userId === user.id) : [];
  return {
    center: data.center, classrooms, children, activities: [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    messages: [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), invoices, curriculum, staff,
    enrollments, events: data.events, meals, cacfpClaims, documents, attendanceLog,
    inspections: isAdmin ? data.inspections : [], complaints: isAdmin ? data.complaints : [],
    violations: isAdmin ? data.violations : [], correctiveActions: isAdmin ? data.correctiveActions : [],
    drills: isAdmin ? data.drills : [], complianceChecks: isAdmin ? data.complianceChecks : [],
    timeEntries,
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
  app.use(express.json({ limit: '6mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Child Care Compass' }));

  app.post('/api/auth/login', (req, res) => {
    const body = parseBody(loginSchema, req.body, res);
    if (!body) return;
    const user = store().users.find(item => item.email.toLowerCase() === body.email.toLowerCase());
    if (!user || body.password !== 'demo123') return res.status(401).json({ error: 'invalid_credentials', message: 'That email and password do not match.' });
    return res.json({ token: signUser(user), user });
  });
  app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => res.json({ user: req.user }));
  app.get('/api/dashboard', authenticate, (req: AuthRequest, res) => {
    // Recurring billing: with auto-billing on, the week's tuition invoices
    // materialize lazily on any dashboard load — no scheduler required.
    if (store().center.autoWeeklyBilling) {
      const { created } = runWeeklyBilling(req.user!.centerId);
      if (created.length) broadcast('invoice:updated', { generated: created.length });
    }
    return res.json(scopedDashboard(req.user!));
  });

  app.patch('/api/attendance/:childId', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(attendanceSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === req.params.childId && item.centerId === req.user!.centerId);
    if (!child || (req.user!.role === 'teacher' && !req.user!.classroomIds.includes(child.classroomId))) return res.status(404).json({ error: 'not_found', message: 'Child not found in your classroom.' });
    child.attendanceStatus = body.status as AttendanceStatus;
    if (body.status === 'present') { child.checkedInAt = new Date().toISOString(); child.checkedOutAt = undefined; }
    if (body.status === 'went_home') child.checkedOutAt = new Date().toISOString();
    if (body.status === 'expected') { child.checkedInAt = undefined; child.checkedOutAt = undefined; }
    syncTodayAttendanceLog(child);
    broadcast('attendance:updated', child);
    return res.json(child);
  });

  app.post('/api/activities', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(activitySchema, req.body, res);
    if (!body) return;
    const children = store().children.filter(child => body.childIds.includes(child.id) && child.centerId === req.user!.centerId);
    if (children.length !== body.childIds.length || (req.user!.role === 'teacher' && children.some(child => !req.user!.classroomIds.includes(child.classroomId)))) return res.status(403).json({ error: 'forbidden', message: 'One or more selected children are outside your classroom.' });
    const activity: Activity = { id: uid('activity'), centerId: req.user!.centerId, classroomId: children[0]!.classroomId, childIds: body.childIds, authorId: req.user!.id, authorName: req.user!.name, type: body.type, title: body.title, body: body.body, value: body.value, mediaUrl: body.mediaUrl, createdAt: new Date().toISOString(), likedBy: [] };
    store().activities.unshift(activity);
    broadcast('activity:created', activity);
    return res.status(201).json(activity);
  });
  app.patch('/api/activities/:activityId/like', authenticate, (req: AuthRequest, res) => {
    const activity = store().activities.find(item => item.id === req.params.activityId && item.centerId === req.user!.centerId);
    const visible = activity && (req.user!.role === 'admin'
      || (req.user!.role === 'teacher' && req.user!.classroomIds.includes(activity.classroomId))
      || (req.user!.role === 'parent' && activity.childIds.some(id => req.user!.childIds.includes(id))));
    if (!activity || !visible) return res.status(404).json({ error: 'not_found', message: 'Moment not found.' });
    activity.likedBy = activity.likedBy.includes(req.user!.id) ? activity.likedBy.filter(id => id !== req.user!.id) : [...activity.likedBy, req.user!.id];
    broadcast('activity:updated', activity);
    return res.json(activity);
  });

  app.post('/api/messages', authenticate, (req: AuthRequest, res) => {
    const body = parseBody(messageSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === body.childId && item.centerId === req.user!.centerId);
    if (!child || !inCareOf(req.user!, child)) return res.status(404).json({ error: 'not_found', message: 'Child conversation not found.' });
    const classroom = store().classrooms.find(room => room.id === child.classroomId);
    const recipientIds = req.user!.role === 'parent' ? classroom?.teacherIds ?? [] : child.guardianIds;
    const message: Message = { id: uid('message'), centerId: req.user!.centerId, childId: child.id, senderId: req.user!.id, recipientIds, body: body.body, createdAt: new Date().toISOString(), readBy: [req.user!.id] };
    store().messages.push(message);
    broadcast('message:created', message);
    return res.status(201).json(message);
  });
  app.patch('/api/messages/:messageId/read', authenticate, (req: AuthRequest, res) => {
    const message = store().messages.find(item => item.id === req.params.messageId && item.centerId === req.user!.centerId);
    const involved = message && (req.user!.role === 'admin' || message.senderId === req.user!.id || message.recipientIds.includes(req.user!.id));
    if (!message || !involved) return res.status(404).json({ error: 'not_found', message: 'Message not found.' });
    if (!message.readBy.includes(req.user!.id)) message.readBy.push(req.user!.id);
    return res.json(message);
  });

  app.post('/api/invoices/:invoiceId/pay', authenticate, allow('admin', 'parent'), (req: AuthRequest, res) => {
    const invoice = store().invoices.find(item => item.id === req.params.invoiceId && item.centerId === req.user!.centerId && (req.user!.role === 'admin' || item.guardianId === req.user!.id));
    if (!invoice) return res.status(404).json({ error: 'not_found', message: 'Invoice not found.' });
    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.method = invoice.method ?? 'Card on file';
    broadcast('invoice:updated', invoice);
    return res.json(invoice);
  });

  app.post('/api/invoices', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(invoiceCreateSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === body.childId && item.centerId === req.user!.centerId);
    if (!child) return res.status(404).json({ error: 'not_found', message: 'Child not found.' });
    const invoice: Invoice = { id: uid('invoice'), centerId: req.user!.centerId, guardianId: child.guardianIds[0] ?? '', childId: child.id, amount: body.amount, dueDate: body.dueDate, status: 'due', description: body.description };
    store().invoices.push(invoice);
    broadcast('invoice:updated', invoice);
    return res.status(201).json(invoice);
  });

  app.post('/api/invoices/:invoiceId/record-payment', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(recordPaymentSchema, req.body, res);
    if (!body) return;
    const invoice = store().invoices.find(item => item.id === req.params.invoiceId && item.centerId === req.user!.centerId);
    if (!invoice) return res.status(404).json({ error: 'not_found', message: 'Invoice not found.' });
    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.method = body.method;
    broadcast('invoice:updated', invoice);
    return res.json(invoice);
  });

  app.post('/api/children', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(childCreateSchema, req.body, res);
    if (!body) return;
    const classroom = store().classrooms.find(room => room.id === body.classroomId && room.centerId === req.user!.centerId);
    if (!classroom) return res.status(404).json({ error: 'not_found', message: 'Classroom not found.' });
    const child: Child = {
      id: uid('child'), centerId: req.user!.centerId, classroomId: classroom.id, guardianIds: [],
      firstName: body.firstName, lastName: body.lastName, birthday: body.birthday, avatar: 'sky',
      allergies: body.allergies ?? [], notes: body.notes ?? 'New to Bright Path — getting settled in.',
      attendanceStatus: 'expected', authorizedPickup: body.authorizedPickup?.length ? body.authorizedPickup : [body.guardianName || 'Guardian'],
      enrolledOn: today(), guardianName: body.guardianName, guardianPhone: body.guardianPhone,
      medical: { physician: '', physicianPhone: '', conditions: body.allergies?.length ? `Allergy: ${body.allergies.join(', ')}` : 'None reported', medications: 'None', lastPhysical: '', immunizations: [], emergencyContacts: body.guardianName ? [{ name: body.guardianName, relation: 'Parent', phone: body.guardianPhone ?? '' }] : [] },
    };
    store().children.push(child);
    // New enrollments are billed their classroom's registration fee automatically.
    if (classroom.rates.registrationFee > 0) {
      const due = new Date(); due.setDate(due.getDate() + 14);
      store().invoices.push({ id: uid('invoice'), centerId: req.user!.centerId, guardianId: '', childId: child.id, amount: classroom.rates.registrationFee, dueDate: due.toISOString().slice(0, 10), status: 'due', description: `Registration fee — ${classroom.name}` });
    }
    broadcast('data:updated', { type: 'child', id: child.id });
    return res.status(201).json(child);
  });

  app.patch('/api/children/:childId', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(childUpdateSchema, req.body, res);
    if (!body) return;
    const child = store().children.find(item => item.id === req.params.childId && item.centerId === req.user!.centerId);
    if (!child || (req.user!.role === 'teacher' && !req.user!.classroomIds.includes(child.classroomId))) return res.status(404).json({ error: 'not_found', message: 'Child not found in your classroom.' });
    if (body.classroomId && !store().classrooms.some(room => room.id === body.classroomId && room.centerId === req.user!.centerId)) return res.status(404).json({ error: 'not_found', message: 'Classroom not found.' });
    Object.assign(child, body);
    broadcast('data:updated', { type: 'child', id: child.id });
    return res.json(child);
  });

  app.post('/api/enrollments', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(enrollmentCreateSchema, req.body, res);
    if (!body) return;
    if (!body.children.every(child => store().classrooms.some(room => room.id === child.classroomId && room.centerId === req.user!.centerId))) return res.status(404).json({ error: 'not_found', message: 'Classroom not found.' });
    const application: EnrollmentApplication = { id: uid('enrollment'), centerId: req.user!.centerId, status: 'inquiry', submittedAt: new Date().toISOString(), notes: body.notes ?? '', ...body };
    store().enrollments.unshift(application);
    broadcast('data:updated', { type: 'enrollment', id: application.id });
    return res.status(201).json(application);
  });

  // A sibling joins the family's existing application instead of starting a new one.
  app.post('/api/enrollments/:enrollmentId/children', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(enrollmentChildSchema, req.body, res);
    if (!body) return;
    const application = store().enrollments.find(item => item.id === req.params.enrollmentId && item.centerId === req.user!.centerId);
    if (!application) return res.status(404).json({ error: 'not_found', message: 'Application not found.' });
    if (application.status === 'enrolled' || application.status === 'declined') return res.status(409).json({ error: 'conflict', message: 'This application is closed — start a new one for this family.' });
    if (!store().classrooms.some(room => room.id === body.classroomId && room.centerId === req.user!.centerId)) return res.status(404).json({ error: 'not_found', message: 'Classroom not found.' });
    application.children.push(body);
    broadcast('data:updated', { type: 'enrollment', id: application.id });
    return res.status(201).json(application);
  });

  app.patch('/api/enrollments/:enrollmentId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(enrollmentUpdateSchema, req.body, res);
    if (!body) return;
    const application = store().enrollments.find(item => item.id === req.params.enrollmentId && item.centerId === req.user!.centerId);
    if (!application) return res.status(404).json({ error: 'not_found', message: 'Application not found.' });
    if (body.notes !== undefined) application.notes = body.notes;
    if (body.status && body.status !== application.status) {
      application.status = body.status;
      // Enrolling the family creates a record for every child on the
      // application, each in their requested room, billed their room's
      // registration fee, and all sharing the same guardian file.
      if (body.status === 'enrolled') {
        for (const enrollee of application.children) {
          const [firstName, ...rest] = enrollee.name.split(' ');
          const child: Child = {
            id: uid('child'), centerId: req.user!.centerId, classroomId: enrollee.classroomId, guardianIds: [],
            firstName: firstName || enrollee.name, lastName: rest.join(' ') || '—', birthday: enrollee.birthday, avatar: 'mint',
            allergies: [], notes: 'Newly enrolled — welcome packet in progress.', attendanceStatus: 'expected',
            authorizedPickup: [application.guardianName], enrolledOn: today(), guardianName: application.guardianName, guardianPhone: application.guardianPhone,
            medical: { physician: '', physicianPhone: '', conditions: 'None reported', medications: 'None', lastPhysical: '', immunizations: [], emergencyContacts: [{ name: application.guardianName, relation: 'Parent', phone: application.guardianPhone }] },
          };
          store().children.push(child);
          const room = store().classrooms.find(item => item.id === enrollee.classroomId);
          if (room && room.rates.registrationFee > 0) {
            const due = new Date(); due.setDate(due.getDate() + 14);
            store().invoices.push({ id: uid('invoice'), centerId: req.user!.centerId, guardianId: '', childId: child.id, amount: room.rates.registrationFee, dueDate: due.toISOString().slice(0, 10), status: 'due', description: `Registration fee — ${room.name}` });
          }
        }
      }
    }
    broadcast('data:updated', { type: 'enrollment', id: application.id });
    return res.json(application);
  });

  app.post('/api/staff', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(staffCreateSchema, req.body, res);
    if (!body) return;
    if (store().users.some(user => user.email.toLowerCase() === body.email.toLowerCase())) return res.status(409).json({ error: 'conflict', message: 'A team member with that email already exists.' });
    const member: User = {
      id: uid('user'), centerId: req.user!.centerId, name: body.name, email: body.email, role: 'teacher',
      avatar: body.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(),
      classroomIds: body.classroomIds ?? [], childIds: [], title: body.title ?? 'Teacher', phone: body.phone, hiredOn: today(), credentials: body.credentials ?? [],
    };
    store().users.push(member);
    member.classroomIds.forEach(roomId => { const room = store().classrooms.find(item => item.id === roomId); if (room && !room.teacherIds.includes(member.id)) room.teacherIds.push(member.id); });
    broadcast('data:updated', { type: 'staff', id: member.id });
    return res.status(201).json(member);
  });

  app.patch('/api/staff/:staffId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(staffUpdateSchema, req.body, res);
    if (!body) return;
    const member = store().users.find(user => user.id === req.params.staffId && user.centerId === req.user!.centerId && user.role !== 'parent');
    if (!member) return res.status(404).json({ error: 'not_found', message: 'Team member not found.' });
    if (body.classroomIds) {
      store().classrooms.forEach(room => { room.teacherIds = room.teacherIds.filter(id => id !== member.id); if (body.classroomIds!.includes(room.id)) room.teacherIds.push(member.id); });
      member.classroomIds = body.classroomIds;
    }
    if (body.title !== undefined) member.title = body.title;
    if (body.phone !== undefined) member.phone = body.phone;
    if (body.credentials !== undefined) member.credentials = body.credentials;
    broadcast('data:updated', { type: 'staff', id: member.id });
    return res.json(member);
  });

  app.post('/api/meals', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(mealSchema, req.body, res);
    if (!body) return;
    const meals = store().meals;
    const existing = meals.find(record => record.date === body.date && record.meal === body.meal && record.centerId === req.user!.centerId);
    const record: MealRecord = { id: existing?.id ?? uid('meal'), centerId: req.user!.centerId, date: body.date, meal: body.meal, childCount: body.childCount, adultCount: body.adultCount, recordedBy: req.user!.name };
    if (existing) Object.assign(existing, record); else meals.push(record);
    broadcast('data:updated', { type: 'meal', id: record.id });
    return res.status(existing ? 200 : 201).json(record);
  });

  app.post('/api/events', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(eventSchema, req.body, res);
    if (!body) return;
    const event: CenterEvent = { id: uid('event'), centerId: req.user!.centerId, ...body };
    store().events.push(event);
    store().events.sort((a, b) => a.date.localeCompare(b.date));
    broadcast('data:updated', { type: 'event', id: event.id });
    return res.status(201).json(event);
  });

  app.delete('/api/events/:eventId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const events = store().events;
    const index = events.findIndex(event => event.id === req.params.eventId && event.centerId === req.user!.centerId);
    if (index < 0) return res.status(404).json({ error: 'not_found', message: 'Event not found.' });
    const [removed] = events.splice(index, 1);
    broadcast('data:updated', { type: 'event', id: removed!.id });
    return res.json(removed);
  });

  app.post('/api/documents', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const body = parseBody(documentSchema, req.body, res);
    if (!body) return;
    const document: CenterDocumentFile = { id: uid('document'), centerId: req.user!.centerId, uploadedBy: req.user!.name, uploadedAt: new Date().toISOString(), ...body };
    store().documents.unshift(document);
    broadcast('data:updated', { type: 'document', id: document.id });
    const { dataUrl: _dataUrl, ...meta } = document;
    return res.status(201).json(meta);
  });

  app.get('/api/documents/:documentId', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const document = store().documents.find(item => item.id === req.params.documentId && item.centerId === req.user!.centerId);
    if (!document) return res.status(404).json({ error: 'not_found', message: 'Document not found.' });
    return res.json(document);
  });

  app.delete('/api/documents/:documentId', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const documents = store().documents;
    const index = documents.findIndex(item => item.id === req.params.documentId && item.centerId === req.user!.centerId);
    if (index < 0) return res.status(404).json({ error: 'not_found', message: 'Document not found.' });
    if (req.user!.role === 'teacher' && documents[index]!.uploadedBy !== req.user!.name) return res.status(403).json({ error: 'forbidden', message: 'Teachers can only remove documents they uploaded.' });
    const [removed] = documents.splice(index, 1);
    broadcast('data:updated', { type: 'document', id: removed!.id });
    const { dataUrl: _dataUrl, ...meta } = removed!;
    return res.json(meta);
  });

  app.post('/api/inspections', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(inspectionCreateSchema, req.body, res);
    if (!body) return;
    const inspection: Inspection = { id: uid('inspection'), centerId: req.user!.centerId, ...body };
    store().inspections.push(inspection);
    store().inspections.sort((a, b) => b.date.localeCompare(a.date));
    broadcast('data:updated', { type: 'inspection', id: inspection.id });
    return res.status(201).json(inspection);
  });

  app.patch('/api/inspections/:inspectionId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(inspectionUpdateSchema, req.body, res);
    if (!body) return;
    const inspection = store().inspections.find(item => item.id === req.params.inspectionId && item.centerId === req.user!.centerId);
    if (!inspection) return res.status(404).json({ error: 'not_found', message: 'Inspection not found.' });
    Object.assign(inspection, body);
    broadcast('data:updated', { type: 'inspection', id: inspection.id });
    return res.json(inspection);
  });

  app.post('/api/complaints', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(complaintCreateSchema, req.body, res);
    if (!body) return;
    const complaint: Complaint = { id: uid('complaint'), centerId: req.user!.centerId, status: 'open', resolution: '', ...body };
    store().complaints.unshift(complaint);
    broadcast('data:updated', { type: 'complaint', id: complaint.id });
    return res.status(201).json(complaint);
  });

  app.patch('/api/complaints/:complaintId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(complaintUpdateSchema, req.body, res);
    if (!body) return;
    const complaint = store().complaints.find(item => item.id === req.params.complaintId && item.centerId === req.user!.centerId);
    if (!complaint) return res.status(404).json({ error: 'not_found', message: 'Complaint not found.' });
    Object.assign(complaint, body);
    broadcast('data:updated', { type: 'complaint', id: complaint.id });
    return res.json(complaint);
  });

  app.post('/api/violations', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(violationCreateSchema, req.body, res);
    if (!body) return;
    const violation: Violation = { id: uid('violation'), centerId: req.user!.centerId, status: 'open', ...body };
    store().violations.unshift(violation);
    broadcast('data:updated', { type: 'violation', id: violation.id });
    return res.status(201).json(violation);
  });

  app.patch('/api/violations/:violationId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(violationUpdateSchema, req.body, res);
    if (!body) return;
    const violation = store().violations.find(item => item.id === req.params.violationId && item.centerId === req.user!.centerId);
    if (!violation) return res.status(404).json({ error: 'not_found', message: 'Violation not found.' });
    violation.status = body.status;
    broadcast('data:updated', { type: 'violation', id: violation.id });
    return res.json(violation);
  });

  app.post('/api/corrective-actions', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(actionCreateSchema, req.body, res);
    if (!body) return;
    const action: CorrectiveAction = { id: uid('action'), centerId: req.user!.centerId, status: 'open', ...body };
    store().correctiveActions.unshift(action);
    broadcast('data:updated', { type: 'corrective_action', id: action.id });
    return res.status(201).json(action);
  });

  app.patch('/api/corrective-actions/:actionId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(actionUpdateSchema, req.body, res);
    if (!body) return;
    const action = store().correctiveActions.find(item => item.id === req.params.actionId && item.centerId === req.user!.centerId);
    if (!action) return res.status(404).json({ error: 'not_found', message: 'Corrective action not found.' });
    action.status = body.status;
    action.completedOn = body.status === 'completed' || body.status === 'verified' ? (action.completedOn ?? today()) : undefined;
    broadcast('data:updated', { type: 'corrective_action', id: action.id });
    return res.json(action);
  });

  app.post('/api/drills', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(drillCreateSchema, req.body, res);
    if (!body) return;
    const drill: EmergencyDrill = { id: uid('drill'), centerId: req.user!.centerId, conductedBy: req.user!.name, ...body };
    store().drills.unshift(drill);
    store().drills.sort((a, b) => b.date.localeCompare(a.date));
    broadcast('data:updated', { type: 'drill', id: drill.id });
    return res.status(201).json(drill);
  });

  app.patch('/api/compliance-checks/:checkId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(complianceCheckUpdateSchema, req.body, res);
    if (!body) return;
    const check = store().complianceChecks.find(item => item.id === req.params.checkId && item.centerId === req.user!.centerId);
    if (!check) return res.status(404).json({ error: 'not_found', message: 'Checklist item not found.' });
    check.status = body.status;
    check.lastChecked = today();
    broadcast('data:updated', { type: 'compliance_check', id: check.id });
    return res.json(check);
  });

  app.post('/api/time-clock/clock-in', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const open = store().timeEntries.find(entry => entry.userId === req.user!.id && !entry.clockOut);
    if (open) return res.status(409).json({ error: 'conflict', message: 'You are already on the clock — clock out first.' });
    const entry: TimeEntry = { id: uid('time'), centerId: req.user!.centerId, userId: req.user!.id, date: today(), clockIn: new Date().toISOString() };
    store().timeEntries.push(entry);
    broadcast('data:updated', { type: 'time_entry', id: entry.id });
    return res.status(201).json(entry);
  });

  app.post('/api/time-clock/clock-out', authenticate, allow('admin', 'teacher'), (req: AuthRequest, res) => {
    const open = store().timeEntries.find(entry => entry.userId === req.user!.id && !entry.clockOut);
    if (!open) return res.status(409).json({ error: 'conflict', message: 'You are not clocked in right now.' });
    open.clockOut = new Date().toISOString();
    broadcast('data:updated', { type: 'time_entry', id: open.id });
    return res.json(open);
  });

  // Admin corrections: add a missed shift or remove a bad punch.
  app.post('/api/time-clock/entries', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(timeEntrySchema, req.body, res);
    if (!body) return;
    const member = store().users.find(user => user.id === body.userId && user.centerId === req.user!.centerId && user.role !== 'parent');
    if (!member) return res.status(404).json({ error: 'not_found', message: 'Team member not found.' });
    const entry: TimeEntry = { id: uid('time'), centerId: req.user!.centerId, userId: member.id, date: body.clockIn.slice(0, 10), clockIn: body.clockIn, clockOut: body.clockOut };
    store().timeEntries.push(entry);
    broadcast('data:updated', { type: 'time_entry', id: entry.id });
    return res.status(201).json(entry);
  });

  app.delete('/api/time-clock/entries/:entryId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const entries = store().timeEntries;
    const index = entries.findIndex(entry => entry.id === req.params.entryId && entry.centerId === req.user!.centerId);
    if (index < 0) return res.status(404).json({ error: 'not_found', message: 'Time entry not found.' });
    const [removed] = entries.splice(index, 1);
    broadcast('data:updated', { type: 'time_entry', id: removed!.id });
    return res.json(removed);
  });

  app.post('/api/classrooms', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(classroomCreateSchema, req.body, res);
    if (!body) return;
    const palette = ['#f2789f', '#14b8a6', '#5a8dee', '#8b5cf6', '#f59e0b', '#22c55e'];
    const room: Classroom = { id: uid('room'), centerId: req.user!.centerId, teacherIds: [], color: body.color ?? palette[store().classrooms.length % palette.length]!, ...body };
    store().classrooms.push(room);
    broadcast('data:updated', { type: 'classroom', id: room.id });
    return res.status(201).json(room);
  });

  app.patch('/api/classrooms/:classroomId', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(classroomUpdateSchema, req.body, res);
    if (!body) return;
    const room = store().classrooms.find(item => item.id === req.params.classroomId && item.centerId === req.user!.centerId);
    if (!room) return res.status(404).json({ error: 'not_found', message: 'Classroom not found.' });
    Object.assign(room, body);
    broadcast('data:updated', { type: 'classroom', id: room.id });
    return res.json(room);
  });

  app.post('/api/billing/run-weekly', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const { week, created } = runWeeklyBilling(req.user!.centerId);
    if (created.length) broadcast('invoice:updated', { generated: created.length });
    return res.json({ week, created: created.length });
  });

  app.patch('/api/center', authenticate, allow('admin'), (req: AuthRequest, res) => {
    const body = parseBody(centerSchema, req.body, res);
    if (!body) return;
    Object.assign(store().center, body);
    broadcast('data:updated', { type: 'center', id: store().center.id });
    return res.json(store().center);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found', message: 'That route does not exist.' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  });
  return { app };
}
