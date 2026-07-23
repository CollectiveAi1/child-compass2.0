import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { create } from 'zustand';
import type { ActivityType, AttendanceStatus, ChildMedical, ComplaintStatus, ComplianceCheckStatus, CorrectiveActionStatus, DocumentCategory, DrillType, InspectionStatus, InspectionType, MealType, Message, StaffCredential, TuitionRates, ViolationSeverity, ViolationStatus } from '@compass/shared';
import { API_BASE, ApiFailure, api, getDashboard } from '../lib/api';
import { useSession } from '../lib/session';

const POLL_INTERVAL = 15_000;

const useLiveSyncState = create<{ connected: boolean; setConnected: (connected: boolean) => void }>(set => ({ connected: false, setConnected: connected => set({ connected }) }));

export function useDashboard() {
  const token = useSession(state => state.token)!;
  const clear = useSession(state => state.clear);
  const live = useLiveSyncState(state => state.connected);
  // WebSocket sync pushes invalidations instantly; without it (Vercel serverless,
  // flaky mobile networks) the dashboard falls back to polling.
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard(token), staleTime: 10_000, refetchInterval: live ? false : POLL_INTERVAL });
  // A persisted session can outlive its 12h token; send the user back to sign-in
  // instead of leaving them on a dead dashboard.
  useEffect(() => {
    if (query.error instanceof ApiFailure && query.error.status === 401) clear();
  }, [query.error, clear]);
  return query;
}

export function useLiveSync() {
  const client = useQueryClient();
  const token = useSession(state => state.token);
  const setConnected = useLiveSyncState(state => state.setConnected);
  useEffect(() => {
    const socket = io(API_BASE || undefined, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 3 });
    const refresh = () => void client.invalidateQueries({ queryKey: ['dashboard'] });
    ['attendance:updated', 'activity:created', 'activity:updated', 'message:created', 'invoice:updated', 'data:updated'].forEach(event => socket.on(event, refresh));
    socket.on('connect', () => { setConnected(true); refresh(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    return () => { setConnected(false); socket.disconnect(); };
  }, [client, token, setConnected]);
}

function useCompassMutation<TVariables>(path: (value: TVariables) => string, method: string, body: (value: TVariables) => unknown) {
  const token = useSession(state => state.token)!;
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: TVariables) => api(path(value), { method, body: JSON.stringify(body(value)) }, token),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['dashboard'] }),
  });
}

export const useAttendance = () => useCompassMutation<{ childId: string; status: AttendanceStatus; signature?: string }>(v => `/attendance/${v.childId}`, 'PATCH', v => ({ status: v.status, signature: v.signature }));
export const useActivity = () => useCompassMutation<{ childIds: string[]; type: ActivityType; title: string; body: string; value?: string; mediaUrl?: string }>(() => '/activities', 'POST', v => v);
export const useMessage = () => useCompassMutation<{ childId: string; body: string }>(() => '/messages', 'POST', v => v);
export const useLike = () => useCompassMutation<{ activityId: string }>(v => `/activities/${v.activityId}/like`, 'PATCH', () => ({}));
export const usePayment = () => useCompassMutation<{ invoiceId: string }>(v => `/invoices/${v.invoiceId}/pay`, 'POST', () => ({}));

export interface NewChildInput { firstName: string; lastName: string; birthday: string; classroomId: string; guardianName?: string; guardianPhone?: string; allergies?: string[]; notes?: string; authorizedPickup?: string[] }
export interface ChildUpdateInput { childId: string; firstName?: string; lastName?: string; classroomId?: string; guardianName?: string; guardianPhone?: string; allergies?: string[]; notes?: string; authorizedPickup?: string[]; medical?: ChildMedical }
export interface NewEnrollmentInput { childName: string; birthday: string; guardianName: string; guardianEmail: string; guardianPhone: string; classroomId: string; requestedStart: string; notes?: string }
export interface NewStaffInput { name: string; email: string; title?: string; phone?: string; classroomIds?: string[]; credentials?: StaffCredential[] }

export const useAddChild = () => useCompassMutation<NewChildInput>(() => '/children', 'POST', v => v);
export const useUpdateChild = () => useCompassMutation<ChildUpdateInput>(v => `/children/${v.childId}`, 'PATCH', ({ childId: _childId, ...rest }) => rest);
export const useAddEnrollment = () => useCompassMutation<NewEnrollmentInput>(() => '/enrollments', 'POST', v => v);
export const useUpdateEnrollment = () => useCompassMutation<{ enrollmentId: string; status?: string; notes?: string }>(v => `/enrollments/${v.enrollmentId}`, 'PATCH', ({ enrollmentId: _id, ...rest }) => rest);
export const useAddStaff = () => useCompassMutation<NewStaffInput>(() => '/staff', 'POST', v => v);
export const useUpdateStaff = () => useCompassMutation<{ staffId: string; title?: string; phone?: string; classroomIds?: string[]; credentials?: StaffCredential[] }>(v => `/staff/${v.staffId}`, 'PATCH', ({ staffId: _id, ...rest }) => rest);
export const useRecordMeal = () => useCompassMutation<{ date: string; meal: MealType; childCount: number; adultCount: number }>(() => '/meals', 'POST', v => v);
export const useAddEvent = () => useCompassMutation<{ title: string; date: string; time?: string; detail?: string; attendees?: number }>(() => '/events', 'POST', v => v);
export const useDeleteEvent = () => useCompassMutation<{ eventId: string }>(v => `/events/${v.eventId}`, 'DELETE', () => ({}));
export const useUploadDocument = () => useCompassMutation<{ name: string; category: DocumentCategory; contentType: string; size: number; dataUrl: string }>(() => '/documents', 'POST', v => v);
export const useDeleteDocument = () => useCompassMutation<{ documentId: string }>(v => `/documents/${v.documentId}`, 'DELETE', () => ({}));
export const useCreateInvoice = () => useCompassMutation<{ childId: string; amount: number; dueDate: string; description: string }>(() => '/invoices', 'POST', v => v);
export const useRecordPayment = () => useCompassMutation<{ invoiceId: string; method: string }>(v => `/invoices/${v.invoiceId}/record-payment`, 'POST', ({ invoiceId: _id, ...rest }) => rest);
export const useUpdateCenter = () => useCompassMutation<{ name?: string; address?: string; phone?: string; license?: string; capacity?: number; autoWeeklyBilling?: boolean }>(() => '/center', 'PATCH', v => v);
export const useAddClassroom = () => useCompassMutation<{ name: string; ageRange: string; capacity: number; ratioLimit: number; rates: TuitionRates }>(() => '/classrooms', 'POST', v => v);
export const useUpdateClassroom = () => useCompassMutation<{ classroomId: string; name?: string; ageRange?: string; capacity?: number; ratioLimit?: number; rates?: TuitionRates }>(v => `/classrooms/${v.classroomId}`, 'PATCH', ({ classroomId: _id, ...rest }) => rest);
export const useRunWeeklyBilling = () => useCompassMutation<Record<string, never>>(() => '/billing/run-weekly', 'POST', () => ({}));

export interface NewInspectionInput { date: string; type: InspectionType; inspector: string; status: InspectionStatus; findings: number; notes: string }
export const useAddInspection = () => useCompassMutation<NewInspectionInput>(() => '/inspections', 'POST', v => v);
export const useUpdateInspection = () => useCompassMutation<{ inspectionId: string } & Partial<NewInspectionInput>>(v => `/inspections/${v.inspectionId}`, 'PATCH', ({ inspectionId: _id, ...rest }) => rest);
export const useAddComplaint = () => useCompassMutation<{ receivedOn: string; source: string; summary: string }>(() => '/complaints', 'POST', v => v);
export const useUpdateComplaint = () => useCompassMutation<{ complaintId: string; status?: ComplaintStatus; resolution?: string }>(v => `/complaints/${v.complaintId}`, 'PATCH', ({ complaintId: _id, ...rest }) => rest);
export const useAddViolation = () => useCompassMutation<{ code: string; description: string; severity: ViolationSeverity; citedOn: string; inspectionId?: string }>(() => '/violations', 'POST', v => v);
export const useUpdateViolation = () => useCompassMutation<{ violationId: string; status: ViolationStatus }>(v => `/violations/${v.violationId}`, 'PATCH', v => ({ status: v.status }));
export const useAddCorrectiveAction = () => useCompassMutation<{ violationId?: string; description: string; assignedTo: string; dueDate: string }>(() => '/corrective-actions', 'POST', v => v);
export const useUpdateCorrectiveAction = () => useCompassMutation<{ actionId: string; status: CorrectiveActionStatus }>(v => `/corrective-actions/${v.actionId}`, 'PATCH', v => ({ status: v.status }));
export const useAddDrill = () => useCompassMutation<{ type: DrillType; date: string; timeOfDay: string; durationMinutes: number; participants: number; notes?: string }>(() => '/drills', 'POST', v => v);
export const useUpdateComplianceCheck = () => useCompassMutation<{ checkId: string; status: ComplianceCheckStatus }>(v => `/compliance-checks/${v.checkId}`, 'PATCH', v => ({ status: v.status }));

// Marks the visible thread's incoming messages as read so unread badges clear.
// Pass `undefined` while the messages view is closed to leave counts alone.
export function useMarkThreadRead(thread: Message[] | undefined, userId: string) {
  const markRead = useCompassMutation<{ messageId: string }>(v => `/messages/${v.messageId}/read`, 'PATCH', () => ({}));
  const { mutate } = markRead;
  const seen = useRef(new Set<string>());
  useEffect(() => {
    thread?.filter(message => message.senderId !== userId && !message.readBy.includes(userId) && !seen.current.has(message.id))
      .forEach(message => { seen.current.add(message.id); mutate({ messageId: message.id }); });
  }, [thread, userId, mutate]);
}
