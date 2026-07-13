import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@compass/shared';

interface SessionState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(persist(
  set => ({ token: null, user: null, setSession: (token, user) => set({ token, user }), clear: () => set({ token: null, user: null }) }),
  { name: 'compass-session-v1' },
));
