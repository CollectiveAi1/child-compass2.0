import { useState } from 'react';
import { CheckCircle2, ClipboardList, Download, Hourglass, Printer, UserPlus, Users } from 'lucide-react';
import type { DashboardData, EnrollmentStatus } from '@compass/shared';
import { childAge } from '@compass/shared';
import { Button, Modal } from '../../components/ui';
import { useAddEnrollment, useUpdateEnrollment } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { enrollmentReport } from './reportDefs';
import { fmtShortDate, roomName, SectionHead, StatCard, todayIso } from './common';

const STATUS_FLOW: EnrollmentStatus[] = ['inquiry', 'toured', 'waitlist', 'approved', 'enrolled', 'declined'];
const STATUS_LABEL: Record<EnrollmentStatus, string> = { inquiry: 'New inquiry', toured: 'Toured', waitlist: 'Waitlist', approved: 'Approved', enrolled: 'Enrolled', declined: 'Declined' };

function NewApplicationModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useAddEnrollment();
  const [form, setForm] = useState({ childName: '', birthday: '', guardianName: '', guardianEmail: '', guardianPhone: '', classroomId: data.classrooms[0]?.id ?? '', requestedStart: todayIso(), notes: '' });
  return <Modal title="New enrollment application" eyebrow="Growing the Bright Path family" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await create.mutateAsync(form); onClose(); }}>
      <div className="form-row">
        <label>Child’s full name<input required maxLength={80} value={form.childName} onChange={event => setForm({ ...form, childName: event.target.value })}/></label>
        <label>Birthday<input type="date" required value={form.birthday} onChange={event => setForm({ ...form, birthday: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Guardian name<input required maxLength={80} value={form.guardianName} onChange={event => setForm({ ...form, guardianName: event.target.value })}/></label>
        <label>Guardian email<input type="email" required value={form.guardianEmail} onChange={event => setForm({ ...form, guardianEmail: event.target.value })}/></label>
      </div>
      <div className="form-row">
        <label>Guardian phone<input required maxLength={30} value={form.guardianPhone} onChange={event => setForm({ ...form, guardianPhone: event.target.value })}/></label>
        <label>Requested start<input type="date" required value={form.requestedStart} onChange={event => setForm({ ...form, requestedStart: event.target.value })}/></label>
      </div>
      <label>Preferred classroom<select value={form.classroomId} onChange={event => setForm({ ...form, classroomId: event.target.value })}>{data.classrooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.ageRange}</option>)}</select></label>
      <label>Notes<textarea rows={3} maxLength={400} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="How they found us, tour preferences, siblings…"/></label>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add application'}</Button></div>
    </form>
  </Modal>;
}

export function EnrollmentTab({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const update = useUpdateEnrollment();
  const open = data.enrollments.filter(application => !['enrolled', 'declined'].includes(application.status));
  const report = () => enrollmentReport(data);

  return <>
    <SectionHead title="Enrollment Pipeline" subtitle="Track every family from first inquiry to first day.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print</Button>
      <Button className="button-soft" onClick={() => downloadCsv('enrollment-applications', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><UserPlus size={16}/> New application</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<ClipboardList/>} tone="blue" label="Open Applications" value={open.length} sub={`${data.enrollments.filter(a => a.status === 'inquiry').length} new inquiries`}/>
      <StatCard icon={<Hourglass/>} tone="amber" label="Waitlisted" value={data.enrollments.filter(a => a.status === 'waitlist').length} sub="Waiting on an opening"/>
      <StatCard icon={<CheckCircle2/>} tone="green" label="Approved" value={data.enrollments.filter(a => a.status === 'approved').length} sub="Ready to enroll"/>
      <StatCard icon={<Users/>} tone="teal" label="Open Seats" value={Math.max(data.center.capacity - data.children.length, 0)} sub={`of ${data.center.capacity} licensed capacity`}/>
    </section>

    <article className="panel table-panel">
      <header><h2>Applications</h2><span className="muted-count">{data.enrollments.length} total</span></header>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Child</th><th>Guardian</th><th>Requested room</th><th>Start</th><th>Notes</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{data.enrollments.map(application => <tr key={application.id}>
            <td><b>{application.childName}</b><small>{childAge(application.birthday)}</small></td>
            <td><b>{application.guardianName}</b><small>{application.guardianEmail} · {application.guardianPhone}</small></td>
            <td>{roomName(data, application.classroomId)}</td>
            <td>{fmtShortDate(application.requestedStart)}</td>
            <td className="note-cell">{application.notes || '—'}</td>
            <td>
              <select className={`status-select status-${application.status}`} value={application.status} aria-label={`Status for ${application.childName}`} disabled={application.status === 'enrolled' || update.isPending}
                onChange={event => update.mutate({ enrollmentId: application.id, status: event.target.value })}>
                {STATUS_FLOW.map(status => <option key={status} value={status} disabled={status === 'enrolled'}>{STATUS_LABEL[status]}</option>)}
              </select>
            </td>
            <td>{application.status === 'approved'
              ? <Button className="button-teal button-compact" disabled={update.isPending} onClick={() => update.mutate({ enrollmentId: application.id, status: 'enrolled' })}>Enroll</Button>
              : application.status === 'enrolled' ? <span className="enrolled-check"><CheckCircle2 size={15}/> Enrolled</span> : <span className="muted-count">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
    {adding ? <NewApplicationModal data={data} onClose={() => setAdding(false)}/> : null}
  </>;
}
