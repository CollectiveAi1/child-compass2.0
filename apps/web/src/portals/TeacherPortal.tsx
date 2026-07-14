import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Camera, Check, ChevronRight, ClipboardCheck, Clock3, Coffee, FileText, LayoutDashboard, MessageCircle, Moon, MoreHorizontal, Plus, Send, Sparkles, Utensils, Users } from 'lucide-react';
import type { ActivityType, AttendanceStatus, Child } from '@compass/shared';
import { nextAttendanceStatus } from '@compass/shared';
import { AppShell } from '../components/AppShell';
import { Avatar, Button, ErrorScreen, IconButton, LoadingScreen, Modal, spring } from '../components/ui';
import { useActivity, useAttendance, useDashboard, useMessage } from '../hooks/useCompass';
import { firstName } from '../lib/format';
import { useSession } from '../lib/session';

const nav = [
  { id: 'today', label: 'Today', icon: <LayoutDashboard size={19}/> },
  { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck size={19}/> },
  { id: 'curriculum', label: 'Curriculum', icon: <BookOpen size={19}/> },
  { id: 'messages', label: 'Family Messages', icon: <MessageCircle size={19}/> },
];

function timeMode() {
  const hour = new Date().getHours();
  if (hour < 11) return { label: 'Morning · Check-in mode', title: 'Good morning', note: 'Let’s welcome every little learner.', tone: 'morning' };
  if (hour < 15) return { label: 'Midday · Care mode', title: 'You’re doing beautifully', note: 'Quick logs are ready for lunch and rest time.', tone: 'midday' };
  return { label: 'Afternoon · Sync mode', title: 'Almost home time', note: 'Capture the day and connect with families.', tone: 'afternoon' };
}

function chime() {
  try {
    const ContextClass: typeof window.AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    const context = new ContextClass();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.connect(gain); gain.connect(context.destination);
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, context.currentTime + index * .07); gain.gain.linearRampToValueAtTime(.08, context.currentTime + index * .07 + .02); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + index * .07 + .28); oscillator.start(context.currentTime + index * .07); oscillator.stop(context.currentTime + index * .07 + .3);
    });
  } catch { /* Audio is an enhancement. */ }
}

function ChildCard({ child, onMove, busy }: { child: Child; onMove: (child: Child) => void; busy: boolean }) {
  const action = child.attendanceStatus === 'expected' ? 'Check in' : child.attendanceStatus === 'present' ? 'Handover' : 'Reset';
  return <motion.button layout layoutId={child.id} className="kanban-child" onClick={() => onMove(child)} disabled={busy} whileTap={{ scale: .96 }} transition={spring}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/><span><b>{child.firstName} {child.lastName}</b><small>{child.allergies.length ? `⚠ ${child.allergies.join(', ')}` : child.checkedInAt ? new Date(child.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Expected today'}</small></span><em>{action}<ChevronRight size={14}/></em></motion.button>;
}

function QuickLog({ children, onClose }: { children: Child[]; onClose: () => void }) {
  const create = useActivity();
  const [type, setType] = useState<ActivityType>('moment');
  const [selected, setSelected] = useState<string[]>(children.filter(child => child.attendanceStatus === 'present').slice(0, 1).map(child => child.id));
  const [title, setTitle] = useState('A lovely little moment');
  const [body, setBody] = useState('');
  const [value, setValue] = useState('');
  const types: { id: ActivityType; label: string; icon: typeof Camera }[] = [{ id: 'moment', label: 'Moment', icon: Camera }, { id: 'meal', label: 'Meal', icon: Utensils }, { id: 'nap', label: 'Nap', icon: Moon }, { id: 'learning', label: 'Learning', icon: BookOpen }, { id: 'note', label: 'Note', icon: FileText }, { id: 'incident', label: 'Incident', icon: ClipboardCheck }];
  const submit = async (event: FormEvent) => { event.preventDefault(); await create.mutateAsync({ childIds: selected, type, title, body, value: value || undefined, mediaUrl: type === 'moment' ? '/garden-moment.svg' : undefined }); chime(); onClose(); };
  return <Modal title="Quick log" eyebrow="Share the day" onClose={onClose} wide><form className="quick-log-form" onSubmit={submit}><div className="quick-type-grid">{types.map(({ id, label, icon: Icon }) => <button type="button" className={type === id ? 'active' : ''} key={id} onClick={() => { setType(id); setTitle(id === 'meal' ? 'Lunch' : id === 'nap' ? 'Rest time' : id === 'learning' ? 'Learning discovery' : id === 'incident' ? 'Incident note' : id === 'note' ? 'Care note' : 'A lovely little moment'); }}><Icon size={21}/><span>{label}</span></button>)}</div><div className="field-group"><label>Tag children</label><div className="child-tag-picker">{children.map(child => <button type="button" key={child.id} className={selected.includes(child.id) ? 'selected' : ''} onClick={() => setSelected(items => items.includes(child.id) ? items.filter(id => id !== child.id) : [...items, child.id])}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar} size="sm"/><span>{child.firstName}</span>{selected.includes(child.id) ? <Check size={14}/> : null}</button>)}</div></div><div className="form-row"><label>Title<input required value={title} onChange={event => setTitle(event.target.value)}/></label><label>Quick detail<input value={value} onChange={event => setValue(event.target.value)} placeholder={type === 'meal' ? 'Ate all / some' : type === 'nap' ? '1h 20m' : 'Optional'}/></label></div><label>What happened?<textarea required value={body} onChange={event => setBody(event.target.value)} placeholder="Add a warm, useful note for the family…" rows={4}/></label><div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={!selected.length || !body || create.isPending}>{create.isPending ? 'Sharing…' : 'Share update'}<Send size={16}/></Button></div></form></Modal>;
}

function HandoverModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const attendance = useAttendance(); const [name, setName] = useState(child.authorizedPickup[0] || ''); const [signature, setSignature] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); await attendance.mutateAsync({ childId: child.id, status: 'went_home', signature: `${name}: ${signature}` }); chime(); onClose(); };
  return <Modal title={`Send ${child.firstName} home`} eyebrow="Digital handover" onClose={onClose}><form className="handover-form" onSubmit={submit}><div className="handover-child"><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/><div><b>{child.firstName} {child.lastName}</b><small>Authorized pickup required</small></div></div><label>Picking up<select value={name} onChange={event => setName(event.target.value)}>{child.authorizedPickup.map(person => <option key={person}>{person}</option>)}</select></label><label>Signature<input className="signature-input" required value={signature} onChange={event => setSignature(event.target.value)} placeholder="Type full name"/></label><p className="privacy-copy">This confirms the child was released to an authorized adult.</p><Button className="button-primary full-button" disabled={!signature || attendance.isPending}>Confirm handover <Check size={17}/></Button></form></Modal>;
}

export function TeacherPortal() {
  const { data, isError, refetch } = useDashboard(); const user = useSession(state => state.user)!; const clear = useSession(state => state.clear); const [active, setActive] = useState('today'); const [quick, setQuick] = useState(false); const [handover, setHandover] = useState<Child | null>(null); const [message, setMessage] = useState(''); const [conversationId, setConversationId] = useState<string | null>(null); const send = useMessage(); const attendance = useAttendance(); const mode = timeMode();
  const columns = useMemo(() => ({ expected: data?.children.filter(child => child.attendanceStatus === 'expected') || [], present: data?.children.filter(child => child.attendanceStatus === 'present') || [], went_home: data?.children.filter(child => child.attendanceStatus === 'went_home') || [] }), [data]);
  if (!data) return isError ? <ErrorScreen onRetry={() => void refetch()} onSignOut={clear}/> : <LoadingScreen/>;
  const move = async (child: Child) => { if (child.attendanceStatus === 'present') return setHandover(child); await attendance.mutateAsync({ childId: child.id, status: nextAttendanceStatus(child.attendanceStatus) }); chime(); };
  const room = data.classrooms[0]; const ratio = Math.ceil(data.stats.present / Math.max(data.stats.staffOnSite, 1));
  // A conversation exists for every child with a linked guardian, plus any child with message history.
  const conversations = data.children.filter(child => child.guardianIds.length || data.messages.some(item => item.childId === child.id));
  const activeChild = conversations.find(child => child.id === conversationId) ?? conversations[0];
  const thread = activeChild ? data.messages.filter(item => item.childId === activeChild.id) : [];
  const unreadFor = (childId: string) => data.messages.filter(item => item.childId === childId && item.senderId !== user.id && !item.readBy.includes(user.id)).length;
  const navigation = nav.map(item => item.id === 'messages' ? { ...item, badge: data.stats.unreadMessages } : item);
  return <AppShell navigation={navigation} active={active} onNavigate={setActive}>
    <main className={`portal-page teacher-page mode-${mode.tone}`}>
      <div className="teacher-welcome"><div><p className="eyebrow"><span className="live-pulse"/>{mode.label}</p><h1>{mode.title}, {firstName(user.name)}.</h1><p>{mode.note}</p></div><div className="room-chip"><span style={{ background: room?.color }}>☀</span><div><b>{room?.name}</b><small>{room?.ageRange}</small></div></div></div>

      {active === 'today' ? <div className="teacher-layout"><section className="teacher-primary"><div className="teacher-stat-row"><article><span className="stat-icon present"><Users/></span><div><p>Present now</p><h2>{data.stats.present}<small> of {data.children.length}</small></h2></div></article><article><span className="stat-icon ratio"><Sparkles/></span><div><p>Live ratio</p><h2>1:{ratio}<small> / 1:{room?.ratioLimit}</small></h2></div><span className="safe-pill">Comfortable</span></article><article><span className="stat-icon message"><MessageCircle/></span><div><p>Family messages</p><h2>{data.stats.unreadMessages}<small> unread</small></h2></div></article></div>
        <section className="quick-bento"><header><div><p className="eyebrow">One-tap care log</p><h2>What’s happening now?</h2></div><button onClick={() => setQuick(true)}>Open all <ChevronRight size={15}/></button></header><div><motion.button whileTap={{ scale: .94 }} onClick={() => setQuick(true)} className="quick-photo"><Camera/><span><b>Share a moment</b><small>Photo + family update</small></span><Plus/></motion.button><motion.button whileTap={{ scale: .94 }} onClick={() => setQuick(true)} className="quick-meal"><Utensils/><span><b>Log meal</b><small>Fast portions</small></span></motion.button><motion.button whileTap={{ scale: .94 }} onClick={() => setQuick(true)} className="quick-nap"><Moon/><span><b>Log nap</b><small>Start or finish</small></span></motion.button><motion.button whileTap={{ scale: .94 }} onClick={() => setQuick(true)} className="quick-note"><FileText/><span><b>Care note</b><small>Add detail</small></span></motion.button></div></section>
        <section className="panel compact-attendance"><header><div><p className="eyebrow">Live attendance</p><h2>Little learners</h2></div><button onClick={() => setActive('attendance')}>Open Kanban <ChevronRight size={15}/></button></header><div className="avatar-presence-row">{data.children.map(child => <button key={child.id} onClick={() => move(child)}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/><i className={`status-${child.attendanceStatus}`}/><span>{child.firstName}</span></button>)}</div></section>
        <section className="panel day-stream"><header><div><p className="eyebrow">Classroom story</p><h2>Today so far</h2></div><IconButton label="More"><MoreHorizontal/></IconButton></header>{data.activities.slice(0, 4).map(activity => <div className="stream-item" key={activity.id}><span className={`activity-glyph type-${activity.type}`}>{activity.type === 'meal' ? <Utensils/> : activity.type === 'nap' ? <Moon/> : activity.type === 'learning' ? <BookOpen/> : <Camera/>}</span><div><p><b>{activity.title}</b><time>{new Date(activity.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></p><span>{activity.body}</span><small>{activity.childIds.length} {activity.childIds.length === 1 ? 'child' : 'children'} tagged</small></div></div>)}</section></section>
        <aside className="curriculum-drawer"><div className="curriculum-cover"><span>✿</span><i>⌁</i><p>Today’s theme</p><h2>{data.curriculum[0]?.theme}</h2></div><div className="curriculum-body"><p className="eyebrow">Learning compass</p><h3>Today’s goal</h3><p>{data.curriculum[0]?.goal}</p><h3>Day rhythm</h3><div className="schedule-mini">{data.curriculum[0]?.schedule.map(item => <div key={item.time}><time>{item.time}</time><span><b>{item.title}</b><small>{item.detail}</small></span></div>)}</div><Button className="button-soft full-button" onClick={() => setActive('curriculum')}><BookOpen size={16}/> Open lesson plan</Button></div></aside></div> : null}

      {active === 'attendance' ? <section className="attendance-page"><div className="section-heading"><div><p className="eyebrow">Drag-free, one-hand workflow</p><h2>Attendance Kanban</h2><p>Tap a child card to move them to the next stage.</p></div><div className="ratio-large"><small>Live ratio</small><b>1:{ratio}</b><span>Safe</span></div></div><div className="kanban-board">{(['expected', 'present', 'went_home'] as AttendanceStatus[]).map(status => <section className={`kanban-column kanban-${status}`} key={status}><header><span>{status === 'expected' ? <Clock3/> : status === 'present' ? <Check/> : <Coffee/>}</span><div><h3>{status === 'expected' ? 'Arriving' : status === 'present' ? 'Checked in' : 'Went home'}</h3><p>{columns[status].length} children</p></div></header><div>{columns[status].map(child => <ChildCard key={child.id} child={child} onMove={move} busy={attendance.isPending}/>)}</div></section>)}</div></section> : null}

      {active === 'curriculum' ? <section className="curriculum-page"><div className="curriculum-hero"><div><p className="eyebrow">Today’s curriculum</p><h1>{data.curriculum[0]?.theme}</h1><p>{data.curriculum[0]?.goal}</p></div><span className="hero-flower">✿</span></div><div className="curriculum-grid"><article className="panel"><p className="eyebrow">Materials basket</p><h2>Gather these</h2><ul className="material-list">{data.curriculum[0]?.materials.map(item => <li key={item}><Check/>{item}</li>)}</ul></article><article className="panel"><p className="eyebrow">Day rhythm</p><h2>Learning plan</h2><div className="schedule-full">{data.curriculum[0]?.schedule.map(item => <div key={item.time}><time>{item.time}</time><i/><span><b>{item.title}</b><p>{item.detail}</p></span></div>)}</div></article><article className="panel documents-card"><p className="eyebrow">Teacher resources</p><h2>Documents</h2>{data.curriculum[0]?.documents.map(doc => <button key={doc.name}><span><FileText/></span><div><b>{doc.name}</b><small>{doc.type} · {doc.size}</small></div><ChevronRight/></button>)}</article></div></section> : null}

      {active === 'messages' ? <section className="messages-page panel"><aside><p className="eyebrow">Family inbox</p><h2>Conversations</h2>{conversations.map(child => { const last = data.messages.filter(item => item.childId === child.id).at(-1); const unread = unreadFor(child.id); return <button key={child.id} className={child.id === activeChild?.id ? 'active' : ''} onClick={() => setConversationId(child.id)}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/><span><b>{child.firstName}’s family</b><small>{last ? last.body : 'Start the conversation'}</small></span>{unread ? <i>{unread}</i> : null}</button>; })}</aside>{activeChild ? <main><header><Avatar label={`${activeChild.firstName} ${activeChild.lastName}`} tone={activeChild.avatar}/><div><b>{activeChild.firstName}’s family</b><small>Parents & guardians of {activeChild.firstName}</small></div></header><div className="chat-thread">{thread.map(item => <div key={item.id} className={item.senderId === user.id ? 'mine' : ''}><span>{item.body}</span><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}</div><form onSubmit={async event => { event.preventDefault(); if (!message.trim()) return; await send.mutateAsync({ childId: activeChild.id, body: message }); setMessage(''); }}><button type="button" aria-label="Attach"><Plus/></button><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a warm update…"/><Button className="button-primary" disabled={!message.trim()}><Send/></Button></form></main> : null}</section> : null}
    </main>
    <AnimatePresence>{quick ? <QuickLog children={data.children} onClose={() => setQuick(false)}/> : null}{handover ? <HandoverModal child={handover} onClose={() => setHandover(null)}/> : null}</AnimatePresence>
  </AppShell>;
}
