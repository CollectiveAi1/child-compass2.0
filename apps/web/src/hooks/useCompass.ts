import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { ActivityType, AttendanceStatus } from '@compass/shared';
import { api, getDashboard } from '../lib/api';
import { useSession } from '../lib/session';

export function useDashboard() {
  const token = useSession(state => state.token)!;
  return useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard(token), staleTime: 20_000 });
}

export function useLiveSync() {
  const client = useQueryClient();
  const token = useSession(state => state.token);
  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'], auth: { token } });
    const refresh = () => void client.invalidateQueries({ queryKey: ['dashboard'] });
    ['attendance:updated', 'activity:created', 'activity:updated', 'message:created', 'invoice:updated'].forEach(event => socket.on(event, refresh));
    return () => { socket.disconnect(); };
  }, [client, token]);
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
