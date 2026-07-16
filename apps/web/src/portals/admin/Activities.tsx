import { useEffect, useState } from 'react';
import { BookOpen, Camera, Check, ClipboardCheck, FileText, Moon, PenSquare, Send, Utensils } from 'lucide-react';
import type { ActivityType, DashboardData } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useActivity } from '../../hooks/useCompass';
import { fmtTime, roomName, SectionHead } from './common';

const TYPES: { id: ActivityType; label: string; icon: typeof Camera }[] = [
  { id: 'moment', label: 'Moment', icon: Camera }, { id: 'meal', label: 'Meal', icon: Utensils }, { id: 'nap', label: 'Nap', icon: Moon },
  { id: 'learning', label: 'Learning', icon: BookOpen }, { id: 'note', label: 'Note', icon: FileText }, { id: 'incident', label: 'Incident', icon: ClipboardCheck },
];

function LogActivityModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useActivity();
  const [type, setType] = useState<ActivityType>('moment');
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('A lovely little moment');
  const [body, setBody] = useState('');
  const [value, setValue] = useState('');
  return <Modal title="Log an activity" eyebrow="Share the day" onClose={onClose} wide>
    <form className="quick-log-form" onSubmit={async event => {
      event.preventDefault();
      await create.mutateAsync({ childIds: selected, type, title, body, value: value || undefined, mediaUrl: type === 'moment' ? '/garden-moment.svg' : undefined });
      onClose();
    }}>
      <div className="quick-type-grid">{TYPES.map(({ id, label, icon: Icon }) => <button type="button" className={type === id ? 'active' : ''} key={id} onClick={() => { setType(id); setTitle(id === 'meal' ? 'Lunch' : id === 'nap' ? 'Rest time' : id === 'learning' ? 'Learning discovery' : id === 'incident' ? 'Incident note' : id === 'note' ? 'Care note' : 'A lovely little moment'); }}><Icon size={21}/><span>{label}</span></button>)}</div>
      <div className="field-group"><label>Tag children</label><div className="child-tag-picker">{data.children.map(child => <button type="button" key={child.id} className={selected.includes(child.id) ? 'selected' : ''} onClick={() => setSelected(items => items.includes(child.id) ? items.filter(id => id !== child.id) : [...items, child.id])}><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar} size="sm"/><span>{child.firstName}</span>{selected.includes(child.id) ? <Check size={14}/> : null}</button>)}</div></div>
      <div className="form-row">
        <label>Title<input required maxLength={80} value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Quick detail<input maxLength={80} value={value} onChange={event => setValue(event.target.value)} placeholder={type === 'meal' ? 'Ate all / some' : type === 'nap' ? '1h 20m' : 'Optional'}/></label>
      </div>
      <label>What happened?<textarea required maxLength={600} value={body} onChange={event => setBody(event.target.value)} placeholder="Add a warm, useful note for the family…" rows={4}/></label>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={!selected.length || !body || create.isPending}>{create.isPending ? 'Sharing…' : 'Share update'}<Send size={16}/></Button></div>
    </form>
  </Modal>;
}

export function ActivitiesTab({ data, openLog, onLogHandled }: { data: DashboardData; openLog?: boolean; onLogHandled: () => void }) {
  const [roomFilter, setRoomFilter] = useState('all');
  const [logging, setLogging] = useState(false);
  useEffect(() => { if (openLog) { setLogging(true); onLogHandled(); } }, [openLog, onLogHandled]);
  const activities = data.activities.filter(activity => roomFilter === 'all' || activity.classroomId === roomFilter);
  const glyph = (type: ActivityType) => { const Icon = TYPES.find(item => item.id === type)?.icon ?? Camera; return <Icon/>; };

  return <>
    <SectionHead title="Daily Activities" subtitle="Every logged moment, meal, nap, and lesson across the center.">
      <Button className="button-primary" onClick={() => setLogging(true)}><PenSquare size={16}/> Log activity</Button>
    </SectionHead>
    <div className="filter-chips room-tabs">
      <button className={roomFilter === 'all' ? 'active' : ''} onClick={() => setRoomFilter('all')}>All rooms</button>
      {data.classrooms.map(room => <button key={room.id} className={roomFilter === room.id ? 'active' : ''} onClick={() => setRoomFilter(room.id)}><i style={{ background: room.color }}/>{room.name}</button>)}
    </div>
    <article className="panel activity-feed-panel">
      {activities.length ? activities.map(activity => <div className="stream-item" key={activity.id}>
        <span className={`activity-glyph type-${activity.type}`}>{glyph(activity.type)}</span>
        <div>
          <p><b>{activity.title}</b><time>{fmtTime(activity.createdAt)}</time></p>
          <span>{activity.body}</span>
          <small>{activity.authorName} · {roomName(data, activity.classroomId)} · {activity.childIds.length} {activity.childIds.length === 1 ? 'child' : 'children'} tagged{activity.value ? ` · ${activity.value}` : ''}</small>
        </div>
      </div>) : <p className="empty-note">No activities logged for this room yet today.</p>}
    </article>
    {logging ? <LogActivityModal data={data} onClose={() => setLogging(false)}/> : null}
  </>;
}
