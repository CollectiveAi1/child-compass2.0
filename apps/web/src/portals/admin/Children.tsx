import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, HeartPulse, Pencil, Phone, Printer, Search, Stethoscope, Syringe, UserPlus } from 'lucide-react';
import type { Child, ChildMedical, DashboardData } from '@compass/shared';
import { childAge } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useAddChild, useUpdateChild } from '../../hooks/useCompass';
import { printReport } from '../../lib/reports';
import { fmtDate, fmtTime, roomName, SectionHead, todayIso } from './common';

const emptyMedical: ChildMedical = { physician: '', physicianPhone: '', conditions: '', medications: '', lastPhysical: '', immunizations: [], emergencyContacts: [] };

function AddChildModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useAddChild();
  const [form, setForm] = useState({ firstName: '', lastName: '', birthday: '', classroomId: data.classrooms[0]?.id ?? '', guardianName: '', guardianPhone: '', allergies: '', notes: '' });
  return <Modal title="Add a child" eyebrow="Welcome to Bright Path" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await create.mutateAsync({ ...form, allergies: form.allergies.split(',').map(item => item.trim()).filter(Boolean), notes: form.notes || undefined, guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined });
      onClose();
    }}>
      <div className="form-row">
        <label>First name<input required maxLength={40} value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })}/></label>
        <label>Last name<input required maxLength={40} value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Birthday<input type="date" required max={todayIso()} value={form.birthday} onChange={event => setForm({ ...form, birthday: event.target.value })}/></label>
        <label>Classroom<select value={form.classroomId} onChange={event => setForm({ ...form, classroomId: event.target.value })}>{data.classrooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.ageRange}</option>)}</select></label>
      </div>
      <div className="form-row">
        <label>Guardian name<input maxLength={80} value={form.guardianName} onChange={event => setForm({ ...form, guardianName: event.target.value })}/></label>
        <label>Guardian phone<input maxLength={30} value={form.guardianPhone} onChange={event => setForm({ ...form, guardianPhone: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Allergies (comma separated)<input value={form.allergies} onChange={event => setForm({ ...form, allergies: event.target.value })} placeholder="Peanuts, Dairy"/></label>
        <label>Care notes<input maxLength={400} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Loves puzzles and story time"/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add child'}</Button></div>
    </form>
  </Modal>;
}

function EditProfileModal({ data, child, onClose }: { data: DashboardData; child: Child; onClose: () => void }) {
  const update = useUpdateChild();
  const [form, setForm] = useState({ classroomId: child.classroomId, guardianName: child.guardianName ?? '', guardianPhone: child.guardianPhone ?? '', allergies: child.allergies.join(', '), notes: child.notes, authorizedPickup: child.authorizedPickup.join(', ') });
  return <Modal title={`Edit ${child.firstName}’s profile`} eyebrow="Child profile" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await update.mutateAsync({ childId: child.id, classroomId: form.classroomId, guardianName: form.guardianName, guardianPhone: form.guardianPhone, notes: form.notes, allergies: form.allergies.split(',').map(item => item.trim()).filter(Boolean), authorizedPickup: form.authorizedPickup.split(',').map(item => item.trim()).filter(Boolean) });
      onClose();
    }}>
      <div className="form-row">
        <label>Classroom<select value={form.classroomId} onChange={event => setForm({ ...form, classroomId: event.target.value })}>{data.classrooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        <label>Allergies (comma separated)<input value={form.allergies} onChange={event => setForm({ ...form, allergies: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Guardian name<input maxLength={80} value={form.guardianName} onChange={event => setForm({ ...form, guardianName: event.target.value })}/></label>
        <label>Guardian phone<input maxLength={30} value={form.guardianPhone} onChange={event => setForm({ ...form, guardianPhone: event.target.value })}/></label>
      </div>
      <label>Authorized pickup (comma separated)<input value={form.authorizedPickup} onChange={event => setForm({ ...form, authorizedPickup: event.target.value })}/></label>
      <label>Care notes<textarea rows={3} maxLength={400} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></label>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save profile'}</Button></div>
    </form>
  </Modal>;
}

function EditMedicalModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const update = useUpdateChild();
  const [medical, setMedical] = useState<ChildMedical>(child.medical ?? emptyMedical);
  const setShot = (index: number, patch: Partial<ChildMedical['immunizations'][number]>) => setMedical(current => ({ ...current, immunizations: current.immunizations.map((shot, i) => i === index ? { ...shot, ...patch } : shot) }));
  const setContact = (index: number, patch: Partial<ChildMedical['emergencyContacts'][number]>) => setMedical(current => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact, i) => i === index ? { ...contact, ...patch } : contact) }));
  return <Modal title={`${child.firstName}’s medical record`} eyebrow="Confidential" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await update.mutateAsync({ childId: child.id, medical }); onClose(); }}>
      <div className="form-row">
        <label>Physician<input maxLength={80} value={medical.physician} onChange={event => setMedical({ ...medical, physician: event.target.value })}/></label>
        <label>Physician phone<input maxLength={30} value={medical.physicianPhone} onChange={event => setMedical({ ...medical, physicianPhone: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Conditions<input maxLength={400} value={medical.conditions} onChange={event => setMedical({ ...medical, conditions: event.target.value })}/></label>
        <label>Medications<input maxLength={400} value={medical.medications} onChange={event => setMedical({ ...medical, medications: event.target.value })}/></label>
      </div>
      <label>Last physical<input type="date" max={todayIso()} value={medical.lastPhysical} onChange={event => setMedical({ ...medical, lastPhysical: event.target.value })}/></label>
      <fieldset className="mini-fieldset"><legend>Immunizations</legend>
        {medical.immunizations.map((shot, index) => <div className="form-row form-row-3" key={index}>
          <input aria-label="Vaccine name" maxLength={60} value={shot.name} onChange={event => setShot(index, { name: event.target.value })} placeholder="Vaccine"/>
          <input aria-label="Vaccine date" type="date" value={shot.date} onChange={event => setShot(index, { date: event.target.value })}/>
          <select aria-label="Vaccine status" value={shot.status} onChange={event => setShot(index, { status: event.target.value as 'complete' | 'due' | 'overdue' })}><option value="complete">Complete</option><option value="due">Due</option><option value="overdue">Overdue</option></select>
        </div>)}
        <Button type="button" className="button-ghost button-compact" onClick={() => setMedical({ ...medical, immunizations: [...medical.immunizations, { name: '', date: todayIso(), status: 'due' }] })}>+ Add immunization</Button>
      </fieldset>
      <fieldset className="mini-fieldset"><legend>Emergency contacts</legend>
        {medical.emergencyContacts.map((contact, index) => <div className="form-row form-row-3" key={index}>
          <input aria-label="Contact name" maxLength={80} value={contact.name} onChange={event => setContact(index, { name: event.target.value })} placeholder="Name"/>
          <input aria-label="Contact relation" maxLength={40} value={contact.relation} onChange={event => setContact(index, { relation: event.target.value })} placeholder="Relation"/>
          <input aria-label="Contact phone" maxLength={30} value={contact.phone} onChange={event => setContact(index, { phone: event.target.value })} placeholder="Phone"/>
        </div>)}
        <Button type="button" className="button-ghost button-compact" onClick={() => setMedical({ ...medical, emergencyContacts: [...medical.emergencyContacts, { name: '', relation: '', phone: '' }] })}>+ Add contact</Button>
      </fieldset>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save medical record'}</Button></div>
    </form>
  </Modal>;
}

function printChildRecord(data: DashboardData, child: Child) {
  const medical = child.medical;
  printReport({
    title: `Child Record — ${child.firstName} ${child.lastName}`,
    subtitle: `${roomName(data, child.classroomId)} · ${childAge(child.birthday)} · Born ${fmtDate(child.birthday)}`,
    columns: ['Field', 'Details'],
    rows: [
      ['Guardian', `${child.guardianName ?? '—'} ${child.guardianPhone ? `· ${child.guardianPhone}` : ''}`],
      ['Authorized pickup', child.authorizedPickup.join(', ') || '—'],
      ['Allergies', child.allergies.join(', ') || 'None reported'],
      ['Conditions', medical?.conditions || '—'],
      ['Medications', medical?.medications || '—'],
      ['Physician', medical?.physician ? `${medical.physician} · ${medical.physicianPhone}` : '—'],
      ['Last physical', medical?.lastPhysical ? fmtDate(medical.lastPhysical) : '—'],
      ['Immunizations', medical?.immunizations.map(shot => `${shot.name} (${shot.status}, ${fmtDate(shot.date)})`).join('; ') || 'No records on file'],
      ['Emergency contacts', medical?.emergencyContacts.map(contact => `${contact.name} — ${contact.relation} · ${contact.phone}`).join('; ') || '—'],
      ['Care notes', child.notes],
      ['Enrolled', child.enrolledOn ? fmtDate(child.enrolledOn) : '—'],
    ],
    footer: 'Confidential child record — store in a locked file per licensing requirements.',
  }, data.center.name);
}

export function ChildrenTab({ data, openAdd, onAddHandled }: { data: DashboardData; openAdd?: boolean; onAddHandled: () => void }) {
  const [selectedId, setSelectedId] = useState(data.children[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<'profile' | 'medical' | null>(null);

  useEffect(() => { if (openAdd) { setAdding(true); onAddHandled(); } }, [openAdd, onAddHandled]);

  const filtered = useMemo(() => data.children.filter(child =>
    `${child.firstName} ${child.lastName}`.toLowerCase().includes(search.toLowerCase()) && (roomFilter === 'all' || child.classroomId === roomFilter)
  ), [data, search, roomFilter]);
  const selected = data.children.find(child => child.id === selectedId) ?? filtered[0] ?? data.children[0];

  return <>
    <SectionHead title="Children" subtitle={`${data.children.length} enrolled across ${data.classrooms.length} classrooms.`}>
      <Button className="button-primary" onClick={() => setAdding(true)}><UserPlus size={16}/> Add child</Button>
    </SectionHead>
    <section className="people-workspace">
      <article className="panel people-list">
        <label className="search-box"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search children…"/></label>
        <div className="filter-chips">
          <button className={roomFilter === 'all' ? 'active' : ''} onClick={() => setRoomFilter('all')}>All rooms</button>
          {data.classrooms.map(room => <button key={room.id} className={roomFilter === room.id ? 'active' : ''} onClick={() => setRoomFilter(room.id)}>{room.name}</button>)}
        </div>
        <div className="children-scroll">{filtered.map(child => <button key={child.id} className={`child-list-row ${child.id === selected?.id ? 'selected' : ''}`} onClick={() => setSelectedId(child.id)}>
          <Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/>
          <span><b>{child.firstName} {child.lastName}</b><small>{childAge(child.birthday)} · {roomName(data, child.classroomId)}</small></span>
          <i className={`status-dot status-${child.attendanceStatus}`}/><ChevronRight size={16}/>
        </button>)}{!filtered.length ? <p className="empty-note">No children match this search.</p> : null}</div>
      </article>

      {selected ? <article className="panel child-context">
        <div className="context-hero">
          <Avatar label={`${selected.firstName} ${selected.lastName}`} tone={selected.avatar} size="lg"/>
          <div><p className="eyebrow">Child profile</p><h2>{selected.firstName} {selected.lastName}</h2><p>{childAge(selected.birthday)} · {roomName(data, selected.classroomId)}</p></div>
          <div className="hero-buttons">
            <Button className="button-soft button-compact" onClick={() => setEditing('profile')}><Pencil size={14}/> Edit</Button>
            <Button className="button-soft button-compact" onClick={() => printChildRecord(data, selected)}><Printer size={14}/> Print record</Button>
          </div>
        </div>
        <div className="context-status"><span className={`status-chip status-${selected.attendanceStatus}`}>{selected.attendanceStatus.replace('_', ' ')}</span><small>{selected.checkedInAt ? `Arrived ${fmtTime(selected.checkedInAt)}` : 'Not checked in today'}</small></div>
        <div className="detail-grid">
          <div><small>Birthday</small><b>{fmtDate(selected.birthday)}</b></div>
          <div><small>Guardian</small><b>{selected.guardianName ?? '—'}{selected.guardianPhone ? <span className="detail-sub"><Phone size={11}/> {selected.guardianPhone}</span> : null}</b></div>
          <div><small>Allergies</small><b className={selected.allergies.length ? 'allergy-flag' : ''}>{selected.allergies.join(', ') || 'None noted'}</b></div>
          <div><small>Authorized pickup</small><b>{selected.authorizedPickup.join(' · ')}</b></div>
          <div className="full"><small>Care notes</small><p>{selected.notes}</p></div>
        </div>

        <div className="medical-card">
          <header><h3><HeartPulse size={17}/> Medical record</h3><Button className="button-soft button-compact" onClick={() => setEditing('medical')}><Pencil size={14}/> Update</Button></header>
          <div className="detail-grid">
            <div><small><Stethoscope size={11}/> Physician</small><b>{selected.medical?.physician || 'Not on file'}</b>{selected.medical?.physicianPhone ? <span className="detail-sub">{selected.medical.physicianPhone}</span> : null}</div>
            <div><small>Last physical</small><b>{selected.medical?.lastPhysical ? fmtDate(selected.medical.lastPhysical) : 'Not on file'}</b></div>
            <div><small>Conditions</small><b>{selected.medical?.conditions || '—'}</b></div>
            <div><small>Medications</small><b>{selected.medical?.medications || '—'}</b></div>
          </div>
          <h4><Syringe size={14}/> Immunizations</h4>
          {selected.medical?.immunizations.length ? <div className="immunization-row">{selected.medical.immunizations.map(shot => <span key={shot.name + shot.date} className={`immunization-chip status-${shot.status}`}>{shot.name}<small>{shot.status}</small></span>)}</div> : <p className="empty-note">No immunization records yet.</p>}
          <h4><Phone size={14}/> Emergency contacts</h4>
          {selected.medical?.emergencyContacts.length ? <div className="contact-list">{selected.medical.emergencyContacts.map(contact => <div key={contact.name + contact.phone}><b>{contact.name}</b><small>{contact.relation}</small><span>{contact.phone}</span></div>)}</div> : <p className="empty-note">No emergency contacts on file.</p>}
        </div>
      </article> : null}
    </section>
    {adding ? <AddChildModal data={data} onClose={() => setAdding(false)}/> : null}
    {editing === 'profile' && selected ? <EditProfileModal data={data} child={selected} onClose={() => setEditing(null)}/> : null}
    {editing === 'medical' && selected ? <EditMedicalModal child={selected} onClose={() => setEditing(null)}/> : null}
  </>;
}
