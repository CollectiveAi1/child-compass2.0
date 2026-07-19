import { useState } from 'react';
import { AlarmCheck, ClipboardCheck, Download, FilePlus2, Flame, Printer, ShieldAlert, Siren } from 'lucide-react';
import type { ComplaintStatus, CorrectiveActionStatus, DashboardData, InspectionStatus, ViolationStatus } from '@compass/shared';
import { Button, Modal } from '../../components/ui';
import { useAddComplaint, useAddCorrectiveAction, useAddDrill, useAddInspection, useAddViolation, useUpdateComplaint, useUpdateCorrectiveAction, useUpdateInspection, useUpdateViolation } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { daysUntil, fmtShortDate, SectionHead, StatCard, todayIso } from './common';
import { DRILL_CADENCE, drillStatus, drillsReport, INSPECTION_TYPE_LABEL, inspectionsReport, violationsReport } from './licensingReports';

const pill = (tone: 'good' | 'warn' | 'bad' | 'info', label: string) => <span className={`pill pill-${tone}`}>{label}</span>;

export function InspectionsSection({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const create = useAddInspection();
  const update = useUpdateInspection();
  const [form, setForm] = useState({ date: todayIso(), type: 'monitoring', inspector: '', status: 'scheduled', findings: '0', notes: '' });
  const report = () => inspectionsReport(data);
  return <>
    <SectionHead title="Inspections" subtitle="Every licensing visit — scheduled, passed, and findings.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print</Button>
      <Button className="button-soft" onClick={() => downloadCsv('inspections', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><FilePlus2 size={16}/> Log inspection</Button>
    </SectionHead>
    <article className="panel table-panel">
      <header><h2>Inspection history</h2><span className="muted-count">{data.inspections.length} on record</span></header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Inspector</th><th>Result</th><th>Findings</th><th>Notes</th></tr></thead>
        <tbody>{data.inspections.map(inspection => <tr key={inspection.id}>
          <td>{fmtShortDate(inspection.date)}</td>
          <td>{INSPECTION_TYPE_LABEL[inspection.type]}</td>
          <td>{inspection.inspector}</td>
          <td><select className={`status-select status-${inspection.status === 'passed' ? 'approved' : inspection.status === 'findings' ? 'waitlist' : inspection.status === 'failed' ? 'declined' : 'inquiry'}`} value={inspection.status} aria-label={`Result for ${fmtShortDate(inspection.date)} inspection`} disabled={update.isPending}
            onChange={event => update.mutate({ inspectionId: inspection.id, status: event.target.value as InspectionStatus })}>
            <option value="scheduled">Scheduled</option><option value="passed">Passed</option><option value="findings">Findings</option><option value="failed">Failed</option>
          </select></td>
          <td>{inspection.findings}</td>
          <td className="note-cell">{inspection.notes || '—'}</td>
        </tr>)}</tbody>
      </table></div>
    </article>
    {adding ? <Modal title="Log an inspection" eyebrow="Licensing visits" onClose={() => setAdding(false)}>
      <form className="stacked-form" onSubmit={async event => {
        event.preventDefault();
        await create.mutateAsync({ ...form, type: form.type as 'annual', status: form.status as InspectionStatus, findings: Number(form.findings) || 0 });
        setAdding(false);
      }}>
        <div className="form-row">
          <label>Date<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label>
          <label>Type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{Object.entries(INSPECTION_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>Inspector<input required maxLength={80} value={form.inspector} onChange={event => setForm({ ...form, inspector: event.target.value })} placeholder="Name, agency"/></label>
        <div className="form-row">
          <label>Result<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="scheduled">Scheduled</option><option value="passed">Passed</option><option value="findings">Findings</option><option value="failed">Failed</option></select></label>
          <label>Findings<input type="number" min={0} value={form.findings} onChange={event => setForm({ ...form, findings: event.target.value })}/></label>
        </div>
        <label>Notes<textarea rows={3} maxLength={500} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setAdding(false)}>Cancel</Button><Button className="button-primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Log inspection'}</Button></div>
      </form>
    </Modal> : null}
  </>;
}

export function ComplaintsSection({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const create = useAddComplaint();
  const update = useUpdateComplaint();
  const [form, setForm] = useState({ receivedOn: todayIso(), source: 'parent', summary: '' });
  const open = data.complaints.filter(complaint => complaint.status === 'open' || complaint.status === 'investigating');
  return <>
    <SectionHead title="Complaints" subtitle="Track every concern from receipt to documented resolution.">
      <Button className="button-primary" onClick={() => setAdding(true)}><FilePlus2 size={16}/> Record complaint</Button>
    </SectionHead>
    <section className="stat-grid stat-grid-4">
      <StatCard icon={<Siren/>} tone={open.length ? 'amber' : 'teal'} label="Open" value={open.length} sub={open.length ? 'Being investigated' : 'Nothing open'}/>
      <StatCard icon={<ClipboardCheck/>} tone="green" label="Resolved" value={data.complaints.filter(complaint => complaint.status === 'resolved').length} sub="With documented outcomes"/>
      <StatCard icon={<ShieldAlert/>} tone="blue" label="Total On Record" value={data.complaints.length} sub="Current licensing year"/>
      <StatCard icon={<AlarmCheck/>} tone="purple" label="Response Goal" value="48h" sub="Acknowledge every complaint"/>
    </section>
    <article className="panel table-panel">
      <header><h2>Complaint log</h2><span className="muted-count">{data.complaints.length} total</span></header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Received</th><th>Source</th><th>Summary</th><th>Status</th><th>Resolution</th></tr></thead>
        <tbody>{data.complaints.map(complaint => <tr key={complaint.id}>
          <td>{fmtShortDate(complaint.receivedOn)}</td>
          <td className="capitalize">{complaint.source}</td>
          <td className="note-cell">{complaint.summary}</td>
          <td><select className={`status-select status-${complaint.status === 'resolved' ? 'approved' : complaint.status === 'investigating' ? 'waitlist' : complaint.status === 'unfounded' ? 'declined' : 'inquiry'}`} value={complaint.status} aria-label="Complaint status" disabled={update.isPending}
            onChange={event => { const status = event.target.value as ComplaintStatus; if (status === 'resolved') { setResolving(complaint.id); setResolution(complaint.resolution); } else update.mutate({ complaintId: complaint.id, status }); }}>
            <option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="unfounded">Unfounded</option>
          </select></td>
          <td className="note-cell">{complaint.resolution || '—'}</td>
        </tr>)}</tbody>
      </table></div>
    </article>
    {adding ? <Modal title="Record a complaint" eyebrow="Complaint intake" onClose={() => setAdding(false)}>
      <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await create.mutateAsync(form); setAdding(false); }}>
        <div className="form-row">
          <label>Received<input type="date" required value={form.receivedOn} onChange={event => setForm({ ...form, receivedOn: event.target.value })}/></label>
          <label>Source<select value={form.source} onChange={event => setForm({ ...form, source: event.target.value })}><option value="parent">Parent</option><option value="staff">Staff</option><option value="anonymous">Anonymous</option><option value="state">State agency</option></select></label>
        </div>
        <label>Summary<textarea required rows={3} maxLength={500} value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} placeholder="What was reported"/></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setAdding(false)}>Cancel</Button><Button className="button-primary" disabled={create.isPending || !form.summary}>{create.isPending ? 'Saving…' : 'Record complaint'}</Button></div>
      </form>
    </Modal> : null}
    {resolving ? <Modal title="Resolve complaint" eyebrow="Document the outcome" onClose={() => setResolving(null)}>
      <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await update.mutateAsync({ complaintId: resolving, status: 'resolved', resolution }); setResolving(null); }}>
        <label>What was done to resolve it?<textarea required rows={4} maxLength={500} value={resolution} onChange={event => setResolution(event.target.value)}/></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setResolving(null)}>Cancel</Button><Button className="button-teal" disabled={update.isPending || !resolution}>{update.isPending ? 'Saving…' : 'Mark resolved'}</Button></div>
      </form>
    </Modal> : null}
  </>;
}

export function ViolationsSection({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const create = useAddViolation();
  const update = useUpdateViolation();
  const [form, setForm] = useState({ code: '', description: '', severity: 'low', citedOn: todayIso(), inspectionId: '' });
  const report = () => violationsReport(data);
  return <>
    <SectionHead title="Violations" subtitle="Citations from licensing visits and their current standing.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print</Button>
      <Button className="button-soft" onClick={() => downloadCsv('violations', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><FilePlus2 size={16}/> Record violation</Button>
    </SectionHead>
    <article className="panel table-panel">
      <header><h2>Citations</h2><span className="muted-count">{data.violations.filter(violation => violation.status === 'open').length} open</span></header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Rule code</th><th>Description</th><th>Severity</th><th>Cited</th><th>Status</th></tr></thead>
        <tbody>{data.violations.map(violation => <tr key={violation.id}>
          <td><b>{violation.code}</b></td>
          <td className="note-cell">{violation.description}</td>
          <td>{pill(violation.severity === 'serious' ? 'bad' : violation.severity === 'moderate' ? 'warn' : 'info', violation.severity)}</td>
          <td>{fmtShortDate(violation.citedOn)}</td>
          <td><select className={`status-select status-${violation.status === 'verified' ? 'enrolled' : violation.status === 'corrected' ? 'approved' : 'waitlist'}`} value={violation.status} aria-label={`Status for ${violation.code}`} disabled={update.isPending}
            onChange={event => update.mutate({ violationId: violation.id, status: event.target.value as ViolationStatus })}>
            <option value="open">Open</option><option value="corrected">Corrected</option><option value="verified">Verified</option>
          </select></td>
        </tr>)}</tbody>
      </table></div>
    </article>
    {adding ? <Modal title="Record a violation" eyebrow="Citation" onClose={() => setAdding(false)}>
      <form className="stacked-form" onSubmit={async event => {
        event.preventDefault();
        await create.mutateAsync({ code: form.code, description: form.description, severity: form.severity as 'low', citedOn: form.citedOn, inspectionId: form.inspectionId || undefined });
        setAdding(false);
      }}>
        <div className="form-row">
          <label>Rule code<input required maxLength={40} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="5101:2-12-15"/></label>
          <label>Cited on<input type="date" required value={form.citedOn} onChange={event => setForm({ ...form, citedOn: event.target.value })}/></label>
        </div>
        <div className="form-row">
          <label>Severity<select value={form.severity} onChange={event => setForm({ ...form, severity: event.target.value })}><option value="low">Low</option><option value="moderate">Moderate</option><option value="serious">Serious</option></select></label>
          <label>From inspection (optional)<select value={form.inspectionId} onChange={event => setForm({ ...form, inspectionId: event.target.value })}><option value="">Not linked</option>{data.inspections.map(inspection => <option key={inspection.id} value={inspection.id}>{fmtShortDate(inspection.date)} — {INSPECTION_TYPE_LABEL[inspection.type]}</option>)}</select></label>
        </div>
        <label>Description<textarea required rows={3} maxLength={400} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setAdding(false)}>Cancel</Button><Button className="button-primary" disabled={create.isPending || !form.code || !form.description}>{create.isPending ? 'Saving…' : 'Record violation'}</Button></div>
      </form>
    </Modal> : null}
  </>;
}

export function ActionsSection({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const create = useAddCorrectiveAction();
  const update = useUpdateCorrectiveAction();
  const [form, setForm] = useState({ violationId: '', description: '', assignedTo: '', dueDate: todayIso() });
  return <>
    <SectionHead title="Corrective Actions" subtitle="Every fix, owned and dated, until the state verifies it.">
      <Button className="button-primary" onClick={() => setAdding(true)}><FilePlus2 size={16}/> Add action</Button>
    </SectionHead>
    <article className="panel table-panel">
      <header><h2>Action plan</h2><span className="muted-count">{data.correctiveActions.filter(action => action.status !== 'verified' && action.status !== 'completed').length} in progress</span></header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Action</th><th>Linked violation</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>{data.correctiveActions.map(action => {
          const violation = data.violations.find(item => item.id === action.violationId);
          const overdue = action.status !== 'completed' && action.status !== 'verified' && daysUntil(action.dueDate) < 0;
          return <tr key={action.id}>
            <td className="note-cell"><b>{action.description}</b>{action.completedOn ? <small>Completed {fmtShortDate(action.completedOn)}</small> : null}</td>
            <td>{violation ? violation.code : '—'}</td>
            <td>{action.assignedTo}</td>
            <td>{overdue ? pill('bad', `overdue · ${fmtShortDate(action.dueDate)}`) : fmtShortDate(action.dueDate)}</td>
            <td><select className={`status-select status-${action.status === 'verified' ? 'enrolled' : action.status === 'completed' ? 'approved' : action.status === 'in_progress' ? 'waitlist' : 'inquiry'}`} value={action.status} aria-label="Action status" disabled={update.isPending}
              onChange={event => update.mutate({ actionId: action.id, status: event.target.value as CorrectiveActionStatus })}>
              <option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="verified">Verified</option>
            </select></td>
          </tr>;
        })}</tbody>
      </table></div>
    </article>
    {adding ? <Modal title="Add a corrective action" eyebrow="Fix it, prove it" onClose={() => setAdding(false)}>
      <form className="stacked-form" onSubmit={async event => {
        event.preventDefault();
        await create.mutateAsync({ violationId: form.violationId || undefined, description: form.description, assignedTo: form.assignedTo, dueDate: form.dueDate });
        setAdding(false);
      }}>
        <label>What needs to happen?<textarea required rows={3} maxLength={400} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label>
        <div className="form-row">
          <label>Owner<select required value={form.assignedTo} onChange={event => setForm({ ...form, assignedTo: event.target.value })}><option value="">Choose…</option>{data.staff.map(member => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
          <label>Due date<input type="date" required value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}/></label>
        </div>
        <label>Linked violation (optional)<select value={form.violationId} onChange={event => setForm({ ...form, violationId: event.target.value })}><option value="">Not linked</option>{data.violations.map(violation => <option key={violation.id} value={violation.id}>{violation.code} — {violation.description.slice(0, 60)}</option>)}</select></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setAdding(false)}>Cancel</Button><Button className="button-primary" disabled={create.isPending || !form.description || !form.assignedTo}>{create.isPending ? 'Saving…' : 'Add action'}</Button></div>
      </form>
    </Modal> : null}
  </>;
}

export function DrillsSection({ data }: { data: DashboardData }) {
  const [adding, setAdding] = useState(false);
  const create = useAddDrill();
  const [form, setForm] = useState({ type: 'fire', date: todayIso(), timeOfDay: '10:00 AM', durationMinutes: '5', participants: '18', notes: '' });
  const report = () => drillsReport(data);
  return <>
    <SectionHead title="Emergency Drills" subtitle="Fire monthly, tornado & lockdown quarterly, evacuation twice a year.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print log</Button>
      <Button className="button-soft" onClick={() => downloadCsv('emergency-drills', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setAdding(true)}><Flame size={16}/> Log drill</Button>
    </SectionHead>
    <section className="stat-grid stat-grid-4">{Object.entries(DRILL_CADENCE).map(([type, cadence]) => {
      const status = drillStatus(data, type);
      return <StatCard key={type} icon={<Flame/>} tone={status.overdue ? 'red' : status.dueIn <= 7 ? 'amber' : 'teal'} label={`${cadence.label} Drill`}
        value={status.last ? fmtShortDate(status.last) : 'Never'}
        sub={status.overdue ? 'Overdue — run one now' : `Next due in ${status.dueIn} days`} subTone={status.overdue ? 'negative' : 'muted'}/>;
    })}</section>
    <article className="panel table-panel">
      <header><h2>Drill log</h2><span className="muted-count">{data.drills.length} recorded</span></header>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Date</th><th>Drill</th><th>Time</th><th>Duration</th><th>Participants</th><th>Conducted by</th><th>Notes</th></tr></thead>
        <tbody>{data.drills.map(drill => <tr key={drill.id}>
          <td>{fmtShortDate(drill.date)}</td>
          <td>{DRILL_CADENCE[drill.type]?.label ?? drill.type}</td>
          <td>{drill.timeOfDay}</td>
          <td>{drill.durationMinutes} min</td>
          <td>{drill.participants}</td>
          <td>{drill.conductedBy}</td>
          <td className="note-cell">{drill.notes ?? '—'}</td>
        </tr>)}</tbody>
      </table></div>
    </article>
    {adding ? <Modal title="Log an emergency drill" eyebrow="Practice makes prepared" onClose={() => setAdding(false)}>
      <form className="stacked-form" onSubmit={async event => {
        event.preventDefault();
        await create.mutateAsync({ type: form.type as 'fire', date: form.date, timeOfDay: form.timeOfDay, durationMinutes: Number(form.durationMinutes) || 1, participants: Number(form.participants) || 0, notes: form.notes || undefined });
        setAdding(false);
      }}>
        <div className="form-row">
          <label>Drill type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{Object.entries(DRILL_CADENCE).map(([value, cadence]) => <option key={value} value={value}>{cadence.label}</option>)}</select></label>
          <label>Date<input type="date" required max={todayIso()} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label>
        </div>
        <div className="form-row form-row-3">
          <label>Time<input required maxLength={20} value={form.timeOfDay} onChange={event => setForm({ ...form, timeOfDay: event.target.value })}/></label>
          <label>Duration (min)<input type="number" min={1} value={form.durationMinutes} onChange={event => setForm({ ...form, durationMinutes: event.target.value })}/></label>
          <label>Participants<input type="number" min={0} value={form.participants} onChange={event => setForm({ ...form, participants: event.target.value })}/></label>
        </div>
        <label>Notes (optional)<input maxLength={300} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Anything to improve next time"/></label>
        <div className="modal-actions"><Button type="button" className="button-ghost" onClick={() => setAdding(false)}>Cancel</Button><Button className="button-teal" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Log drill'}</Button></div>
      </form>
    </Modal> : null}
  </>;
}
