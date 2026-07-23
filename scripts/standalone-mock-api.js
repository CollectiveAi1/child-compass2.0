// In-browser Child Compass API for the standalone demo file. Mirrors the
// Express routes in apps/api/src/app.ts against the seeded demo store so the
// full app runs from a single double-clickable HTML file — no server needed.
(() => {
  const db = window.__COMPASS_SEED__;
  const uid = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const weekMondayOf = () => {
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  // Mirrors the server's recurring tuition generator: one invoice per child per
  // week from their classroom's saved weekly rate, idempotent by description.
  function runWeeklyBilling(centerId) {
    const week = weekMondayOf();
    const dueDate = new Date(`${week}T12:00:00`);
    dueDate.setDate(dueDate.getDate() + 4);
    const created = [];
    for (const child of db.children) {
      const room = db.classrooms.find(item => item.id === child.classroomId);
      if (!room || room.rates.weeklyTuition <= 0) continue;
      const description = `Weekly tuition — ${room.name} (week of ${new Date(`${week}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      if (db.invoices.some(invoice => invoice.childId === child.id && invoice.description === description)) continue;
      const invoice = { id: uid('invoice'), centerId, guardianId: child.guardianIds[0] || '', childId: child.id, amount: room.rates.weeklyTuition, dueDate: dueDate.toISOString().slice(0, 10), status: 'due', description };
      db.invoices.push(invoice);
      created.push(invoice);
    }
    return { week, created };
  }
  const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  const notFound = message => json({ error: 'not_found', message }, 404);
  const forbidden = message => json({ error: 'forbidden', message }, 403);

  function userFromToken(headers) {
    const raw = headers?.Authorization || headers?.authorization || '';
    const id = String(raw).replace(/^Bearer\s+demo-token-/i, '');
    return db.users.find(user => user.id === id);
  }

  function inCareOf(user, child) {
    if (user.role === 'admin') return true;
    if (user.role === 'teacher') return user.classroomIds.includes(child.classroomId);
    return child.guardianIds.includes(user.id);
  }

  function syncTodayAttendanceLog(child) {
    const index = db.attendanceLog.findIndex(entry => entry.date === today() && entry.childId === child.id);
    if (child.attendanceStatus === 'expected') { if (index >= 0) db.attendanceLog.splice(index, 1); return; }
    const entry = { id: `attendance-${today()}-${child.id}`, centerId: child.centerId, childId: child.id, date: today(), status: 'present', checkedInAt: child.checkedInAt, checkedOutAt: child.checkedOutAt };
    if (index >= 0) db.attendanceLog[index] = entry; else db.attendanceLog.push(entry);
  }

  function scopedDashboard(user) {
    const childIds = user.role === 'parent' ? user.childIds : [];
    const classrooms = user.role === 'teacher' ? db.classrooms.filter(room => user.classroomIds.includes(room.id))
      : user.role === 'parent' ? db.classrooms.filter(room => db.children.some(child => childIds.includes(child.id) && child.classroomId === room.id))
      : db.classrooms;
    const roomIds = classrooms.map(room => room.id);
    const children = user.role === 'parent' ? db.children.filter(child => childIds.includes(child.id))
      : user.role === 'teacher' ? db.children.filter(child => roomIds.includes(child.classroomId))
      : db.children;
    const visibleChildIds = children.map(child => child.id);
    const activities = db.activities.filter(activity => activity.childIds.some(id => visibleChildIds.includes(id)));
    const messages = db.messages.filter(message => user.role === 'admin' || message.senderId === user.id || message.recipientIds.includes(user.id) || visibleChildIds.includes(message.childId));
    const invoices = user.role === 'admin' ? db.invoices : user.role === 'parent' ? db.invoices.filter(invoice => invoice.guardianId === user.id) : [];
    const curriculum = user.role === 'parent' ? [] : db.curriculum.filter(item => user.role === 'admin' || roomIds.includes(item.classroomId));
    const staff = user.role === 'admin' ? db.users.filter(item => item.role !== 'parent') : db.users.filter(item => item.role === 'teacher' && item.classroomIds.some(id => roomIds.includes(id)));
    const revenueCollected = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
    const revenueOutstanding = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
    return {
      center: db.center, classrooms, children,
      activities: [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      messages: [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      invoices, curriculum, staff,
      enrollments: user.role === 'admin' ? db.enrollments : [],
      events: db.events,
      meals: user.role === 'parent' ? [] : db.meals,
      cacfpClaims: user.role === 'admin' ? db.cacfpClaims : [],
      documents: user.role === 'parent' ? [] : db.documents.map(({ dataUrl, ...meta }) => meta),
      attendanceLog: db.attendanceLog.filter(entry => visibleChildIds.includes(entry.childId)),
      timeEntries: user.role === 'admin' ? db.timeEntries : user.role === 'teacher' ? db.timeEntries.filter(entry => entry.userId === user.id) : [],
      inspections: user.role === 'admin' ? db.inspections : [],
      complaints: user.role === 'admin' ? db.complaints : [],
      violations: user.role === 'admin' ? db.violations : [],
      correctiveActions: user.role === 'admin' ? db.correctiveActions : [],
      drills: user.role === 'admin' ? db.drills : [],
      complianceChecks: user.role === 'admin' ? db.complianceChecks : [],
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

  function handle(method, path, body, headers) {
    if (path === '/auth/login' && method === 'POST') {
      const user = db.users.find(item => item.email.toLowerCase() === String(body.email || '').toLowerCase());
      if (!user || body.password !== 'demo123') return json({ error: 'invalid_credentials', message: 'That email and password do not match.' }, 401);
      return json({ token: `demo-token-${user.id}`, user });
    }
    const user = userFromToken(headers);
    if (!user) return json({ error: 'unauthorized', message: 'Please sign in to continue.' }, 401);

    if (path === '/auth/me' && method === 'GET') return json({ user });
    if (path === '/dashboard' && method === 'GET') {
      if (db.center.autoWeeklyBilling) runWeeklyBilling(user.centerId);
      return json(scopedDashboard(user));
    }

    let match;
    if ((match = path.match(/^\/attendance\/([^/]+)$/)) && method === 'PATCH') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const child = db.children.find(item => item.id === match[1]);
      if (!child || (user.role === 'teacher' && !user.classroomIds.includes(child.classroomId))) return notFound('Child not found in your classroom.');
      child.attendanceStatus = body.status;
      if (body.status === 'present') { child.checkedInAt = new Date().toISOString(); child.checkedOutAt = undefined; }
      if (body.status === 'went_home') child.checkedOutAt = new Date().toISOString();
      if (body.status === 'expected') { child.checkedInAt = undefined; child.checkedOutAt = undefined; }
      syncTodayAttendanceLog(child);
      return json(child);
    }
    if (path === '/activities' && method === 'POST') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const children = db.children.filter(child => body.childIds.includes(child.id));
      if (children.length !== body.childIds.length || (user.role === 'teacher' && children.some(child => !user.classroomIds.includes(child.classroomId)))) return forbidden('One or more selected children are outside your classroom.');
      const activity = { id: uid('activity'), centerId: user.centerId, classroomId: children[0].classroomId, childIds: body.childIds, authorId: user.id, authorName: user.name, type: body.type, title: body.title, body: body.body, value: body.value, mediaUrl: body.mediaUrl, createdAt: new Date().toISOString(), likedBy: [] };
      db.activities.unshift(activity);
      return json(activity, 201);
    }
    if ((match = path.match(/^\/activities\/([^/]+)\/like$/)) && method === 'PATCH') {
      const activity = db.activities.find(item => item.id === match[1]);
      const visible = activity && (user.role === 'admin' || (user.role === 'teacher' && user.classroomIds.includes(activity.classroomId)) || (user.role === 'parent' && activity.childIds.some(id => user.childIds.includes(id))));
      if (!activity || !visible) return notFound('Moment not found.');
      activity.likedBy = activity.likedBy.includes(user.id) ? activity.likedBy.filter(id => id !== user.id) : [...activity.likedBy, user.id];
      return json(activity);
    }
    if (path === '/messages' && method === 'POST') {
      const child = db.children.find(item => item.id === body.childId);
      if (!child || !inCareOf(user, child)) return notFound('Child conversation not found.');
      const classroom = db.classrooms.find(room => room.id === child.classroomId);
      const recipientIds = user.role === 'parent' ? (classroom ? classroom.teacherIds : []) : child.guardianIds;
      const message = { id: uid('message'), centerId: user.centerId, childId: child.id, senderId: user.id, recipientIds, body: body.body, createdAt: new Date().toISOString(), readBy: [user.id] };
      db.messages.push(message);
      return json(message, 201);
    }
    if ((match = path.match(/^\/messages\/([^/]+)\/read$/)) && method === 'PATCH') {
      const message = db.messages.find(item => item.id === match[1]);
      const involved = message && (user.role === 'admin' || message.senderId === user.id || message.recipientIds.includes(user.id));
      if (!message || !involved) return notFound('Message not found.');
      if (!message.readBy.includes(user.id)) message.readBy.push(user.id);
      return json(message);
    }
    if ((match = path.match(/^\/invoices\/([^/]+)\/pay$/)) && method === 'POST') {
      const invoice = db.invoices.find(item => item.id === match[1] && (user.role === 'admin' || item.guardianId === user.id));
      if (!invoice) return notFound('Invoice not found.');
      invoice.status = 'paid'; invoice.paidAt = new Date().toISOString(); invoice.method = invoice.method || 'Card on file';
      return json(invoice);
    }
    if ((match = path.match(/^\/invoices\/([^/]+)\/record-payment$/)) && method === 'POST' && user.role === 'admin') {
      const invoice = db.invoices.find(item => item.id === match[1]);
      if (!invoice) return notFound('Invoice not found.');
      invoice.status = 'paid'; invoice.paidAt = new Date().toISOString(); invoice.method = body.method;
      return json(invoice);
    }
    if (path === '/invoices' && method === 'POST' && user.role === 'admin') {
      const child = db.children.find(item => item.id === body.childId);
      if (!child) return notFound('Child not found.');
      const invoice = { id: uid('invoice'), centerId: user.centerId, guardianId: child.guardianIds[0] || '', childId: child.id, amount: body.amount, dueDate: body.dueDate, status: 'due', description: body.description };
      db.invoices.push(invoice);
      return json(invoice, 201);
    }
    if (path === '/children' && method === 'POST' && user.role === 'admin') {
      const classroom = db.classrooms.find(room => room.id === body.classroomId);
      if (!classroom) return notFound('Classroom not found.');
      const child = {
        id: uid('child'), centerId: user.centerId, classroomId: classroom.id, guardianIds: [],
        firstName: body.firstName, lastName: body.lastName, birthday: body.birthday, avatar: 'sky',
        allergies: body.allergies || [], notes: body.notes || 'New to Bright Path — getting settled in.',
        attendanceStatus: 'expected', authorizedPickup: (body.authorizedPickup && body.authorizedPickup.length) ? body.authorizedPickup : [body.guardianName || 'Guardian'],
        enrolledOn: today(), guardianName: body.guardianName, guardianPhone: body.guardianPhone,
        medical: { physician: '', physicianPhone: '', conditions: (body.allergies || []).length ? `Allergy: ${body.allergies.join(', ')}` : 'None reported', medications: 'None', lastPhysical: '', immunizations: [], emergencyContacts: body.guardianName ? [{ name: body.guardianName, relation: 'Parent', phone: body.guardianPhone || '' }] : [] },
      };
      db.children.push(child);
      if (classroom.rates.registrationFee > 0) {
        const due = new Date(); due.setDate(due.getDate() + 14);
        db.invoices.push({ id: uid('invoice'), centerId: user.centerId, guardianId: '', childId: child.id, amount: classroom.rates.registrationFee, dueDate: due.toISOString().slice(0, 10), status: 'due', description: `Registration fee — ${classroom.name}` });
      }
      return json(child, 201);
    }
    if ((match = path.match(/^\/children\/([^/]+)$/)) && method === 'PATCH') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const child = db.children.find(item => item.id === match[1]);
      if (!child || (user.role === 'teacher' && !user.classroomIds.includes(child.classroomId))) return notFound('Child not found in your classroom.');
      Object.assign(child, body);
      return json(child);
    }
    if (path === '/enrollments' && method === 'POST' && user.role === 'admin') {
      const application = { id: uid('enrollment'), centerId: user.centerId, status: 'inquiry', submittedAt: new Date().toISOString(), notes: body.notes || '', ...body };
      db.enrollments.unshift(application);
      return json(application, 201);
    }
    if ((match = path.match(/^\/enrollments\/([^/]+)\/children$/)) && method === 'POST' && user.role === 'admin') {
      const application = db.enrollments.find(item => item.id === match[1]);
      if (!application) return notFound('Application not found.');
      if (application.status === 'enrolled' || application.status === 'declined') return json({ error: 'conflict', message: 'This application is closed — start a new one for this family.' }, 409);
      application.children.push(body);
      return json(application, 201);
    }
    if ((match = path.match(/^\/enrollments\/([^/]+)$/)) && method === 'PATCH' && user.role === 'admin') {
      const application = db.enrollments.find(item => item.id === match[1]);
      if (!application) return notFound('Application not found.');
      if (body.notes !== undefined) application.notes = body.notes;
      if (body.status && body.status !== application.status) {
        application.status = body.status;
        if (body.status === 'enrolled') {
          for (const enrollee of application.children) {
            const [firstName, ...rest] = enrollee.name.split(' ');
            const child = {
              id: uid('child'), centerId: user.centerId, classroomId: enrollee.classroomId, guardianIds: [],
              firstName: firstName || enrollee.name, lastName: rest.join(' ') || '—', birthday: enrollee.birthday, avatar: 'mint',
              allergies: [], notes: 'Newly enrolled — welcome packet in progress.', attendanceStatus: 'expected',
              authorizedPickup: [application.guardianName], enrolledOn: today(), guardianName: application.guardianName, guardianPhone: application.guardianPhone,
              medical: { physician: '', physicianPhone: '', conditions: 'None reported', medications: 'None', lastPhysical: '', immunizations: [], emergencyContacts: [{ name: application.guardianName, relation: 'Parent', phone: application.guardianPhone }] },
            };
            db.children.push(child);
            const room = db.classrooms.find(item => item.id === enrollee.classroomId);
            if (room && room.rates.registrationFee > 0) {
              const due = new Date(); due.setDate(due.getDate() + 14);
              db.invoices.push({ id: uid('invoice'), centerId: user.centerId, guardianId: '', childId: child.id, amount: room.rates.registrationFee, dueDate: due.toISOString().slice(0, 10), status: 'due', description: `Registration fee — ${room.name}` });
            }
          }
        }
      }
      return json(application);
    }
    if (path === '/staff' && method === 'POST' && user.role === 'admin') {
      if (db.users.some(item => item.email.toLowerCase() === body.email.toLowerCase())) return json({ error: 'conflict', message: 'A team member with that email already exists.' }, 409);
      const member = { id: uid('user'), centerId: user.centerId, name: body.name, email: body.email, role: 'teacher', avatar: body.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(), classroomIds: body.classroomIds || [], childIds: [], title: body.title || 'Teacher', phone: body.phone, hiredOn: today(), credentials: body.credentials || [] };
      db.users.push(member);
      member.classroomIds.forEach(roomId => { const room = db.classrooms.find(item => item.id === roomId); if (room && !room.teacherIds.includes(member.id)) room.teacherIds.push(member.id); });
      return json(member, 201);
    }
    if ((match = path.match(/^\/staff\/([^/]+)$/)) && method === 'PATCH' && user.role === 'admin') {
      const member = db.users.find(item => item.id === match[1] && item.role !== 'parent');
      if (!member) return notFound('Team member not found.');
      if (body.classroomIds) {
        db.classrooms.forEach(room => { room.teacherIds = room.teacherIds.filter(id => id !== member.id); if (body.classroomIds.includes(room.id)) room.teacherIds.push(member.id); });
        member.classroomIds = body.classroomIds;
      }
      if (body.title !== undefined) member.title = body.title;
      if (body.phone !== undefined) member.phone = body.phone;
      if (body.credentials !== undefined) member.credentials = body.credentials;
      return json(member);
    }
    if (path === '/time-clock/clock-in' && method === 'POST') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      if (db.timeEntries.some(entry => entry.userId === user.id && !entry.clockOut)) return json({ error: 'conflict', message: 'You are already on the clock — clock out first.' }, 409);
      const entry = { id: uid('time'), centerId: user.centerId, userId: user.id, date: today(), clockIn: new Date().toISOString() };
      db.timeEntries.push(entry);
      return json(entry, 201);
    }
    if (path === '/time-clock/clock-out' && method === 'POST') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const open = db.timeEntries.find(entry => entry.userId === user.id && !entry.clockOut);
      if (!open) return json({ error: 'conflict', message: 'You are not clocked in right now.' }, 409);
      open.clockOut = new Date().toISOString();
      return json(open);
    }
    if (path === '/time-clock/entries' && method === 'POST' && user.role === 'admin') {
      const entry = { id: uid('time'), centerId: user.centerId, userId: body.userId, date: body.clockIn.slice(0, 10), clockIn: body.clockIn, clockOut: body.clockOut };
      db.timeEntries.push(entry);
      return json(entry, 201);
    }
    if ((match = path.match(/^\/time-clock\/entries\/([^/]+)$/)) && method === 'DELETE' && user.role === 'admin') {
      const index = db.timeEntries.findIndex(entry => entry.id === match[1]);
      if (index < 0) return notFound('Time entry not found.');
      return json(db.timeEntries.splice(index, 1)[0]);
    }
    if (path === '/meals' && method === 'POST') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const existing = db.meals.find(record => record.date === body.date && record.meal === body.meal);
      const record = { id: existing ? existing.id : uid('meal'), centerId: user.centerId, date: body.date, meal: body.meal, childCount: body.childCount, adultCount: body.adultCount, recordedBy: user.name };
      if (existing) Object.assign(existing, record); else db.meals.push(record);
      return json(record, existing ? 200 : 201);
    }
    if (path === '/events' && method === 'POST' && user.role === 'admin') {
      const event = { id: uid('event'), centerId: user.centerId, ...body };
      db.events.push(event);
      db.events.sort((a, b) => a.date.localeCompare(b.date));
      return json(event, 201);
    }
    if ((match = path.match(/^\/events\/([^/]+)$/)) && method === 'DELETE' && user.role === 'admin') {
      const index = db.events.findIndex(event => event.id === match[1]);
      if (index < 0) return notFound('Event not found.');
      return json(db.events.splice(index, 1)[0]);
    }
    if (path === '/documents' && method === 'POST') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const document = { id: uid('document'), centerId: user.centerId, uploadedBy: user.name, uploadedAt: new Date().toISOString(), ...body };
      db.documents.unshift(document);
      const { dataUrl, ...meta } = document;
      return json(meta, 201);
    }
    if ((match = path.match(/^\/documents\/([^/]+)$/)) && method === 'GET') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const document = db.documents.find(item => item.id === match[1]);
      return document ? json(document) : notFound('Document not found.');
    }
    if ((match = path.match(/^\/documents\/([^/]+)$/)) && method === 'DELETE') {
      if (user.role === 'parent') return forbidden('This action is not available for your role.');
      const index = db.documents.findIndex(item => item.id === match[1]);
      if (index < 0) return notFound('Document not found.');
      if (user.role === 'teacher' && db.documents[index].uploadedBy !== user.name) return forbidden('Teachers can only remove documents they uploaded.');
      const { dataUrl, ...meta } = db.documents.splice(index, 1)[0];
      return json(meta);
    }
    if (path === '/center' && method === 'PATCH' && user.role === 'admin') {
      Object.assign(db.center, body);
      return json(db.center);
    }
    if (user.role === 'admin') {
      if (path === '/classrooms' && method === 'POST') {
        const palette = ['#f2789f', '#14b8a6', '#5a8dee', '#8b5cf6', '#f59e0b', '#22c55e'];
        const room = { id: uid('room'), centerId: user.centerId, teacherIds: [], color: palette[db.classrooms.length % palette.length], ...body };
        db.classrooms.push(room);
        return json(room, 201);
      }
      if ((match = path.match(/^\/classrooms\/([^/]+)$/)) && method === 'PATCH') {
        const room = db.classrooms.find(item => item.id === match[1]);
        if (!room) return notFound('Classroom not found.');
        Object.assign(room, body);
        return json(room);
      }
      if (path === '/billing/run-weekly' && method === 'POST') {
        const { week, created } = runWeeklyBilling(user.centerId);
        return json({ week, created: created.length });
      }
      if (path === '/inspections' && method === 'POST') {
        const inspection = { id: uid('inspection'), centerId: user.centerId, ...body };
        db.inspections.push(inspection);
        db.inspections.sort((a, b) => b.date.localeCompare(a.date));
        return json(inspection, 201);
      }
      if ((match = path.match(/^\/inspections\/([^/]+)$/)) && method === 'PATCH') {
        const inspection = db.inspections.find(item => item.id === match[1]);
        if (!inspection) return notFound('Inspection not found.');
        Object.assign(inspection, body);
        return json(inspection);
      }
      if (path === '/complaints' && method === 'POST') {
        const complaint = { id: uid('complaint'), centerId: user.centerId, status: 'open', resolution: '', ...body };
        db.complaints.unshift(complaint);
        return json(complaint, 201);
      }
      if ((match = path.match(/^\/complaints\/([^/]+)$/)) && method === 'PATCH') {
        const complaint = db.complaints.find(item => item.id === match[1]);
        if (!complaint) return notFound('Complaint not found.');
        Object.assign(complaint, body);
        return json(complaint);
      }
      if (path === '/violations' && method === 'POST') {
        const violation = { id: uid('violation'), centerId: user.centerId, status: 'open', ...body };
        db.violations.unshift(violation);
        return json(violation, 201);
      }
      if ((match = path.match(/^\/violations\/([^/]+)$/)) && method === 'PATCH') {
        const violation = db.violations.find(item => item.id === match[1]);
        if (!violation) return notFound('Violation not found.');
        violation.status = body.status;
        return json(violation);
      }
      if (path === '/corrective-actions' && method === 'POST') {
        const action = { id: uid('action'), centerId: user.centerId, status: 'open', ...body };
        db.correctiveActions.unshift(action);
        return json(action, 201);
      }
      if ((match = path.match(/^\/corrective-actions\/([^/]+)$/)) && method === 'PATCH') {
        const action = db.correctiveActions.find(item => item.id === match[1]);
        if (!action) return notFound('Corrective action not found.');
        action.status = body.status;
        action.completedOn = body.status === 'completed' || body.status === 'verified' ? (action.completedOn || today()) : undefined;
        return json(action);
      }
      if (path === '/drills' && method === 'POST') {
        const drill = { id: uid('drill'), centerId: user.centerId, conductedBy: user.name, ...body };
        db.drills.unshift(drill);
        db.drills.sort((a, b) => b.date.localeCompare(a.date));
        return json(drill, 201);
      }
      if ((match = path.match(/^\/compliance-checks\/([^/]+)$/)) && method === 'PATCH') {
        const check = db.complianceChecks.find(item => item.id === match[1]);
        if (!check) return notFound('Checklist item not found.');
        check.status = body.status;
        check.lastChecked = today();
        return json(check);
      }
    }
    if (path === '/health') return json({ status: 'ok', service: 'Child Compass (standalone demo)' });
    return notFound('That route does not exist.');
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const apiIndex = url.indexOf('/api/');
    if (apiIndex < 0) return realFetch(input, init);
    const path = url.slice(apiIndex + 4).split('?')[0];
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
    try { return handle(method, path, body, init.headers || {}); }
    catch (error) { console.error(error); return json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500); }
  };

  // Socket.IO can't connect from a local file — fail both of its transports
  // instantly and silently so the app drops to its 15s refresh loop.
  window.WebSocket = class FakeWebSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor() {
      this.readyState = FakeWebSocket.CLOSED;
      setTimeout(() => {
        if (typeof this.onerror === 'function') this.onerror(new Event('error'));
        if (typeof this.onclose === 'function') this.onclose({ code: 1006, reason: 'standalone demo', wasClean: false });
      }, 0);
    }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function InterceptedXHR() {
    const xhr = new RealXHR();
    const realOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      if (String(url).includes('/socket.io/')) {
        this.send = function () { setTimeout(() => { if (typeof this.onerror === 'function') this.onerror(new Event('error')); }, 0); };
        return;
      }
      return realOpen(method, url, ...rest);
    };
    return xhr;
  };
})();
