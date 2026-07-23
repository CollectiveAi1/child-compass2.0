import { useState } from 'react';
import { BadgeCheck, Download, Mail, Pencil, Phone, Printer, ShieldAlert, Timer, Trash2, UserPlus, Users } from 'lucide-react';
import type { DashboardData, StaffCredential, User } from '@compass/shared';
import { formatMinutes, timeEntryMinutes, weekMondayOf } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useAddStaff, useAddTimeEntry, useDeleteTimeEntry, useUpdateStaff } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { staffReport, timesheetReport } from './reportDefs';
import { daysUntil, fmtDate, fmtShortDate, fmtTime, roomName, SectionHead, StatCard, todayIso } from './common';

function credentialTone(credential: StaffCredential): 'ok' | 'warning' | 'expired' {
  const days = daysUntil(credential.expires);
  return days < 0 ? 'expired' : days <= 30 ? 'warning' : 'ok';
}

function StaffModal({ data, member, onClose }: { data: DashboardData; member?: User; onClose: () => void }) {
  const create = useAddStaff();
  const update = useUpdateStaff();
  const [form, setForm] = useState({ name: member?.name ?? '', email: member?.email ?? '', title: member?.title ?? 'Teacher', phone: member?.phone ?? '', classroomIds: member?.classroomIds ?? [], credentials: member?.credentials ?? [] });
  const busy = create.isPending || update.isPending;
  const setCredential = (index: number, patch: Partial<StaffCredential>) => setForm(current => ({ ...current, credentials: current.credentials.map((credential, i) => i === index ? { ...credential, ...patch } : credential) }));
  return <Modal title={member ? `Edit ${member.name}` : 'Add team member'} eyebrow="Center team" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      if (member) await update.mutateAsync({ staffId: member.id, title: form.title, phone: form.phone, classroomIds: form.classroomIds, credentials: form.credentials });
      else await create.mutateAsync(form);
      onClose();
    }}>
      <div className="form-row">
        <label>Full name<input required maxLength={80} value={form.name} disabled={!!member} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label>Email<input type="email" required value={form.email} disabled={!!member} onChange={event => setForm({ ...form, email: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Title<input maxLength={60} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label>
        <label>Phone<input maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
      </div>
      <fieldset className="mini-fieldset"><legend>Classrooms</legend>
        <div className="checkbox-row">{data.classrooms.map(room => <label key={room.id} className="checkbox-chip">
          <input type="checkbox" checked={form.classroomIds.includes(room.id)} onChange={event => setForm({ ...form, classroomIds: event.target.checked ? [...form.classroomIds, room.id] : form.classroomIds.filter(id => id !== room.id) })}/>
          {room.name}
        </label>)}</div>
      </fieldset>
      <fieldset className="mini-fieldset"><legend>Credentials</legend>
        {form.credentials.map((credential, index) => <div className="form-row form-row-3" key={index}>
          <input aria-label="Credential name" maxLength={80} value={credential.name} onChange={event => setCredential(index, { name: event.target.value })} placeholder="CPR & First Aid"/>
          <input aria-label="Issued date" type="date" value={credential.issued} onChange={event => setCredential(index, { issued: event.target.value })}/>
          <input aria-label="Expiry date" type="date" value={credential.expires} onChange={event => setCredential(index, { expires: event.target.value })}/>
        </div>)}
        <Button type="button" className="button-ghost button-compact" onClick={() => setForm({ ...form, credentials: [...form.credentials, { name: '', issued: todayIso(), expires: todayIso() }] })}>+ Add credential</Button>
      </fieldset>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={busy}>{busy ? 'Saving…' : member ? 'Save changes' : 'Add team member'}</Button></div>
    </form>
  </Modal>;
}

// Manual timesheet correction: add a shift someone forgot to punch.
function TimeEntryModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useAddTimeEntry();
  const [form, setForm] = useState({ userId: data.staff[0]?.id ?? '', date: todayIso(), timeIn: '08:00', timeOut: '16:00' });
  return <Modal title="Add a time entry" eyebrow="Timesheet correction" onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await create.mutateAsync({ userId: form.userId, clockIn: new Date(`${form.date}T${form.timeIn}`).toISOString(), clockOut: new Date(`${form.date}T${form.timeOut}`).toISOString() });
      onClose();
    }}>
      <div className="form-row">
        <label>Team member<select value={form.userId} onChange={event => setForm({ ...form, userId: event.target.value })}>{data.staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label>Date<input type="date" required max={todayIso()} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Clock in<input type="time" required value={form.timeIn} onChange={event => setForm({ ...form, timeIn: event.target.value })}/></label>
        <label>Clock out<input type="time" required value={form.timeOut} onChange={event => setForm({ ...form, timeOut: event.target.value })}/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={create.isPending || form.timeOut <= form.timeIn}>{create.isPending ? 'Saving…' : 'Add entry'}</Button></div>
    </form>
  </Modal>;
}

function TimeClockSection({ data }: { data: DashboardData }) {
  const [addingEntry, setAddingEntry] = useState(false);
  const [staffFilter, setStaffFilter] = useState('all');
  const removeEntry = useDeleteTimeEntry();
  const week = weekMondayOf();
  const todayDate = todayIso();
  const staffName = (userId: string) => data.staff.find(member => member.id === userId)?.name ?? 'Former staff';
  const summary = data.staff.map(member => {
    const entries = data.timeEntries.filter(entry => entry.userId === member.id);
    const open = entries.find(entry => !entry.clockOut);
    const todayMinutes = entries.filter(entry => entry.date === todayDate).reduce((sum, entry) => sum + timeEntryMinutes(entry), 0);
    const weekMinutes = entries.filter(entry => entry.date >= week).reduce((sum, entry) => sum + timeEntryMinutes(entry), 0);
    return { member, open, todayMinutes, weekMinutes };
  });
  const log = [...data.timeEntries]
    .filter(entry => staffFilter === 'all' || entry.userId === staffFilter)
    .sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  const report = () => timesheetReport(data);

  return <>
    <article className="panel table-panel">
      <header>
        <div><h2><Timer size={18} className="head-icon"/> Time clock — hours by team member</h2><p>Staff punch in and out from their own portal; totals update live.</p></div>
        <div className="row-actions">
          <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print timesheet</Button>
          <Button className="button-soft" onClick={() => downloadCsv('staff-timesheet', report())}><Download size={16}/> CSV</Button>
          <Button className="button-primary" onClick={() => setAddingEntry(true)}><Timer size={16}/> Add entry</Button>
        </div>
      </header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Team member</th><th>Status</th><th>Today</th><th>This week</th></tr></thead>
        <tbody>{summary.map(({ member, open, todayMinutes, weekMinutes }) => <tr key={member.id}>
          <td><span className="cell-person"><Avatar label={member.name} tone={member.role === 'admin' ? 'sky' : 'mint'} size="sm"/><b>{member.name}</b></span></td>
          <td>{open ? <span className="pill pill-good">On the clock since {fmtTime(open.clockIn)}</span> : <span className="pill pill-info">Clocked out</span>}</td>
          <td><strong>{formatMinutes(todayMinutes)}</strong></td>
          <td><strong>{formatMinutes(weekMinutes)}</strong></td>
        </tr>)}</tbody>
      </table></div>
    </article>

    <article className="panel table-panel">
      <header>
        <h2>Time log</h2>
        <select className="status-select" value={staffFilter} aria-label="Filter time log by team member" onChange={event => setStaffFilter(event.target.value)}>
          <option value="all">All staff</option>
          {data.staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Team member</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th></th></tr></thead>
        <tbody>{log.map(entry => <tr key={entry.id}>
          <td>{staffName(entry.userId)}</td>
          <td>{fmtShortDate(entry.date)}</td>
          <td>{fmtTime(entry.clockIn)}</td>
          <td>{entry.clockOut ? fmtTime(entry.clockOut) : <span className="pill pill-good">on the clock</span>}</td>
          <td><strong>{formatMinutes(timeEntryMinutes(entry))}</strong></td>
          <td><Button className="button-ghost button-compact" aria-label="Delete time entry" disabled={removeEntry.isPending} onClick={() => removeEntry.mutate({ entryId: entry.id })}><Trash2 size={14}/></Button></td>
        </tr>)}</tbody>
      </table></div>
      {!log.length ? <p className="empty-note">No time entries for this selection yet.</p> : null}
    </article>
    {addingEntry ? <TimeEntryModal data={data} onClose={() => setAddingEntry(false)}/> : null}
  </>;
}

export function StaffTab({ data }: { data: DashboardData }) {
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);
  const expiring = data.staff.flatMap(member => (member.credentials ?? []).filter(credential => credentialTone(credential) !== 'ok').map(credential => ({ member, credential })));
  const report = () => staffReport(data);

  return <>
    <SectionHead title="Staff" subtitle="Your team, their classrooms, and credential compliance in one place.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print</Button>
      <Button className="button-soft" onClick={() => downloadCsv('staff-roster', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><UserPlus size={16}/> Add team member</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<Users/>} tone="blue" label="Team Members" value={data.staff.length} sub={`${data.staff.filter(member => member.role === 'teacher').length} teachers on duty`}/>
      <StatCard icon={<BadgeCheck/>} tone="green" label="Credentials On File" value={data.staff.reduce((sum, member) => sum + (member.credentials?.length ?? 0), 0)} sub="Across the whole team"/>
      <StatCard icon={<ShieldAlert/>} tone={expiring.length ? 'amber' : 'teal'} label="Expiring Soon" value={expiring.length} sub={expiring.length ? 'Renew within 30 days' : 'Everything is current'}/>
      <StatCard icon={<Timer/>} tone="teal" label="On the Clock Now" value={data.timeEntries.filter(entry => !entry.clockOut).length} sub={`of ${data.staff.length} team members`}/>
    </section>

    <TimeClockSection data={data}/>

    {expiring.length ? <div className="alert-banner"><ShieldAlert size={17}/><p>{expiring.map(({ member, credential }) => `${member.name} — ${credential.name} ${daysUntil(credential.expires) < 0 ? 'expired' : `expires in ${daysUntil(credential.expires)} days`}`).join(' · ')}</p></div> : null}

    <section className="staff-grid">{data.staff.map(member => <article className="panel staff-card" key={member.id}>
      <header>
        <Avatar label={member.name} tone={member.role === 'admin' ? 'sky' : 'mint'}/>
        <div><h3>{member.name}</h3><p>{member.title ?? 'Teacher'}</p></div>
        <Button className="button-soft button-compact" onClick={() => setEditing(member)}><Pencil size={14}/> Edit</Button>
      </header>
      <div className="staff-meta">
        <span><Mail size={13}/> {member.email}</span>
        {member.phone ? <span><Phone size={13}/> {member.phone}</span> : null}
        <span><Users size={13}/> {member.classroomIds.map(id => roomName(data, id)).join(', ') || 'Center-wide'}</span>
        {member.hiredOn ? <span>Joined {fmtDate(member.hiredOn)}</span> : null}
      </div>
      <div className="credential-list">{(member.credentials ?? []).map(credential => <span key={credential.name + credential.expires} className={`credential-chip tone-${credentialTone(credential)}`}><BadgeCheck size={13}/>{credential.name}<small>exp {fmtDate(credential.expires)}</small></span>)}
      {!member.credentials?.length ? <p className="empty-note">No credentials on file yet.</p> : null}</div>
    </article>)}</section>

    {adding ? <StaffModal data={data} onClose={() => setAdding(false)}/> : null}
    {editing ? <StaffModal data={data} member={editing} onClose={() => setEditing(null)}/> : null}
  </>;
}
