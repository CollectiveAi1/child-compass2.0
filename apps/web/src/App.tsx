import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { portalForRole } from '@compass/shared';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/ui';
import { AdminPortal } from './portals/AdminPortal';
import { TeacherPortal } from './portals/TeacherPortal';
import { ParentPortal } from './portals/ParentPortal';
import { login } from './lib/api';
import { useSession } from './lib/session';
import { useLiveSync } from './hooks/useCompass';

function AuthenticatedApp() {
  const user = useSession(state => state.user)!;
  useLiveSync();
  return <Routes>
    <Route path="/admin" element={user.role === 'admin' ? <AdminPortal/> : <Navigate to={portalForRole(user.role)} replace/>}/>
    <Route path="/teacher" element={user.role === 'teacher' ? <TeacherPortal/> : <Navigate to={portalForRole(user.role)} replace/>}/>
    <Route path="/parent" element={user.role === 'parent' ? <ParentPortal/> : <Navigate to={portalForRole(user.role)} replace/>}/>
    <Route path="*" element={<Navigate to={portalForRole(user.role)} replace/>}/>
  </Routes>;
}

export function App() {
  const user = useSession(state => state.user); const setSession = useSession(state => state.setSession); const client = useQueryClient(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const handleLogin = async (email: string, password: string) => { setLoading(true); setError(''); try { const result = await login(email, password); setSession(result.token, result.user); await client.invalidateQueries(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); } finally { setLoading(false); } };
  return <HashRouter>{user ? <AuthenticatedApp/> : <LoginScreen onLogin={handleLogin} loading={loading} error={error}/>}</HashRouter>;
}

export default App;
