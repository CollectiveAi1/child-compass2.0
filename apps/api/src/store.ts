import type { Activity, AttendanceEntry, CacfpClaim, Center, CenterDocumentFile, CenterEvent, Child, Classroom, Curriculum, EnrollmentApplication, Invoice, MealRecord, Message, User } from '@compass/shared';

// In-memory demo storage. On Vercel it lives in the function instance's memory
// and resets when the instance recycles; swap for a managed PostgreSQL database
// before storing real center data.
export interface DemoStore {
  center: Center;
  users: User[];
  classrooms: Classroom[];
  children: Child[];
  activities: Activity[];
  messages: Message[];
  invoices: Invoice[];
  curriculum: Curriculum[];
  enrollments: EnrollmentApplication[];
  events: CenterEvent[];
  meals: MealRecord[];
  cacfpClaims: CacfpClaim[];
  documents: CenterDocumentFile[];
  attendanceLog: AttendanceEntry[];
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);

// The most recent `count` weekdays before today, oldest first.
function pastWeekdays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  while (days.length < count) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.unshift(cursor.toISOString().slice(0, 10));
  }
  return days;
}

// Builds a small but valid single-page PDF so seeded documents download and
// open like the real files admins will upload later.
export function tinyPdf(title: string, lines: string[]): string {
  const escape = (text: string) => text.replace(/[\\()]/g, char => `\\${char}`);
  const body = [`BT /F1 16 Tf 72 740 Td (${escape(title)}) Tj ET`, 'BT /F1 11 Tf 14 TL 72 710 Td', ...lines.map(line => `(${escape(line)}) Tj T*`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(pdf, 'binary').toString('base64')}`;
}

function medicalFor(index: number, allergies: string[]): NonNullable<Child['medical']> {
  const physicians = ['Dr. Emily Carter', 'Dr. Raj Patel', 'Dr. Susan Lee', 'Dr. Marcus Webb'];
  return {
    physician: physicians[index % physicians.length]!,
    physicianPhone: `(614) 555-0${(140 + index).toString()}`,
    conditions: allergies.length ? `Allergy: ${allergies.join(', ')}` : 'None reported',
    medications: allergies.includes('Peanuts') ? 'EpiPen Jr — stored in front office' : 'None',
    lastPhysical: ahead(-(120 + index * 11)),
    immunizations: [
      { name: 'DTaP', date: ahead(-(200 + index * 9)), status: 'complete' },
      { name: 'MMR', date: ahead(-(320 + index * 7)), status: 'complete' },
      { name: 'Varicella', date: ahead(-(300 + index * 5)), status: index % 6 === 4 ? 'due' : 'complete' },
      { name: 'Hepatitis B', date: ahead(-(400 + index * 3)), status: index % 9 === 7 ? 'overdue' : 'complete' },
    ],
    emergencyContacts: [
      { name: 'Primary guardian', relation: 'Parent', phone: `(614) 555-0${(160 + index).toString()}` },
      { name: 'Backup contact', relation: 'Grandparent', phone: `(614) 555-0${(180 + index).toString()}` },
    ],
  };
}

function seed(): DemoStore {
  const center: Center = {
    id: 'center-1', name: 'Bright Path Learning Center', address: '1840 Meadow Lane, Columbus, OH',
    phone: '(614) 555-0184', license: 'OH-ELC-28491', capacity: 48,
  };
  const users: User[] = [
    { id: 'user-admin', centerId: center.id, name: 'Sarah Johnson', email: 'admin@compass.demo', role: 'admin', avatar: 'SJ', classroomIds: [], childIds: [], title: 'Director', phone: '(614) 555-0100', hiredOn: '2019-08-12', credentials: [{ name: 'Administrator License', issued: '2019-08-01', expires: ahead(320) }, { name: 'CPR & First Aid', issued: ahead(-540), expires: ahead(190) }] },
    { id: 'user-teacher', centerId: center.id, name: 'Jordan Ellis', email: 'teacher@compass.demo', role: 'teacher', avatar: 'JE', classroomIds: ['room-sunbeams'], childIds: [], title: 'Lead Teacher', phone: '(614) 555-0101', hiredOn: '2021-03-02', credentials: [{ name: 'CDA Credential', issued: '2021-01-15', expires: ahead(410) }, { name: 'CPR & First Aid', issued: ahead(-718), expires: ahead(12) }] },
    { id: 'user-teacher-2', centerId: center.id, name: 'Sofia Martinez', email: 'sofia@compass.demo', role: 'teacher', avatar: 'SM', classroomIds: ['room-sunbeams'], childIds: [], title: 'Assistant Teacher', phone: '(614) 555-0102', hiredOn: '2022-09-19', credentials: [{ name: 'CPR & First Aid', issued: ahead(-300), expires: ahead(430) }] },
    { id: 'user-teacher-3', centerId: center.id, name: 'Amara Wilson', email: 'amara@compass.demo', role: 'teacher', avatar: 'AW', classroomIds: ['room-meadow'], childIds: [], title: 'Lead Teacher', phone: '(614) 555-0103', hiredOn: '2020-06-08', credentials: [{ name: 'CDA Credential', issued: '2020-05-01', expires: ahead(150) }, { name: 'CPR & First Aid', issued: ahead(-200), expires: ahead(530) }] },
    { id: 'user-teacher-4', centerId: center.id, name: 'Lisa Parker', email: 'lisa@compass.demo', role: 'teacher', avatar: 'LP', classroomIds: ['room-nest'], childIds: [], title: 'Infant Lead Teacher', phone: '(614) 555-0104', hiredOn: '2023-01-23', credentials: [{ name: 'Infant/Toddler CDA', issued: '2023-01-05', expires: ahead(260) }, { name: 'CPR & First Aid', issued: ahead(-100), expires: ahead(630) }] },
    { id: 'user-parent', centerId: center.id, name: 'Alex Morgan', email: 'parent@compass.demo', role: 'parent', avatar: 'AM', classroomIds: [], childIds: ['child-1'] },
    { id: 'user-parent-2', centerId: center.id, name: 'Priya Shah', email: 'priya@compass.demo', role: 'parent', avatar: 'PS', classroomIds: [], childIds: ['child-2'] },
  ];
  const classrooms: Classroom[] = [
    { id: 'room-sunbeams', centerId: center.id, name: 'Sunbeam Studio', ageRange: '2–3 years', color: '#f2789f', capacity: 12, ratioLimit: 6, teacherIds: ['user-teacher', 'user-teacher-2'] },
    { id: 'room-meadow', centerId: center.id, name: 'Meadow Makers', ageRange: '3–5 years', color: '#14b8a6', capacity: 18, ratioLimit: 9, teacherIds: ['user-teacher-3'] },
    { id: 'room-nest', centerId: center.id, name: 'Cozy Nest', ageRange: '6–24 months', color: '#5a8dee', capacity: 8, ratioLimit: 4, teacherIds: ['user-teacher-4'] },
  ];
  const childSeeds: Array<[string, string, string, string, string, Child['attendanceStatus'], string]> = [
    ['child-1', 'room-sunbeams', 'Mia', 'Morgan', '2023-09-14', 'present', 'sun'],
    ['child-2', 'room-sunbeams', 'Arlo', 'Shah', '2023-06-02', 'present', 'mint'],
    ['child-3', 'room-sunbeams', 'Noah', 'Williams', '2023-11-21', 'present', 'blue'],
    ['child-4', 'room-sunbeams', 'Lily', 'Chen', '2024-01-10', 'expected', 'pink'],
    ['child-5', 'room-sunbeams', 'Theo', 'Johnson', '2023-08-28', 'present', 'lilac'],
    ['child-6', 'room-sunbeams', 'Zoe', 'Davis', '2023-05-19', 'expected', 'peach'],
    ['child-7', 'room-sunbeams', 'Kai', 'Brown', '2023-12-04', 'went_home', 'aqua'],
    ['child-8', 'room-sunbeams', 'Nora', 'Garcia', '2023-07-17', 'present', 'yellow'],
    ['child-9', 'room-meadow', 'Ava', 'Wilson', '2021-11-12', 'present', 'coral'],
    ['child-10', 'room-meadow', 'Ezra', 'Thomas', '2022-02-08', 'present', 'leaf'],
    ['child-11', 'room-meadow', 'Ivy', 'Lee', '2021-08-25', 'expected', 'sky'],
    ['child-12', 'room-meadow', 'Leo', 'Martin', '2022-05-03', 'went_home', 'violet'],
    ['child-13', 'room-meadow', 'Ruby', 'Nguyen', '2021-06-30', 'present', 'pink'],
    ['child-14', 'room-meadow', 'Owen', 'Clark', '2022-01-17', 'present', 'blue'],
    ['child-15', 'room-nest', 'Emma', 'Johnson', '2025-01-04', 'present', 'sun'],
    ['child-16', 'room-nest', 'Miles', 'Rivera', '2024-10-22', 'present', 'mint'],
    ['child-17', 'room-nest', 'Sadie', 'Kim', '2025-03-15', 'expected', 'lilac'],
    ['child-18', 'room-nest', 'Jack', 'Foster', '2024-08-09', 'present', 'aqua'],
  ];
  const guardianNames = ['Alex Morgan', 'Priya Shah', 'Rachel Williams', 'Wei Chen', 'Michael Brown', 'Dana Davis', 'Chris Brown', 'Elena Garcia', 'Tara Wilson', 'Sam Thomas', 'Grace Lee', 'Diego Martin', 'Linh Nguyen', 'Erin Clark', 'Ben Johnson', 'Maria Rivera', 'Joon Kim', 'Holly Foster'];
  const children: Child[] = childSeeds.map(([id, classroomId, firstName, lastName, birthday, attendanceStatus, avatar], index) => {
    const allergies = index === 2 ? ['Peanuts'] : index === 5 ? ['Dairy'] : index === 13 ? ['Eggs'] : [];
    return {
      id, centerId: center.id, classroomId, guardianIds: index === 0 ? ['user-parent'] : index === 1 ? ['user-parent-2'] : [],
      firstName, lastName, birthday, avatar, allergies,
      notes: index === 0 ? 'Loves music, puzzles, and helping friends.' : 'Enjoys sensory play and story time.',
      attendanceStatus,
      checkedInAt: attendanceStatus === 'present' ? ago(210 - index * 6) : undefined,
      checkedOutAt: attendanceStatus === 'went_home' ? ago(24) : undefined,
      authorizedPickup: index === 0 ? ['Alex Morgan', 'Dana Morgan (Grandmother)'] : [guardianNames[index] ?? `${firstName}'s guardian`],
      enrolledOn: ahead(-(6 + index * 21)),
      guardianName: guardianNames[index],
      guardianPhone: `(614) 555-02${(10 + index).toString()}`,
      medical: medicalFor(index, allergies),
    };
  });

  const activities: Activity[] = [
    { id: 'activity-1', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1', 'child-2', 'child-3'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'moment', title: 'Garden explorers', body: 'Tiny hands, huge discoveries. We found a ladybug and counted all seven spots together.', mediaUrl: '/garden-moment.svg', createdAt: ago(38), likedBy: ['user-parent'] },
    { id: 'activity-2', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'meal', title: 'Lunch', body: 'Mia enjoyed veggie pasta, strawberries, and milk.', value: 'Ate all', createdAt: ago(84), likedBy: [] },
    { id: 'activity-3', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher-2', authorName: 'Sofia Martinez', type: 'nap', title: 'Rest time', body: 'A peaceful reset after a busy morning.', value: '1h 12m', createdAt: ago(142), likedBy: [] },
    { id: 'activity-4', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1', 'child-2', 'child-4'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'learning', title: 'Colors in motion', body: 'We mixed primary colors with ice cubes and predicted what would happen.', value: 'Creative science', createdAt: ago(198), likedBy: ['user-parent'] },
    { id: 'activity-5', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'note', title: 'Bright start', body: 'Mia arrived smiling and jumped right into the welcome puzzle.', createdAt: ago(228), likedBy: [] },
    { id: 'activity-6', centerId: center.id, classroomId: 'room-meadow', childIds: ['child-9', 'child-10', 'child-13'], authorId: 'user-teacher-3', authorName: 'Amara Wilson', type: 'learning', title: 'Lesson plan added', body: 'Meadow Makers — measurement week, block city challenge.', value: 'STEM', createdAt: ago(110), likedBy: [] },
    { id: 'activity-7', centerId: center.id, classroomId: 'room-nest', childIds: ['child-15', 'child-16'], authorId: 'user-teacher-4', authorName: 'Lisa Parker', type: 'moment', title: 'Emma checked in', body: 'Happy waves at drop-off and straight to the soft blocks.', createdAt: ago(255), likedBy: [] },
  ];
  const messages: Message[] = [
    { id: 'message-1', centerId: center.id, childId: 'child-1', senderId: 'user-teacher', recipientIds: ['user-parent'], body: 'Mia had such a joyful morning. She volunteered to help set the lunch table!', createdAt: ago(52), readBy: ['user-teacher'] },
    { id: 'message-2', centerId: center.id, childId: 'child-1', senderId: 'user-parent', recipientIds: ['user-teacher', 'user-teacher-2'], body: 'That makes me so happy. Thank you for sharing!', createdAt: ago(43), readBy: ['user-parent', 'user-teacher'] },
    { id: 'message-3', centerId: center.id, childId: 'child-2', senderId: 'user-parent-2', recipientIds: ['user-teacher', 'user-teacher-2'], body: 'Arlo will be picked up by his aunt today — she is on the authorized list.', createdAt: ago(95), readBy: ['user-parent-2'] },
  ];
  const invoices: Invoice[] = [
    { id: 'invoice-1', centerId: center.id, guardianId: 'user-parent', childId: 'child-1', amount: 124000, dueDate: ahead(5), status: 'due', description: 'July tuition' },
    { id: 'invoice-2', centerId: center.id, guardianId: 'user-parent', childId: 'child-1', amount: 119500, dueDate: ahead(-25), status: 'paid', description: 'June tuition', paidAt: ago(36_000), method: 'Auto-pay card' },
    { id: 'invoice-3', centerId: center.id, guardianId: 'user-parent-2', childId: 'child-2', amount: 124000, dueDate: ahead(-2), status: 'overdue', description: 'July tuition' },
    { id: 'invoice-4', centerId: center.id, guardianId: 'user-parent-2', childId: 'child-2', amount: 119500, dueDate: ahead(-27), status: 'paid', description: 'June tuition', paidAt: ago(38_500), method: 'ACH transfer' },
    { id: 'invoice-5', centerId: center.id, guardianId: 'user-parent', childId: 'child-1', amount: 4500, dueDate: ahead(9), status: 'due', description: 'Field trip fee — Zoo Adventure' },
  ];
  const curriculum: Curriculum[] = [
    { id: 'curriculum-1', centerId: center.id, classroomId: 'room-sunbeams', date: today(), theme: 'Little Garden, Big Ideas', goal: 'Notice patterns in nature and practice describing discoveries with words, colors, and numbers.', materials: ['Magnifying glasses', 'Leaf trays', 'Washable paint', 'Garden picture cards'], schedule: [
      { time: '8:30', title: 'Welcome & wonder wall', detail: 'Share one thing we noticed outside.' },
      { time: '9:30', title: 'Garden investigation', detail: 'Small-group sensory stations.' },
      { time: '11:00', title: 'Color mixing lab', detail: 'Predict, mix, and describe.' },
      { time: '2:30', title: 'Story garden', detail: 'Create a shared garden story.' },
    ] },
    { id: 'curriculum-2', centerId: center.id, classroomId: 'room-meadow', date: today(), theme: 'Build It, Measure It', goal: 'Compare heights and lengths with blocks, tape measures, and teamwork.', materials: ['Unit blocks', 'Measuring tapes', 'Grid paper', 'Clipboards'], schedule: [
      { time: '8:45', title: 'Morning meeting', detail: 'Guess the tallest tower.' },
      { time: '9:45', title: 'Block city challenge', detail: 'Small teams plan and build.' },
      { time: '11:15', title: 'Measure & record', detail: 'Chart our structures.' },
      { time: '2:45', title: 'Architect share-out', detail: 'Present what we built.' },
    ] },
    { id: 'curriculum-3', centerId: center.id, classroomId: 'room-nest', date: today(), theme: 'Textures & Tunes', goal: 'Explore textures with safe sensory baskets and respond to gentle rhythm games.', materials: ['Texture baskets', 'Scarves', 'Shakers', 'Board books'], schedule: [
      { time: '9:00', title: 'Cuddle & sing', detail: 'Welcome songs with movement.' },
      { time: '10:00', title: 'Texture baskets', detail: 'Supervised sensory exploration.' },
      { time: '11:30', title: 'Lunch & lull', detail: 'Calm music into rest time.' },
    ] },
  ];
  const enrollments: EnrollmentApplication[] = [
    { id: 'enrollment-1', centerId: center.id, childName: 'Harper Bell', birthday: '2023-04-11', guardianName: 'Jamie Bell', guardianEmail: 'jamie.bell@example.com', guardianPhone: '(614) 555-0301', classroomId: 'room-sunbeams', requestedStart: ahead(21), status: 'approved', notes: 'Tour completed. Paperwork returned — ready to enroll.', submittedAt: ago(12_000) },
    { id: 'enrollment-2', centerId: center.id, childName: 'Mateo Cruz', birthday: '2021-12-02', guardianName: 'Ana Cruz', guardianEmail: 'ana.cruz@example.com', guardianPhone: '(614) 555-0302', classroomId: 'room-meadow', requestedStart: ahead(35), status: 'toured', notes: 'Family visited Tuesday. Comparing two centers.', submittedAt: ago(20_500) },
    { id: 'enrollment-3', centerId: center.id, childName: 'Willow James', birthday: '2024-09-27', guardianName: 'Morgan James', guardianEmail: 'morgan.james@example.com', guardianPhone: '(614) 555-0303', classroomId: 'room-nest', requestedStart: ahead(14), status: 'waitlist', notes: 'Infant room at ratio — first on waitlist.', submittedAt: ago(30_000) },
    { id: 'enrollment-4', centerId: center.id, childName: 'Finn OConnor', birthday: '2022-07-19', guardianName: 'Casey OConnor', guardianEmail: 'casey.oconnor@example.com', guardianPhone: '(614) 555-0304', classroomId: 'room-meadow', requestedStart: ahead(45), status: 'inquiry', notes: 'Found us through the parent fair. Wants a tour next week.', submittedAt: ago(3_100) },
  ];
  const events: CenterEvent[] = [
    { id: 'event-1', centerId: center.id, title: 'Field Trip — Zoo Adventure', date: ahead(6), time: '9:00 AM – 1:00 PM', detail: 'Meadow Makers visit the Columbus Zoo.', attendees: 28 },
    { id: 'event-2', centerId: center.id, title: 'Monthly Parent Meeting', date: ahead(8), time: '6:00 PM – 7:30 PM', detail: 'Summer program preview and Q&A.', attendees: 15 },
    { id: 'event-3', centerId: center.id, title: 'School Closed — Staff In-Service', date: ahead(11), detail: 'Professional development day for all staff.' },
    { id: 'event-4', centerId: center.id, title: 'Progress Reports Shared', date: ahead(15), detail: 'July progress reports available to parents.' },
  ];
  const history = pastWeekdays(5);
  const attendanceLog: AttendanceEntry[] = [];
  history.forEach((date, dayIndex) => {
    children.forEach((child, childIndex) => {
      const absent = (childIndex + dayIndex * 3) % 7 === 5;
      attendanceLog.push({
        id: `attendance-${date}-${child.id}`, centerId: center.id, childId: child.id, date,
        status: absent ? 'absent' : 'present',
        checkedInAt: absent ? undefined : `${date}T${dayIndex % 2 ? '08' : '07'}:${(35 + childIndex).toString().padStart(2, '0')}:00.000Z`,
        checkedOutAt: absent ? undefined : `${date}T16:${(10 + childIndex).toString().padStart(2, '0')}:00.000Z`,
      });
    });
  });
  children.forEach(child => {
    if (child.attendanceStatus === 'expected') return;
    attendanceLog.push({ id: `attendance-${today()}-${child.id}`, centerId: center.id, childId: child.id, date: today(), status: 'present', checkedInAt: child.checkedInAt, checkedOutAt: child.checkedOutAt });
  });
  const meals: MealRecord[] = [];
  history.forEach((date, dayIndex) => {
    const present = attendanceLog.filter(entry => entry.date === date && entry.status === 'present').length;
    (['breakfast', 'lunch', 'snack'] as const).forEach((meal, mealIndex) => {
      meals.push({ id: `meal-${date}-${meal}`, centerId: center.id, date, meal, childCount: Math.max(present - mealIndex - (dayIndex % 2), 0), adultCount: 4, recordedBy: 'Jordan Ellis' });
    });
  });
  const presentToday = children.filter(child => child.attendanceStatus !== 'expected').length;
  meals.push(
    { id: `meal-${today()}-breakfast`, centerId: center.id, date: today(), meal: 'breakfast', childCount: Math.max(presentToday - 2, 0), adultCount: 4, recordedBy: 'Jordan Ellis' },
    { id: `meal-${today()}-lunch`, centerId: center.id, date: today(), meal: 'lunch', childCount: presentToday, adultCount: 5, recordedBy: 'Sofia Martinez' },
  );
  const monthKey = (offset: number) => { const date = new Date(); date.setMonth(date.getMonth() + offset); return date.toISOString().slice(0, 7); };
  const cacfpClaims: CacfpClaim[] = [
    { id: 'claim-current', centerId: center.id, month: monthKey(0), status: 'draft', amount: 0, daysSubmitted: history.length + 1, daysInMonth: 22 },
    { id: 'claim-previous', centerId: center.id, month: monthKey(-1), status: 'approved', amount: 412560, daysSubmitted: 22, daysInMonth: 22 },
    { id: 'claim-older', centerId: center.id, month: monthKey(-2), status: 'paid', amount: 398410, daysSubmitted: 21, daysInMonth: 21 },
  ];
  const documents: CenterDocumentFile[] = [
    { id: 'document-1', centerId: center.id, name: 'Daily attendance sheet (blank).pdf', category: 'attendance', contentType: 'application/pdf', size: 1180, uploadedBy: 'Sarah Johnson', uploadedAt: ago(14_000), dataUrl: tinyPdf('Daily Attendance Sheet', ['Bright Path Learning Center', 'Date: ____________  Classroom: ____________', '', 'Child name          Time in    Time out    Guardian signature', '________________    ______     _______     __________________', '________________    ______     _______     __________________', '________________    ______     _______     __________________']) },
    { id: 'document-2', centerId: center.id, name: 'Immunization record form.pdf', category: 'medical', contentType: 'application/pdf', size: 1120, uploadedBy: 'Sarah Johnson', uploadedAt: ago(26_000), dataUrl: tinyPdf('Immunization Record', ['Bright Path Learning Center', 'Child: ____________________  DOB: ____________', '', 'Vaccine        Dose 1      Dose 2      Dose 3', 'DTaP           ______      ______      ______', 'MMR            ______      ______      ______', 'Varicella      ______      ______      ______']) },
    { id: 'document-3', centerId: center.id, name: 'CACFP claim worksheet.pdf', category: 'financial', contentType: 'application/pdf', size: 1050, uploadedBy: 'Sarah Johnson', uploadedAt: ago(40_000), dataUrl: tinyPdf('CACFP Monthly Claim Worksheet', ['Bright Path Learning Center', 'Claim month: ____________', '', 'Meal type      Days served    Total meals', 'Breakfast      ___________    ___________', 'Lunch          ___________    ___________', 'Snack          ___________    ___________']) },
    { id: 'document-4', centerId: center.id, name: 'Enrollment packet.pdf', category: 'enrollment', contentType: 'application/pdf', size: 1240, uploadedBy: 'Sarah Johnson', uploadedAt: ago(55_000), dataUrl: tinyPdf('Enrollment Packet', ['Bright Path Learning Center', 'Welcome! Please complete and return:', '', '1. Child information & emergency contacts', '2. Immunization records', '3. Authorized pickup list', '4. Tuition agreement']) },
    { id: 'document-5', centerId: center.id, name: 'Fire drill log.pdf', category: 'licensing', contentType: 'application/pdf', size: 990, uploadedBy: 'Sarah Johnson', uploadedAt: ago(70_000), dataUrl: tinyPdf('Fire Drill Log', ['Bright Path Learning Center — License OH-ELC-28491', '', 'Date         Time       Evacuation time    Conducted by', '_________    ______     _____________      ____________', '_________    ______     _____________      ____________']) },
    { id: 'document-6', centerId: center.id, name: 'Garden exploration guide.pdf', category: 'curriculum', contentType: 'application/pdf', size: 1310, uploadedBy: 'Jordan Ellis', uploadedAt: ago(9_000), dataUrl: tinyPdf('Garden Exploration Guide', ['Theme: Little Garden, Big Ideas', '', 'Stations: leaf rubbings, seed sorting, watering team', 'Vocabulary: sprout, stem, petal, roots', 'Family tie-in: send a photo of a plant at home']) },
  ];

  return { center, users, classrooms, children, activities, messages, invoices, curriculum, enrollments, events, meals, cacfpClaims, documents, attendanceLog };
}

let current = seed();
export const store = () => current;
export function resetDemoStore(): DemoStore { current = seed(); return current; }
