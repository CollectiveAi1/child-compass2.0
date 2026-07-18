import { useMemo, useState } from 'react';
import { BookOpen, Calendar, CalendarDays, CalendarX, CheckCircle2, ClipboardCheck, DollarSign, FileBarChart2, MessageCircle, Moon, PenSquare, Plus, RefreshCw, Star, Trash2, UserPlus, UserRoundCheck, Users, UtensilsCrossed, X } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { formatMoney } from '@compass/shared';
import { Button, IconButton, Modal } from '../../components/ui';
import { useAddEvent, useDeleteEvent } from '../../hooks/useCompass';
import { firstName } from '../../lib/format';
import { useSession } from '../../lib/session';
import { momentPhoto } from '../../assets/momentPhoto';
import { attendanceWeek, daysUntil, fmtShortDate, fmtTime, roomName, StatCard, todayIso } from './common';

export type QuickAction = 'add-child' | 'take-attendance' | 'send-message' | 'record-payment' | 'add-activity' | 'view-reports' | 'view-activities' | 'view-curriculum' | 'view-cacfp' | 'view-staff';

function AttendanceChart({ days }: { days: { date: string; present: number; absent: number }[] }) {
  const width = 640, height = 230, padX = 42, padY = 22;
  const max = Math.max(10, Math.ceil(Math.max(...days.map(day => Math.max(day.present, day.absent))) / 5) * 5);
  const x = (index: number) => padX + (index * (width - padX - 16)) / Math.max(days.length - 1, 1);
  const y = (value: number) => height - padY - (value / max) * (height - padY - 18);
  const line = (key: 'present' | 'absent') => days.map((day, index) => `${x(index)},${y(day[key])}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(fraction => Math.round(max * fraction));
  return <figure className="attendance-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Attendance overview line chart">
      {ticks.map(tick => <g key={tick}><line x1={padX} x2={width - 10} y1={y(tick)} y2={y(tick)} className="chart-grid"/><text x={padX - 8} y={y(tick) + 4} className="chart-tick" textAnchor="end">{tick}</text></g>)}
      <polyline className="chart-line absent" points={line('absent')}/>
      <polyline className="chart-line present" points={line('present')}/>
      {days.map((day, index) => <g key={day.date}>
        <circle className="chart-dot absent" cx={x(index)} cy={y(day.absent)} r={4}/>
        <circle className="chart-dot present" cx={x(index)} cy={y(day.present)} r={4.5}/>
        <text x={x(index)} y={height - 4} className="chart-tick" textAnchor="middle">{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</text>
      </g>)}
    </svg>
    <figcaption className="chart-legend"><span><i className="dot present"/>Checked In</span><span><i className="dot absent"/>Absent</span></figcaption>
  </figure>;
}

function EventModal({ onClose }: { onClose: () => void }) {
  const addEvent = useAddEvent();
  const [form, setForm] = useState({ title: '', date: todayIso(), time: '', detail: '', attendees: '' });
  return <Modal title="Add event" eyebrow="Center calendar" onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await addEvent.mutateAsync({ title: form.title, date: form.date, time: form.time || undefined, detail: form.detail || undefined, attendees: form.attendees ? Number(form.attendees) : undefined });
      onClose();
    }}>
      <label>Event title<input required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Family Picnic Friday"/></label>
      <div className="form-row">
        <label>Date<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label>
        <label>Time (optional)<input value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} placeholder="9:00 AM – 1:00 PM"/></label>
      </div>
      <div className="form-row">
        <label>Details (optional)<input maxLength={300} value={form.detail} onChange={event => setForm({ ...form, detail: event.target.value })} placeholder="What families should know"/></label>
        <label>Expected attendees<input type="number" min={0} value={form.attendees} onChange={event => setForm({ ...form, attendees: event.target.value })}/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={!form.title || addEvent.isPending}>{addEvent.isPending ? 'Saving…' : 'Add event'}</Button></div>
    </form>
  </Modal>;
}

const TIPS = [
  'Encourage parents to update their contact information in the Parent Portal.',
  'Record CACFP meal counts at point of service — it keeps claims audit-ready.',
  'Review staff credential expirations at the start of every month.',
  'Print a fresh emergency contact report whenever a family updates their file.',
  'Share one photo moment per child each week to keep families engaged.',
];

export function DashboardTab({ data, onAction }: { data: DashboardData; onAction: (action: QuickAction) => void }) {
  const user = useSession(state => state.user)!;
  const [date, setDate] = useState(todayIso());
  const [addingEvent, setAddingEvent] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const deleteEvent = useDeleteEvent();

  const week = useMemo(() => attendanceWeek(data), [data]);
  const selected = week.find(day => day.date === date) ?? { date, present: 0, absent: data.children.length };
  const enrolledThisMonth = data.children.filter(child => child.enrolledOn && daysUntil(child.enrolledOn) > -30).length;
  const pendingInvoices = data.invoices.filter(invoice => invoice.status !== 'paid');
  const mealsToday = data.meals.filter(record => record.date === todayIso()).reduce((sum, record) => sum + record.childCount + record.adultCount, 0);
  const teachersOnDuty = data.staff.filter(member => member.role === 'teacher').length;
  const upcomingEvents = data.events.filter(event => event.date >= todayIso()).slice(0, 4);
  const recentActivities = data.activities.slice(0, 4);
  const currentClaim = data.cacfpClaims.find(claim => claim.status === 'draft');
  const lastClaim = data.cacfpClaims.find(claim => claim.status === 'approved' || claim.status === 'paid');
  const renewalDate = data.events.find(event => event.title.toLowerCase().includes('renewal'))?.date ?? `${new Date().getFullYear()}-08-15`;

  const quickActions: { action: QuickAction; label: string; icon: typeof UserPlus; tone: string }[] = [
    { action: 'add-child', label: 'Add Child', icon: UserPlus, tone: 'blue' },
    { action: 'take-attendance', label: 'Take Attendance', icon: ClipboardCheck, tone: 'teal' },
    { action: 'send-message', label: 'Send Message', icon: MessageCircle, tone: 'purple' },
    { action: 'record-payment', label: 'Record Payment', icon: DollarSign, tone: 'green' },
    { action: 'add-activity', label: 'Add Activity', icon: PenSquare, tone: 'amber' },
    { action: 'view-reports', label: 'View Reports', icon: FileBarChart2, tone: 'navy' },
  ];

  const activityIcon = (type: string) => type === 'meal' ? <UtensilsCrossed/> : type === 'nap' ? <Moon/> : type === 'learning' ? <BookOpen/> : type === 'moment' ? <CheckCircle2/> : <MessageCircle/>;

  return <>
    <div className="dashboard-welcome">
      <div><h1>Welcome back, {firstName(user.name)}! 👋</h1><p>Here’s what’s happening at {data.center.name} today.</p></div>
      <label className="date-chip"><Calendar size={16}/><input type="date" value={date} max={todayIso()} onChange={event => setDate(event.target.value || todayIso())} aria-label="Dashboard date"/></label>
    </div>

    <section className="stat-grid">
      <StatCard icon={<Users/>} tone="blue" label="Total Children" value={data.children.length} sub={<><span className="up-arrow">↑</span> {enrolledThisMonth} this month</>} subTone="positive"/>
      <StatCard icon={<UserRoundCheck/>} tone="teal" label="Checked In" value={selected.present} sub={`${Math.round((selected.present / Math.max(data.children.length, 1)) * 100)}% of enrolled`}/>
      <StatCard icon={<CalendarX/>} tone="red" label="Absent" value={selected.absent} sub={`${Math.round((selected.absent / Math.max(data.children.length, 1)) * 100)}% of enrolled`}/>
      <StatCard icon={<Users/>} tone="green" label="Staff On Duty" value={teachersOnDuty} actionLabel="View schedule" onClick={() => onAction('view-staff')}/>
      <StatCard icon={<DollarSign/>} tone="amber" label="Pending Payments" value={pendingInvoices.length} sub={<b className="amber-figure">{formatMoney(pendingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0))}</b>} onClick={() => onAction('record-payment')}/>
      <StatCard icon={<UtensilsCrossed/>} tone="teal" label="CACFP Today" value={mealsToday} sub="Meals Served" onClick={() => onAction('view-cacfp')}/>
    </section>

    <section className="dashboard-mid">
      <article className="panel chart-panel">
        <header><div><h2><CalendarDays size={18} className="head-icon"/> Attendance Overview</h2><p>{fmtShortDate(week[0]!.date)} – {fmtShortDate(week[week.length - 1]!.date)}</p></div><span className="range-chip">This Week</span></header>
        <AttendanceChart days={week}/>
      </article>
      <article className="panel list-panel">
        <header><h2>Recent Activities</h2><button className="link-button" onClick={() => onAction('view-activities')}>View All</button></header>
        <div className="feed-list">{recentActivities.map(activity => <div key={activity.id} className={`feed-row type-${activity.type}`}><span>{activityIcon(activity.type)}</span><div><b>{activity.title}</b><small>by {activity.authorName} · {roomName(data, activity.classroomId)}</small></div><time>{fmtTime(activity.createdAt)}</time></div>)}</div>
      </article>
      <article className="panel list-panel">
        <header><h2>Upcoming Events</h2><div className="header-buttons"><button className="link-button" onClick={() => setAddingEvent(true)}><Plus size={14}/> Add</button></div></header>
        <div className="event-list">{upcomingEvents.length ? upcomingEvents.map(event => <div key={event.id} className="event-row">
          <span className="event-date"><b>{new Date(`${event.date}T12:00:00`).toLocaleDateString([], { month: 'short' }).toUpperCase()}</b><i>{new Date(`${event.date}T12:00:00`).getDate()}</i></span>
          <div><b>{event.title}</b>{event.detail ? <small>{event.detail}</small> : null}{event.time ? <small>{event.time}{event.attendees ? <> · <Users size={11}/> {event.attendees}</> : null}</small> : null}</div>
          <IconButton label={`Remove ${event.title}`} className="icon-button event-remove" onClick={() => deleteEvent.mutate({ eventId: event.id })}><Trash2 size={14}/></IconButton>
        </div>) : <p className="empty-note">No upcoming events yet — add the first one.</p>}</div>
      </article>
    </section>

    <section className="dashboard-low">
      <article className="panel cacfp-panel">
        <header><h2><UtensilsCrossed size={18} className="head-icon"/> CACFP (Child and Adult Food Program)</h2><button className="link-button" onClick={() => onAction('view-cacfp')}>View CACFP Dashboard</button></header>
        <div className="cacfp-mini-grid">
          <div className="cacfp-mini"><p>Meals Served Today</p><span className="cacfp-icon teal"><UtensilsCrossed/></span><h3>{mealsToday}</h3><small>Children: {data.meals.filter(r => r.date === todayIso()).reduce((s, r) => s + r.childCount, 0)} · Adults: {data.meals.filter(r => r.date === todayIso()).reduce((s, r) => s + r.adultCount, 0)}</small><button className="link-button" onClick={() => onAction('view-cacfp')}>View Meal Count</button></div>
          <div className="cacfp-mini"><p>Claim Month</p><span className="cacfp-icon blue"><Calendar/></span><h3>{currentClaim ? new Date(`${currentClaim.month}-15T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '—'}</h3><small>Days Submitted {currentClaim ? `${currentClaim.daysSubmitted} / ${currentClaim.daysInMonth}` : '—'}</small><button className="link-button" onClick={() => onAction('view-cacfp')}>Continue Claim</button></div>
          <div className="cacfp-mini"><p>Last Claim</p><span className="cacfp-icon green"><CheckCircle2/></span><h3>{lastClaim ? new Date(`${lastClaim.month}-15T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '—'}</h3><small className="status-approved">Status: {lastClaim?.status ?? '—'}</small><small>{lastClaim ? formatMoney(lastClaim.amount) : ''}</small><button className="link-button" onClick={() => onAction('view-cacfp')}>View Claims History</button></div>
          <div className="cacfp-mini"><p>Renewal Due</p><span className="cacfp-icon amber"><RefreshCw/></span><h3>{fmtShortDate(renewalDate)}, {renewalDate.slice(0, 4)}</h3><small>Days Remaining {Math.max(daysUntil(renewalDate), 0)}</small><button className="link-button" onClick={() => onAction('view-cacfp')}>Manage Renewal</button></div>
        </div>
        <footer className="cacfp-next"><p><b>Next Steps:</b> Continue entering meal counts for today to keep your claim up to date.</p><Button className="button-teal" onClick={() => onAction('view-cacfp')}>Go to CACFP</Button></footer>
      </article>
      <div className="dashboard-side">
        <article className="panel quick-actions-panel">
          <header><h2>Quick Actions</h2></header>
          <div className="quick-actions-grid">{quickActions.map(({ action, label, icon: Icon, tone }) => <button key={action} onClick={() => onAction(action)}><span className={`qa-icon tone-${tone}`}><Icon/></span><small>{label}</small></button>)}</div>
        </article>
        <article className="curriculum-promo">
          <div><span className="promo-sun">☀</span><h2>Bright Path Curriculum</h2><p>Nurturing hearts.<br/>Inspiring minds.</p><Button className="white-outline-button" onClick={() => onAction('view-curriculum')}>View Curriculum</Button></div>
          <span className="promo-art"><img src={momentPhoto} alt="Children exploring flowers together outside"/></span>
        </article>
      </div>
    </section>

    <footer className="dashboard-strip">
      <p><Star size={15} className="strip-star"/> You’re doing great! {data.children.length} children are learning and growing every day.</p>
      <p className="strip-tip"><b>Tip:</b> {TIPS[0]}</p>
      <button className="link-button" onClick={() => setShowTips(true)}>View Tips ›</button>
    </footer>

    {addingEvent ? <EventModal onClose={() => setAddingEvent(false)}/> : null}
    {showTips ? <Modal title="Director tips" eyebrow="Bright ideas" onClose={() => setShowTips(false)}>
      <ul className="tips-list">{TIPS.map(tip => <li key={tip}><Star size={14}/>{tip}</li>)}</ul>
      <div className="modal-actions"><Button className="button-primary" onClick={() => setShowTips(false)}><X size={15}/> Close</Button></div>
    </Modal> : null}
  </>;
}
