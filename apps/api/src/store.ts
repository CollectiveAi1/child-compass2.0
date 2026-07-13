import { newDb, type IMemoryDb } from 'pg-mem';
import type { Activity, Center, Child, Classroom, Curriculum, Invoice, Message, User } from '@compass/shared';

export interface DemoStore {
  pg: IMemoryDb;
  center: Center;
  users: User[];
  classrooms: Classroom[];
  children: Child[];
  activities: Activity[];
  messages: Message[];
  invoices: Invoice[];
  curriculum: Curriculum[];
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const sql = (value: unknown) => `'${String(typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''")}'`;

function seed(): DemoStore {
  const pg = newDb({ autoCreateForeignKeyIndices: true });
  pg.public.none(`
    create table centers (id text primary key, name text not null);
    create table users (id text primary key, center_id text not null, email text unique not null, role text not null);
    create table children (id text primary key, center_id text not null, classroom_id text not null, attendance_status text not null);
    create table activities (id text primary key, center_id text not null, payload jsonb not null);
  `);

  const center: Center = {
    id: 'center-1', name: 'Willow & Wonder Early Learning', address: '1840 Meadow Lane, Columbus, OH',
    phone: '(614) 555-0184', license: 'OH-ELC-28491', capacity: 48,
  };
  const users: User[] = [
    { id: 'user-admin', centerId: center.id, name: 'Maya Brooks', email: 'admin@compass.demo', role: 'admin', avatar: 'MB', classroomIds: [], childIds: [] },
    { id: 'user-teacher', centerId: center.id, name: 'Jordan Ellis', email: 'teacher@compass.demo', role: 'teacher', avatar: 'JE', classroomIds: ['room-sunbeams'], childIds: [] },
    { id: 'user-teacher-2', centerId: center.id, name: 'Sofia Martinez', email: 'sofia@compass.demo', role: 'teacher', avatar: 'SM', classroomIds: ['room-sunbeams'], childIds: [] },
    { id: 'user-teacher-3', centerId: center.id, name: 'Amara Wilson', email: 'amara@compass.demo', role: 'teacher', avatar: 'AW', classroomIds: ['room-meadow'], childIds: [] },
    { id: 'user-parent', centerId: center.id, name: 'Alex Morgan', email: 'parent@compass.demo', role: 'parent', avatar: 'AM', classroomIds: [], childIds: ['child-1'] },
    { id: 'user-parent-2', centerId: center.id, name: 'Priya Shah', email: 'priya@compass.demo', role: 'parent', avatar: 'PS', classroomIds: [], childIds: ['child-2'] },
  ];
  const classrooms: Classroom[] = [
    { id: 'room-sunbeams', centerId: center.id, name: 'Sunbeam Studio', ageRange: '2–3 years', color: '#f6b4c6', capacity: 12, ratioLimit: 6, teacherIds: ['user-teacher', 'user-teacher-2'] },
    { id: 'room-meadow', centerId: center.id, name: 'Meadow Makers', ageRange: '3–5 years', color: '#98d9cf', capacity: 18, ratioLimit: 9, teacherIds: ['user-teacher-3'] },
    { id: 'room-nest', centerId: center.id, name: 'Cozy Nest', ageRange: '6–24 months', color: '#a9c8f5', capacity: 8, ratioLimit: 4, teacherIds: [] },
  ];
  const sunbeamSeeds: Array<[string, string, string, string, Child['attendanceStatus'], string]> = [
    ['child-1', 'Mia', 'Morgan', '2023-09-14', 'present', 'sun'],
    ['child-2', 'Arlo', 'Shah', '2023-06-02', 'present', 'mint'],
    ['child-3', 'Noah', 'Williams', '2023-11-21', 'present', 'blue'],
    ['child-4', 'Lily', 'Chen', '2024-01-10', 'expected', 'pink'],
    ['child-5', 'Theo', 'Johnson', '2023-08-28', 'present', 'lilac'],
    ['child-6', 'Zoe', 'Davis', '2023-05-19', 'expected', 'peach'],
    ['child-7', 'Kai', 'Brown', '2023-12-04', 'went_home', 'aqua'],
    ['child-8', 'Nora', 'Garcia', '2023-07-17', 'present', 'yellow'],
  ];
  const children: Child[] = sunbeamSeeds.map(([id, firstName, lastName, birthday, attendanceStatus, avatar], index) => ({
    id, centerId: center.id, classroomId: 'room-sunbeams', guardianIds: index === 0 ? ['user-parent'] : index === 1 ? ['user-parent-2'] : [],
    firstName, lastName, birthday, avatar, allergies: index === 2 ? ['Peanuts'] : index === 5 ? ['Dairy'] : [],
    notes: index === 0 ? 'Loves music, puzzles, and helping friends.' : 'Enjoys sensory play and story time.',
    attendanceStatus,
    checkedInAt: attendanceStatus === 'present' ? ago(205 - index * 8) : undefined,
    checkedOutAt: attendanceStatus === 'went_home' ? ago(22) : undefined,
    authorizedPickup: index === 0 ? ['Alex Morgan', 'Dana Morgan (Grandmother)'] : [`${firstName}'s guardian`],
  }));
  children.push(
    ...([
      ['child-9', 'Ava', 'Wilson', '2021-11-12', 'present', 'coral'],
      ['child-10', 'Ezra', 'Thomas', '2022-02-08', 'present', 'leaf'],
      ['child-11', 'Ivy', 'Lee', '2021-08-25', 'expected', 'sky'],
      ['child-12', 'Leo', 'Martin', '2022-05-03', 'went_home', 'violet'],
    ] as Array<[string, string, string, string, Child['attendanceStatus'], string]>).map(([id, firstName, lastName, birthday, attendanceStatus, avatar]) => ({
      id, centerId: center.id, classroomId: 'room-meadow', guardianIds: [], firstName, lastName, birthday, avatar,
      allergies: [], notes: 'Curious, collaborative, and imaginative.', attendanceStatus,
      checkedInAt: attendanceStatus === 'present' ? ago(180) : undefined, checkedOutAt: attendanceStatus === 'went_home' ? ago(45) : undefined,
      authorizedPickup: [`${firstName}'s guardian`],
    }))
  );

  const activities: Activity[] = [
    { id: 'activity-1', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1', 'child-2', 'child-3'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'moment', title: 'Garden explorers', body: 'Tiny hands, huge discoveries. We found a ladybug and counted all seven spots together.', mediaUrl: '/garden-moment.svg', createdAt: ago(38), likedBy: ['user-parent'] },
    { id: 'activity-2', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'meal', title: 'Lunch', body: 'Mia enjoyed veggie pasta, strawberries, and milk.', value: 'Ate all', createdAt: ago(84), likedBy: [] },
    { id: 'activity-3', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher-2', authorName: 'Sofia Martinez', type: 'nap', title: 'Rest time', body: 'A peaceful reset after a busy morning.', value: '1h 12m', createdAt: ago(142), likedBy: [] },
    { id: 'activity-4', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1', 'child-2', 'child-4'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'learning', title: 'Colors in motion', body: 'We mixed primary colors with ice cubes and predicted what would happen.', value: 'Creative science', createdAt: ago(198), likedBy: ['user-parent'] },
    { id: 'activity-5', centerId: center.id, classroomId: 'room-sunbeams', childIds: ['child-1'], authorId: 'user-teacher', authorName: 'Jordan Ellis', type: 'note', title: 'Bright start', body: 'Mia arrived smiling and jumped right into the welcome puzzle.', createdAt: ago(228), likedBy: [] },
  ];
  const messages: Message[] = [
    { id: 'message-1', centerId: center.id, childId: 'child-1', senderId: 'user-teacher', recipientIds: ['user-parent'], body: 'Mia had such a joyful morning. She volunteered to help set the lunch table!', createdAt: ago(52), readBy: ['user-teacher'] },
    { id: 'message-2', centerId: center.id, childId: 'child-1', senderId: 'user-parent', recipientIds: ['user-teacher', 'user-teacher-2'], body: 'That makes me so happy. Thank you for sharing!', createdAt: ago(43), readBy: ['user-parent', 'user-teacher'] },
  ];
  const invoices: Invoice[] = [
    { id: 'invoice-1', centerId: center.id, guardianId: 'user-parent', childId: 'child-1', amount: 124000, dueDate: ahead(5), status: 'due', description: 'July tuition' },
    { id: 'invoice-2', centerId: center.id, guardianId: 'user-parent', childId: 'child-1', amount: 119500, dueDate: ahead(-25), status: 'paid', description: 'June tuition' },
    { id: 'invoice-3', centerId: center.id, guardianId: 'user-parent-2', childId: 'child-2', amount: 124000, dueDate: ahead(-2), status: 'overdue', description: 'July tuition' },
  ];
  const curriculum: Curriculum[] = [
    { id: 'curriculum-1', centerId: center.id, classroomId: 'room-sunbeams', date: new Date().toISOString().slice(0, 10), theme: 'Little Garden, Big Ideas', goal: 'Notice patterns in nature and practice describing discoveries with words, colors, and numbers.', materials: ['Magnifying glasses', 'Leaf trays', 'Washable paint', 'Garden picture cards'], schedule: [
      { time: '8:30', title: 'Welcome & wonder wall', detail: 'Share one thing we noticed outside.' },
      { time: '9:30', title: 'Garden investigation', detail: 'Small-group sensory stations.' },
      { time: '11:00', title: 'Color mixing lab', detail: 'Predict, mix, and describe.' },
      { time: '2:30', title: 'Story garden', detail: 'Create a shared garden story.' },
    ], documents: [{ name: 'Garden exploration guide', type: 'PDF', size: '1.8 MB' }, { name: 'Family connection note', type: 'DOC', size: '420 KB' }] },
  ];

  pg.public.none(`insert into centers values (${sql(center.id)}, ${sql(center.name)})`);
  users.forEach(user => pg.public.none(`insert into users values (${sql(user.id)}, ${sql(user.centerId)}, ${sql(user.email)}, ${sql(user.role)})`));
  children.forEach(child => pg.public.none(`insert into children values (${sql(child.id)}, ${sql(child.centerId)}, ${sql(child.classroomId)}, ${sql(child.attendanceStatus)})`));
  activities.forEach(activity => pg.public.none(`insert into activities values (${sql(activity.id)}, ${sql(activity.centerId)}, ${sql(activity)})`));
  return { pg, center, users, classrooms, children, activities, messages, invoices, curriculum };
}

let current = seed();
export const store = () => current;
export function resetDemoStore(): DemoStore { current = seed(); return current; }
