import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, BadgeDollarSign, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, FileCheck2, LayoutDashboard, MoreHorizontal, Search, Settings, ShieldCheck, Sparkles, Users, UserRoundCheck, WalletCards } from 'lucide-react';
import type { Child } from '@compass/shared';
import { childAge, formatMoney } from '@compass/shared';
import { AppShell } from '../components/AppShell';
import { Avatar, Button, ErrorScreen, IconButton, LoadingScreen, spring } from '../components/ui';
import { useDashboard } from '../hooks/useCompass';
import { firstName, todayLabel } from '../lib/format';
import { useSession } from '../lib/session';

const navigation = [
  { id: 'control', label: 'Control Center', icon: <LayoutDashboard size={19}/> },
  { id: 'people', label: 'Children & Staff', icon: <Users size={19}/> },
  { id: 'billing', label: 'Billing', icon: <WalletCards size={19}/> },
  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck size={19}/> },
  { id: 'settings', label: 'Center Settings', icon: <Settings size={19}/> },
];

function ChildRow({ child, selected, onSelect }: { child: Child; selected: boolean; onSelect: () => void }) {
  return <button className={`child-list-row ${selected ? 'selected' : ''}`} onClick={onSelect}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/><span><b>{child.firstName} {child.lastName}</b><small>{childAge(child.birthday)} · {child.attendanceStatus.replace('_', ' ')}</small></span><i className={`status-dot status-${child.attendanceStatus}`}/><ChevronRight size={16}/></button>;
}

export function AdminPortal() {
  const { data, isError, refetch } = useDashboard();
  const user = useSession(state => state.user)!;
  const clear = useSession(state => state.clear);
  const [active, setActive] = useState('control');
  const [selectedId, setSelectedId] = useState('child-1');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'expected'>('all');
  const selected = data?.children.find(child => child.id === selectedId) || data?.children[0];
  const filtered = useMemo(() => data?.children.filter(child => `${child.firstName} ${child.lastName}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || child.attendanceStatus === statusFilter)) || [], [data, search, statusFilter]);
  if (!data) return isError ? <ErrorScreen onRetry={() => void refetch()} onSignOut={clear}/> : <LoadingScreen/>;
  const occupancy = Math.round((data.stats.present / Math.max(data.stats.capacity, 1)) * 100);

  return <AppShell navigation={navigation} active={active} onNavigate={setActive}>
    <main className="portal-page admin-page">
      <div className="page-heading"><div><p className="eyebrow">{todayLabel()}</p><h1>{active === 'control' ? `Good morning, ${firstName(user.name)}.` : navigation.find(item => item.id === active)?.label}</h1><p>{active === 'control' ? 'Your center is calm, covered, and ready for the day.' : 'Everything you need, gathered in one clear view.'}</p></div><Button className="button-primary"><Sparkles size={17}/> Create update</Button></div>

      {active === 'control' ? <>
        <section className="admin-kpi-grid">
          <motion.article className="kpi-card kpi-attendance" whileHover={{ y: -3 }} transition={spring}><div className="kpi-icon"><UserRoundCheck/></div><span className="trend positive">+4 today</span><p>Children present</p><h2>{data.stats.present}<small> / {data.stats.capacity}</small></h2><div className="progress"><i style={{ width: `${occupancy}%` }}/></div><footer><b>{occupancy}% occupancy</b><span>{data.stats.expected} still expected</span></footer></motion.article>
          <motion.article className="kpi-card" whileHover={{ y: -3 }} transition={spring}><div className="kpi-icon mint"><Users/></div><span className="trend positive">All covered</span><p>Team on site</p><h2>{data.stats.staffOnSite}<small> educators</small></h2><div className="ratio-row"><span>Center ratio</span><b>1:{Math.ceil(data.stats.present / Math.max(data.stats.staffOnSite, 1))}</b></div><footer><CheckCircle2 size={15}/><span>Every classroom in ratio</span></footer></motion.article>
          <motion.article className="kpi-card" whileHover={{ y: -3 }} transition={spring}><div className="kpi-icon yellow"><CircleDollarSign/></div><span className="trend">July</span><p>Tuition collected</p><h2>{formatMoney(data.stats.revenueCollected)}</h2><div className="progress yellow"><i style={{ width: '63%' }}/></div><footer><b>{formatMoney(data.stats.revenueOutstanding)}</b><span>outstanding</span></footer></motion.article>
          <motion.article className="kpi-card" whileHover={{ y: -3 }} transition={spring}><div className="kpi-icon pink"><FileCheck2/></div><span className="trend positive">96%</span><p>Compliance pulse</p><h2>Strong</h2><div className="mini-checks"><span>12 complete</span><span>1 due soon</span></div><footer><ShieldCheck size={15}/><span>Licensing ready</span></footer></motion.article>
        </section>

        <section className="admin-dashboard-grid">
          <article className="panel classroom-pulse"><header><div><p className="eyebrow">Live now</p><h2>Classroom pulse</h2></div><button>View all <ArrowUpRight size={15}/></button></header><div className="room-grid">{data.classrooms.map(room => { const children = data.children.filter(child => child.classroomId === room.id); const present = children.filter(child => child.attendanceStatus === 'present').length; const teachers = data.staff.filter(staff => staff.classroomIds.includes(room.id)).length; return <button className="room-card" key={room.id} onClick={() => { setActive('people'); setSelectedId(children[0]?.id || selectedId); }}><span className="room-swatch" style={{ background: room.color }}>✦</span><div><h3>{room.name}</h3><p>{room.ageRange}</p></div><b>{present}<small> present</small></b><div className="ratio-pill"><Users size={14}/>{teachers || 1} teacher{teachers === 1 ? '' : 's'} · 1:{Math.ceil(present / Math.max(teachers, 1))}</div><ChevronRight size={17}/></button> })}</div></article>
          <article className="panel attention-panel"><header><div><p className="eyebrow">Your attention</p><h2>Gentle nudges</h2></div><span className="count-pill">3</span></header><div className="attention-list"><button><span className="attention-icon warning"><AlertTriangle/></span><span><b>One payment is overdue</b><small>Arlo Shah · 2 days</small></span><ChevronRight/></button><button><span className="attention-icon calendar"><CalendarDays/></span><span><b>Staff credential due</b><small>CPR renewal · 12 days</small></span><ChevronRight/></button><button><span className="attention-icon calm"><Clock3/></span><span><b>3 children expected</b><small>Arrival window ends 9:30 AM</small></span><ChevronRight/></button></div></article>
          <article className="panel center-timeline"><header><div><p className="eyebrow">Today at Willow & Wonder</p><h2>Center timeline</h2></div><IconButton label="More options"><MoreHorizontal/></IconButton></header><div className="timeline-list"><div><i className="timeline-dot mint"/><time>8:42</time><span><b>Noah checked in</b><small>Sunbeam Studio · Jordan Ellis</small></span></div><div><i className="timeline-dot pink"/><time>9:10</time><span><b>Garden exploration began</b><small>8 children tagged in a new moment</small></span></div><div><i className="timeline-dot blue"/><time>10:05</time><span><b>Ratio check complete</b><small>All rooms within licensed ratio</small></span></div><div><i className="timeline-dot yellow"/><time>11:30</time><span><b>Lunch service underway</b><small>Allergy plans confirmed</small></span></div></div></article>
          <article className="panel upcoming-card"><div className="upcoming-art"><span>☀</span><i>⌁</i><b>♡</b></div><p className="eyebrow">Coming up</p><h2>Family Picnic Friday</h2><p>18 families have RSVP’d. Weather looks perfect.</p><Button className="button-soft">Open event</Button></article>
        </section>
      </> : null}

      {active === 'people' ? <section className="people-workspace">
        <article className="panel people-list"><header><div><p className="eyebrow">Center roster</p><h2>Children</h2></div><span>{data.children.length} enrolled</span></header><label className="search-box"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search children…"/></label><div className="filter-chips"><button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>All children</button><button className={statusFilter === 'present' ? 'active' : ''} onClick={() => setStatusFilter('present')}>Present</button><button className={statusFilter === 'expected' ? 'active' : ''} onClick={() => setStatusFilter('expected')}>Expected</button></div><div className="children-scroll">{filtered.map(child => <ChildRow key={child.id} child={child} selected={child.id === selected?.id} onSelect={() => setSelectedId(child.id)}/>)}</div></article>
        {selected ? <article className="panel child-context"><div className="context-hero"><Avatar label={`${selected.firstName} ${selected.lastName}`} tone={selected.avatar} size="lg"/><div><p className="eyebrow">Child profile</p><h2>{selected.firstName} {selected.lastName}</h2><p>{childAge(selected.birthday)} · {data.classrooms.find(room => room.id === selected.classroomId)?.name}</p></div><IconButton label="More options"><MoreHorizontal/></IconButton></div><div className="context-status"><span className={`status-chip status-${selected.attendanceStatus}`}>{selected.attendanceStatus.replace('_', ' ')}</span><small>{selected.checkedInAt ? `Arrived ${new Date(selected.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not checked in'}</small></div><div className="detail-grid"><div><small>Birthday</small><b>{new Date(`${selected.birthday}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</b></div><div><small>Allergies</small><b>{selected.allergies.join(', ') || 'None noted'}</b></div><div className="full"><small>Care notes</small><p>{selected.notes}</p></div></div><h3>Today’s story</h3><div className="mini-activity-list">{data.activities.filter(activity => activity.childIds.includes(selected.id)).slice(0, 4).map(activity => <div key={activity.id}><span>{activity.type === 'meal' ? '🍓' : activity.type === 'nap' ? '☾' : activity.type === 'learning' ? '✎' : '✦'}</span><div><b>{activity.title}</b><small>{new Date(activity.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small><p>{activity.body}</p></div></div>)}</div></article> : null}
      </section> : null}

      {active === 'billing' ? <section className="billing-view"><div className="billing-summary"><article><BadgeDollarSign/><p>Collected this month</p><h2>{formatMoney(data.stats.revenueCollected)}</h2><span>63% of expected revenue</span></article><article><Clock3/><p>Outstanding</p><h2>{formatMoney(data.stats.revenueOutstanding)}</h2><span>2 family accounts</span></article><article><CheckCircle2/><p>Auto-pay families</p><h2>82%</h2><span>Above center average</span></article></div><article className="panel invoice-table"><header><div><p className="eyebrow">July ledger</p><h2>Family invoices</h2></div><Button className="button-soft">Export report</Button></header><div className="table-head"><span>Family</span><span>Description</span><span>Due date</span><span>Amount</span><span>Status</span></div>{data.invoices.map(invoice => { const child = data.children.find(item => item.id === invoice.childId); return <div className="table-row" key={invoice.id}><span><Avatar label={child ? `${child.firstName} ${child.lastName}` : 'Family'} tone={child?.avatar}/><b>{child?.firstName} {child?.lastName}</b></span><span>{invoice.description}</span><span>{new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><strong>{formatMoney(invoice.amount)}</strong><span className={`invoice-status ${invoice.status}`}>{invoice.status}</span></div>})}</article></section> : null}

      {active === 'compliance' ? <section className="coming-view panel"><span className="giant-icon"><ShieldCheck/></span><p className="eyebrow">Compliance compass</p><h2>Your center is 96% licensing ready.</h2><p>One staff CPR credential renews in 12 days. Every child file and classroom ratio check is complete.</p><div className="compliance-meter"><i style={{ width: '96%' }}/></div><Button className="button-primary">Review credential</Button></section> : null}
      {active === 'settings' ? <section className="coming-view panel"><span className="giant-icon"><Settings/></span><p className="eyebrow">Center settings</p><h2>{data.center.name}</h2><p>{data.center.address}<br/>{data.center.phone} · License {data.center.license}</p><Button className="button-soft">Edit center profile</Button></section> : null}
    </main>
  </AppShell>;
}
