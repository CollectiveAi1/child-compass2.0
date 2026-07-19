export type Role = 'admin' | 'teacher' | 'parent';
export type AttendanceStatus = 'expected' | 'present' | 'went_home';
export type ActivityType = 'moment' | 'meal' | 'nap' | 'learning' | 'note' | 'incident';

export interface StaffCredential {
  name: string;
  issued: string;
  expires: string;
}

export interface User {
  id: string;
  centerId: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  classroomIds: string[];
  childIds: string[];
  title?: string;
  phone?: string;
  hiredOn?: string;
  credentials?: StaffCredential[];
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

export interface ImmunizationRecord {
  name: string;
  date: string;
  status: 'complete' | 'due' | 'overdue';
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface ChildMedical {
  physician: string;
  physicianPhone: string;
  conditions: string;
  medications: string;
  lastPhysical: string;
  immunizations: ImmunizationRecord[];
  emergencyContacts: EmergencyContact[];
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
  enrolledOn?: string;
  guardianName?: string;
  guardianPhone?: string;
  medical?: ChildMedical;
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
  paidAt?: string;
  method?: string;
}

export type EnrollmentStatus = 'inquiry' | 'toured' | 'waitlist' | 'approved' | 'enrolled' | 'declined';

export interface EnrollmentApplication {
  id: string;
  centerId: string;
  childName: string;
  birthday: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  classroomId: string;
  requestedStart: string;
  status: EnrollmentStatus;
  notes: string;
  submittedAt: string;
}

export type MealType = 'breakfast' | 'lunch' | 'snack';

export interface MealRecord {
  id: string;
  centerId: string;
  date: string;
  meal: MealType;
  childCount: number;
  adultCount: number;
  recordedBy: string;
}

export interface CacfpClaim {
  id: string;
  centerId: string;
  month: string;
  status: 'draft' | 'submitted' | 'approved' | 'paid';
  amount: number;
  daysSubmitted: number;
  daysInMonth: number;
}

export type DocumentCategory = 'attendance' | 'financial' | 'medical' | 'enrollment' | 'licensing' | 'curriculum' | 'other';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['attendance', 'financial', 'medical', 'enrollment', 'licensing', 'curriculum', 'other'];

export interface CenterDocument {
  id: string;
  centerId: string;
  name: string;
  category: DocumentCategory;
  contentType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface CenterDocumentFile extends CenterDocument {
  dataUrl: string;
}

export interface CenterEvent {
  id: string;
  centerId: string;
  title: string;
  date: string;
  time?: string;
  detail?: string;
  attendees?: number;
}

export interface AttendanceEntry {
  id: string;
  centerId: string;
  childId: string;
  date: string;
  status: 'present' | 'absent';
  checkedInAt?: string;
  checkedOutAt?: string;
}

export type InspectionType = 'annual' | 'renewal' | 'monitoring' | 'follow_up' | 'complaint';
export type InspectionStatus = 'scheduled' | 'passed' | 'findings' | 'failed';

export interface Inspection {
  id: string;
  centerId: string;
  date: string;
  type: InspectionType;
  inspector: string;
  status: InspectionStatus;
  findings: number;
  notes: string;
}

export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'unfounded';

export interface Complaint {
  id: string;
  centerId: string;
  receivedOn: string;
  source: 'parent' | 'staff' | 'anonymous' | 'state';
  summary: string;
  status: ComplaintStatus;
  resolution: string;
}

export type ViolationSeverity = 'low' | 'moderate' | 'serious';
export type ViolationStatus = 'open' | 'corrected' | 'verified';

export interface Violation {
  id: string;
  centerId: string;
  code: string;
  description: string;
  severity: ViolationSeverity;
  citedOn: string;
  status: ViolationStatus;
  inspectionId?: string;
}

export type CorrectiveActionStatus = 'open' | 'in_progress' | 'completed' | 'verified';

export interface CorrectiveAction {
  id: string;
  centerId: string;
  violationId?: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: CorrectiveActionStatus;
  completedOn?: string;
}

export type DrillType = 'fire' | 'tornado' | 'lockdown' | 'evacuation';

export interface EmergencyDrill {
  id: string;
  centerId: string;
  type: DrillType;
  date: string;
  timeOfDay: string;
  durationMinutes: number;
  participants: number;
  conductedBy: string;
  notes?: string;
}

export type ComplianceCheckStatus = 'compliant' | 'action_needed' | 'pending';

export interface ComplianceCheck {
  id: string;
  centerId: string;
  category: 'monitoring' | 'health_safety';
  item: string;
  status: ComplianceCheckStatus;
  lastChecked: string;
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
  enrollments: EnrollmentApplication[];
  events: CenterEvent[];
  meals: MealRecord[];
  cacfpClaims: CacfpClaim[];
  documents: CenterDocument[];
  attendanceLog: AttendanceEntry[];
  inspections: Inspection[];
  complaints: Complaint[];
  violations: Violation[];
  correctiveActions: CorrectiveAction[];
  drills: EmergencyDrill[];
  complianceChecks: ComplianceCheck[];
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
