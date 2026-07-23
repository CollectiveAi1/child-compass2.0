import { useState } from 'react';
import { CheckCircle2, ClipboardList, Download, Hourglass, Plus, Printer, Trash2, UserPlus, Users } from 'lucide-react';
import type { DashboardData, EnrollmentApplication, EnrollmentChild, EnrollmentStatus } from '@compass/shared';
import { childAge } from '@compass/shared';
import { Button, Modal } from '../../components/ui';
import { useAddEnrollment, useAddEnrollmentChild, useUpdateEnrollment } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { enrollmentReport } from './reportDefs';
import { fmtShortDate, roomName, SectionHead, StatCard, todayIso } from './common';

const STATUS_FLOW: EnrollmentStatus[] = ['inquiry', 'toured', 'waitlist', 'approved', 'enrolled', 'declined'];
const STATUS_LABEL: Record<EnrollmentStatus, string> = { inquiry: 'New inquiry', toured: 'Toured', waitlist: 'Waitlist', approved: 'Approved', enrolled: 'Enrolled', declined: 'Declined' };

function ChildFields({ child, index, onChange, onRemove, data, removable }: { child: EnrollmentChild; index: number; onChange: (index: number, patch: Partial<EnrollmentChild>) => void; onRemove?: (index: number) => void; data: DashboardData; removable: boolean }) {
  return <div className="family-child-row">
    <label>Child’s full name<input required maxLength={80} value={child.name} onChange={event => onChange(index, { name: event.target.value })}/></label>
    <label>Birthday<input type="date" required value={child.birthday} onChange={event => onChange(index, { birthday: event.target.value })}/></label>
    <label>Classroom<select value={child.classroomId} onChange={event => onChange(index, { classroomId: event.target.value })}>{data.classrooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.ageRange}</option>)}</select></label>
    {removable && onRemove ? <Button type="button" className="button-ghost button-compact remove-child" aria-label={`Remove child ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={14}/></Button> : <span/>}
  </div>;
}

// One application per family: siblings are added right on the form, so a
// second child never means starting the enrollment process over.
function NewApplicationModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useAddEnrollment();
  const defaultRoom = data.classrooms[0]?.id ?? '';
  const [form, setForm] = useState({ guardianName: '', guardianEmail: '', guardianPhone: '', requestedStart: todayIso(), notes: '' });
  const [children, setChildren] = useState<EnrollmentChild[]>([{ name: '', birthday: '', classroomId: defaultRoom }]);
  const setChild = (index: number, patch: Partial<EnrollmentChild>) => setChildren(current => current.map((child, i) => i === index ? { ...child, ...patch } : child));
  return <Modal title="New family application" eyebrow="Growing the Bright Path family" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await create.mutateAsync({ ...form, children }); onClose(); }}>
      <div className="form-row">
        <label>Guardian name<input required maxLength={80} value={form.guardianName} onChange={event => setForm({ ...form, guardianName: event.target.value })}/></label>
        <label>Guardian email<input type="email" required value={form.guardianEmail} onChange={event => setForm({ ...form, guardianEmail: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Guardian phone<input required maxLength={30} value={form.guardianPhone} onChange={event => setForm({ ...form, guardianPhone: event.target.value })}/></label>
        <label>Requested start<input type="date" required value={form.requestedStart} onChange={event => setForm({ ...form, requestedStart: event.target.value })}/></label>
      </div>
      <fieldset className="mini-fieldset"><legend>Children on this application</legend>
        {children.map((child, index) => <ChildFields key={index} child={child} index={index} data={data} onChange={setChild} onRemove={index => setChildren(current => current.filter((_, i) => i !== index))} removable={children.length > 1}/>)}
        <Button type="button" className="button-teal button-compact" disabled={children.length >= 8} onClick={() => setChildren(current => [...current, { name: '', birthday: '', classroomId: defaultRoom }])}><Plus size={14}/> Add another child</Button>
      </fieldset>
      <label>Notes<textarea rows={3} maxLength={400} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="How they found us, tour preferences, siblings…"/></label>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : `Add application (${children.length} ${children.length === 1 ? 'child' : 'children'})`}</Button></div>
    </form>
  </Modal>;
}

// Adds a sibling to a family's existing application — same file, no restart.
function AddChildModal({ data, application, onClose }: { data: DashboardData; application: EnrollmentApplication; onClose: () => void }) {
  const append = useAddEnrollmentChild();
  const [child, setChild] = useState<EnrollmentChild>({ name: '', birthday: '', classroomId: data.classrooms[0]?.id ?? '' });
  return <Modal title={`Add a child to the ${application.guardianName.split(' ').at(-1)} family file`} eyebrow={`${application.guardianName} · ${application.children.length} ${application.children.length === 1 ? 'child' : 'children'} on file`} onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await append.mutateAsync({ enrollmentId: application.id, ...child }); onClose(); }}>
      <label>Child’s full name<input required maxLength={80} value={child.name} onChange={event => setChild({ ...child, name: event.target.value })}/></label>
      <div className="form-row">
        <label>Birthday<input type="date" required value={child.birthday} onChange={event => setChild({ ...child, birthday: event.target.value })}/></label>
        <label>Classroom<select value={child.classroomId} onChange={event => setChild({ ...child, classroomId: event.target.value })}>{data.classrooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.ageRange}</option>)}</select></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-teal" disabled={append.isPending || !child.name || !child.birthday}>{append.isPending ? 'Adding…' : 'Add to family file'}</Button></div>
    </form>
  </Modal>;
}

export function EnrollmentTab({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const [addingChildTo, setAddingChildTo] = useState<EnrollmentApplication | null>(null);
  const update = useUpdateEnrollment();
  const open = data.enrollments.filter(application => !['enrolled', 'declined'].includes(application.status));
  const childrenInPipeline = open.reduce((sum, application) => sum + application.children.length, 0);
  const report = () => enrollmentReport(data);

  return <>
    <SectionHead title="Enrollment Pipeline" subtitle="One application per family — siblings stay on the same file.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print</Button>
      <Button className="button-soft" onClick={() => downloadCsv('enrollment-applications', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><UserPlus size={16}/> New application</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<ClipboardList/>} tone="blue" label="Open Applications" value={open.length} sub={`${childrenInPipeline} children in the pipeline`}/>
      <StatCard icon={<Hourglass/>} tone="amber" label="Waitlisted" value={data.enrollments.filter(a => a.status === 'waitlist').length} sub="Waiting on an opening"/>
      <StatCard icon={<CheckCircle2/>} tone="green" label="Approved" value={data.enrollments.filter(a => a.status === 'approved').length} sub="Ready to enroll"/>
      <StatCard icon={<Users/>} tone="teal" label="Open Seats" value={Math.max(data.center.capacity - data.children.length, 0)} sub={`of ${data.center.capacity} licensed capacity`}/>
    </section>

    <article className="panel table-panel">
      <header><h2>Family applications</h2><span className="muted-count">{data.enrollments.length} total</span></header>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Family / Guardian</th><th>Children</th><th>Start</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{data.enrollments.map(application => <tr key={application.id}>
            <td><b>{application.guardianName}</b><small>{application.guardianEmail} · {application.guardianPhone}</small></td>
            <td><div className="family-children">{application.children.map(child => <span key={child.name + child.birthday} className="family-child-pill"><b>{child.name}</b><small>{childAge(child.birthday)} · {roomName(data, child.classroomId)}</small></span>)}</div></td>
            <td>{fmtShortDate(application.requestedStart)}</td>
            <td className="note-cell">{application.notes || '—'}</td>
            <td>
              <select className={`status-select status-${application.status}`} value={application.status} aria-label={`Status for the ${application.guardianName} family`} disabled={application.status === 'enrolled' || update.isPending}
                onChange={event => update.mutate({ enrollmentId: application.id, status: event.target.value })}>
                {STATUS_FLOW.map(status => <option key={status} value={status} disabled={status === 'enrolled'}>{STATUS_LABEL[status]}</option>)}
              </select>
            </td>
            <td><div className="row-actions">
              {!['enrolled', 'declined'].includes(application.status) ? <Button className="button-soft button-compact" onClick={() => setAddingChildTo(application)}><Plus size={14}/> Add child</Button> : null}
              {application.status === 'approved'
                ? <Button className="button-teal button-compact" disabled={update.isPending} onClick={() => update.mutate({ enrollmentId: application.id, status: 'enrolled' })}>Enroll {application.children.length > 1 ? `all ${application.children.length}` : ''}</Button>
                : application.status === 'enrolled' ? <span className="enrolled-check"><CheckCircle2 size={15}/> Enrolled</span> : null}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
    {adding ? <NewApplicationModal data={data} onClose={() => setAdding(false)}/> : null}
    {addingChildTo ? <AddChildModal data={data} application={addingChildTo} onClose={() => setAddingChildTo(null)}/> : null}
  </>;
}
