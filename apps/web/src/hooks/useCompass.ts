import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { create } from 'zustand';
import type { ActivityType, AttendanceStatus } from '@compass/shared';
import { API_BASE, api, getDashboard } from '../lib/api';
import { useSession } from '../lib/session';

const POLL_INTERVAL = 15_000;

const useLiveSyncState = create<{ connected: boolean; setConnected: (connected: boolean) => void }>(set => ({ connected: false, setConnected: connected => set({ connected }) }));

export function useDashboard() {
  const token = useSession(state => state.token)!;
  const live = useLiveSyncState(state => state.connected);
  // WebSocket sync pushes invalidations instantly; without it (Vercel serverless,
  // flaky mobile networks) the dashboard falls back to polling.
  return useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard(token), staleTime: 10_000, refetchInterval: live ? false : POLL_INTERVAL });
}

export function useLiveSync() {
  const client = useQueryClient();
  const token = useSession(state => state.token);
  const setConnected = useLiveSyncState(state => state.setConnected);
  useEffect(() => {
    const socket = io(API_BASE || undefined, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 3 });
    const refresh = () => void client.invalidateQueries({ queryKey: ['dashboard'] });
    ['attendance:updated', 'activity:created', 'activity:updated', 'message:created', 'invoice:updated'].forEach(event => socket.on(event, refresh));
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
