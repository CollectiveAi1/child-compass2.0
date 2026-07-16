import { useState } from 'react';
import { BadgeCheck, Download, Mail, Pencil, Phone, Printer, ShieldAlert, UserPlus, Users } from 'lucide-react';
import type { DashboardData, StaffCredential, User } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useAddStaff, useUpdateStaff } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { staffReport } from './reportDefs';
import { daysUntil, fmtDate, roomName, SectionHead, StatCard, todayIso } from './common';

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
      <StatCard icon={<Users/>} tone="teal" label="Classrooms Covered" value={data.classrooms.filter(room => room.teacherIds.length).length} sub={`of ${data.classrooms.length} rooms`}/>
    </section>

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
