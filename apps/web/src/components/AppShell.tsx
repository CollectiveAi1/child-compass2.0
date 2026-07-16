import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, ChevronDown, Headphones, LogOut, Menu, School } from 'lucide-react';
import { Logo, Avatar, IconButton } from './ui';
import { roleLabel } from '../lib/api';
import { useSession } from '../lib/session';

export interface ShellNotification {
  id: string;
  title: string;
  detail: string;
  tone?: 'warning' | 'info' | 'success';
}

interface AppShellProps {
  children: ReactNode;
  navigation: { id: string; label: string; icon: ReactNode; badge?: number; tag?: string }[];
  active: string;
  onNavigate: (id: string) => void;
  mobile?: boolean;
  title?: string;
  centerName?: string;
  centerDetail?: string;
  notifications?: ShellNotification[];
}

export function AppShell({ children, navigation, active, onNavigate, mobile = false, title, centerName = 'Bright Path Learning Center', centerDetail, notifications = [] }: AppShellProps) {
  const user = useSession(state => state.user)!;
  const clear = useSession(state => state.clear);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<'bell' | 'user' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  return <div className={`app-shell ${mobile ? 'parent-shell' : ''} ${collapsed ? 'nav-collapsed' : ''}`}>
    {mobile ? null : <aside className="sidebar">
      <Logo />
      <nav aria-label="Main navigation">{navigation.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.icon}<span>{item.label}</span>{item.tag ? <em className="nav-tag">{item.tag}</em> : null}{item.badge ? <b className="nav-badge">{item.badge}</b> : null}</button>)}</nav>
      <div className="sidebar-help"><span><Headphones size={20}/></span><b>Need Help?</b><p>We’re here to help.</p><a href="mailto:support@childcompass.app?subject=Support%20request%20from%20Bright%20Path">Contact Support</a></div>
      <button className="logout-link" onClick={clear}><LogOut size={17}/> <span>Sign out</span></button>
    </aside>}
    <div className="shell-main">
      <header className="topbar">
        {mobile ? <Logo/> : <div className="topbar-lead"><IconButton label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed(value => !value)}><Menu size={20}/></IconButton><h1 className="topbar-title">{title ?? navigation.find(item => item.id === active)?.label ?? ''}</h1></div>}
        <div className="topbar-actions" ref={menuRef}>
          {mobile ? null : <div className="center-switcher"><span className="center-dot"><School size={18}/></span><div><b>{centerName}</b>{centerDetail ? <small>{centerDetail}</small> : null}</div><ChevronDown size={16}/></div>}
          <div className="menu-anchor">
            <IconButton label={`Notifications${notifications.length ? ` (${notifications.length})` : ''}`} aria-expanded={menu === 'bell'} onClick={() => setMenu(value => value === 'bell' ? null : 'bell')}>
              <Bell size={19}/>{notifications.length ? <i className="notification-count">{notifications.length}</i> : null}
            </IconButton>
            {menu === 'bell' ? <div className="dropdown-panel notifications-panel" role="menu">
              <header><b>Notifications</b><span>{notifications.length ? `${notifications.length} need attention` : 'All caught up'}</span></header>
              {notifications.length ? notifications.map(item => <div key={item.id} className={`notification-row tone-${item.tone ?? 'info'}`}><i/><div><b>{item.title}</b><small>{item.detail}</small></div></div>) : <p className="dropdown-empty">Nothing needs your attention right now. 🎉</p>}
            </div> : null}
          </div>
          <div className="menu-anchor">
            <button className="user-chip" aria-expanded={menu === 'user'} onClick={() => setMenu(value => value === 'user' ? null : 'user')}>
              <Avatar label={user.avatar} tone={user.role === 'parent' ? 'pink' : user.role === 'teacher' ? 'mint' : 'sky'} size="sm"/>
              <span><b>{user.name}</b><small>{user.title ?? roleLabel[user.role]}</small></span>
              <ChevronDown size={15}/>
            </button>
            {menu === 'user' ? <div className="dropdown-panel user-panel" role="menu">
              <header><b>{user.name}</b><span>{user.email}</span></header>
              <button onClick={clear}><LogOut size={16}/> Sign out</button>
            </div> : null}
          </div>
        </div>
      </header>
      {children}
    </div>
    {mobile ? <nav className="mobile-nav" aria-label="Parent navigation">{navigation.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.icon}<span>{item.label}</span>{item.badge ? <b>{item.badge}</b> : null}</button>)}</nav> : null}
  </div>;
}
