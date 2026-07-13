export type Role = 'admin' | 'teacher' | 'parent';
export type AttendanceStatus = 'expected' | 'present' | 'went_home';
export type ActivityType = 'moment' | 'meal' | 'nap' | 'learning' | 'note' | 'incident';

export interface User {
  id: string;
  centerId: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  classroomIds: string[];
  childIds: string[];
}

export interface Center {
  id: string;
  name: string;
  address: string;
  phone: string;
  license: string;
  capacity: number;
}

export interface Classroom {
  id: string;
  centerId: string;
  name: string;
  ageRange: string;
  color: string;
  capacity: number;
  ratioLimit: number;
  teacherIds: string[];
}

export interface Child {
  id: string;
  centerId: string;
  classroomId: string;
  guardianIds: string[];
  firstName: string;
  lastName: string;
  birthday: string;
  avatar: string;
  allergies: string[];
  notes: string;
  attendanceStatus: AttendanceStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  authorizedPickup: string[];
}

export interface Activity {
  id: string;
  centerId: string;
  classroomId: string;
  childIds: string[];
  authorId: string;
  authorName: string;
  type: ActivityType;
  title: string;
  body: string;
  mediaUrl?: string;
  value?: string;
  createdAt: string;
  likedBy: string[];
}

export interface Message {
  id: string;
  centerId: string;
  childId: string;
  senderId: string;
  recipientIds: string[];
  body: string;
  createdAt: string;
  readBy: string[];
}

export interface Invoice {
  id: string;
  centerId: string;
  guardianId: string;
  childId: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'due' | 'overdue';
  description: string;
}

export interface Curriculum {
  id: string;
  centerId: string;
  classroomId: string;
  date: string;
  theme: string;
  goal: string;
  materials: string[];
  schedule: { time: string; title: string; detail: string }[];
  documents: { name: string; type: 'PDF' | 'DOC'; size: string }[];
}

export interface DashboardData {
  center: Center;
  classrooms: Classroom[];
  children: Child[];
  activities: Activity[];
  messages: Message[];
  invoices: Invoice[];
  curriculum: Curriculum[];
  staff: User[];
  stats: {
    present: number;
    expected: number;
    wentHome: number;
    capacity: number;
    staffOnSite: number;
    unreadMessages: number;
    revenueCollected: number;
    revenueOutstanding: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export const ROLE_PORTALS: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  parent: '/parent',
};

export function portalForRole(role: Role): string {
  return ROLE_PORTALS[role];
}

export function nextAttendanceStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === 'expected') return 'present';
  if (status === 'present') return 'went_home';
  return 'expected';
}

export function childAge(birthday: string, now = new Date()): string {
  const born = new Date(`${birthday}T12:00:00`);
  let months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years}y ${remainder}m` : `${years}y`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
