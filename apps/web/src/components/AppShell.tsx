import type { ReactNode } from 'react';
import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { Logo, Avatar, IconButton } from './ui';
import { roleLabel } from '../lib/api';
import { useSession } from '../lib/session';

export function AppShell({ children, navigation, active, onNavigate, mobile = false }: { children: ReactNode; navigation: { id: string; label: string; icon: ReactNode; badge?: number }[]; active: string; onNavigate: (id: string) => void; mobile?: boolean }) {
  const user = useSession(state => state.user)!;
  const clear = useSession(state => state.clear);
  return <div className={`app-shell ${mobile ? 'parent-shell' : ''}`}>
    {mobile ? null : <aside className="sidebar"><Logo/><nav aria-label="Main navigation">{navigation.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.icon}<span>{item.label}</span>{item.badge ? <b className="nav-badge">{item.badge}</b> : null}</button>)}</nav><div className="sidebar-help"><span>✦</span><b>Need a hand?</b><p>Compass support is here for your center.</p><button>Visit help center</button></div><button className="logout-link" onClick={clear}><LogOut size={17}/> Sign out</button></aside>}
    <div className="shell-main"><header className="topbar">{mobile ? <Logo/> : <div className="center-switcher"><span className="center-dot">W</span><div><b>Willow & Wonder</b><small>Columbus Center</small></div><ChevronDown size={16}/></div>}<div className="topbar-actions"><IconButton label="Notifications"><Bell size={19}/><i className="notification-dot"/></IconButton><div className="user-chip"><Avatar label={user.avatar} tone={user.role === 'parent' ? 'pink' : user.role === 'teacher' ? 'mint' : 'sky'} size="sm"/><span><b>{user.name}</b><small>{roleLabel[user.role]}</small></span></div></div></header>{children}</div>
    {mobile ? <nav className="mobile-nav" aria-label="Parent navigation">{navigation.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.icon}<span>{item.label}</span>{item.badge ? <b>{item.badge}</b> : null}</button>)}</nav> : null}
  </div>;
}
