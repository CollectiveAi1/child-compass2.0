import { useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Download, Eye, FileBarChart2, FileHeart, FileText, Flame, GraduationCap, HeartPulse, LayoutDashboard, MessagesSquare, Printer, ScrollText, ShieldAlert, ShieldCheck, Siren, Trash2, Users, Wrench } from 'lucide-react';
import type { ComplianceCheck, DashboardData } from '@compass/shared';
import { Button, IconButton } from '../../components/ui';
import { useDeleteEvent, useUpdateComplianceCheck } from '../../hooks/useCompass';
import { downloadCsv, printReport, type ReportTable } from '../../lib/reports';
import { daysUntil, fmtShortDate, presentCountOn, roomName, SectionHead, StatCard, todayIso } from './common';
import { childComplianceReport, childComplianceRows, complianceSummaryReport, DRILL_CADENCE, drillsReport, drillStatus, INSPECTION_TYPE_LABEL, inspectionsReport, staffComplianceReport, staffComplianceRows, violationsReport } from './licensingReports';
import { ActionsSection, ComplaintsSection, DrillsSection, InspectionsSection, ViolationsSection } from './LicensingOps';
import { DocumentVault, ReportPreviewModal } from './DocumentVault';
import { EventModal } from './EventModal';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inspections', label: 'Inspections', icon: ScrollText },
  { id: 'complaints', label: 'Complaints', icon: MessagesSquare },
  { id: 'actions', label: 'Corrective Actions', icon: Wrench },
  { id: 'violations', label: 'Violations', icon: ShieldAlert },
  { id: 'monitoring', label: 'Monitoring', icon: ClipboardCheck },
  { id: 'staff', label: 'Staff Compliance', icon: GraduationCap },
  { id: 'children', label: 'Child Compliance', icon: FileHeart },
  { id: 'ratios', label: 'Ratios', icon: Users },
  { id: 'health', label: 'Health & Safety', icon: HeartPulse },
  { id: 'drills', label: 'Emergency Drills', icon: Flame },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
];

const pill = (tone: 'good' | 'warn' | 'bad' | 'info', label: string) => <span className={`pill pill-${tone}`}>{label}</span>;

function complianceScore(data: DashboardData): number {
  const openViolations = data.violations.filter(violation => violation.status === 'open').length;
  const overdueActions = data.correctiveActions.filter(action => action.status !== 'completed' && action.status !== 'verified' && daysUntil(action.dueDate) < 0).length;
  const staffIssues = staffComplianceRows(data).filter(row => row.status === 'action_needed').length;
  const childIssues = childComplianceRows(data).filter(row => row.status === 'action_needed').length;
  const overdueDrills = Object.keys(DRILL_CADENCE).filter(type => drillStatus(data, type).overdue).length;
  const checksNeedingAction = data.complianceChecks.filter(check => check.status !== 'compliant').length;
  return Math.max(40, 100 - openViolations * 8 - overdueActions * 6 - staffIssues * 5 - childIssues * 3 - overdueDrills * 6 - checksNeedingAction * 2);
}

function Checklist({ data, category, title, subtitle }: { data: DashboardData; category: ComplianceCheck['category']; title: string; subtitle: string }) {
  const update = useUpdateComplianceCheck();
  const items = data.complianceChecks.filter(check => check.category === category);
  const next: Record<ComplianceCheck['status'], ComplianceCheck['status']> = { compliant: 'action_needed', action_needed: 'pending', pending: 'compliant' };
  return <article className="panel table-panel">
    <header><div><h2>{title}</h2><p>{subtitle}</p></div><span className="muted-count">{items.filter(item => item.status === 'compliant').length} / {items.length} compliant</span></header>
    <div className="checklist">{items.map(check => <button key={check.id} className={`check-row status-${check.status}`} disabled={update.isPending} onClick={() => update.mutate({ checkId: check.id, status: next[check.status] })} title="Click to cycle status">
      <span className="check-mark">{check.status === 'compliant' ? <CheckCircle2 size={18}/> : check.status === 'action_needed' ? <AlertTriangle size={18}/> : <ClipboardCheck size={18}/>}</span>
      <span className="check-copy"><b>{check.item}</b><small>Last checked {fmtShortDate(check.lastChecked)}</small></span>
      {pill(check.status === 'compliant' ? 'good' : check.status === 'action_needed' ? 'bad' : 'warn', check.status.replace('_', ' '))}
    </button>)}</div>
    <p className="empty-note">Click any item to cycle its status — the check date updates automatically.</p>
  </article>;
}

function CalendarSection({ data }: { data: DashboardData }) {
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const deleteEvent = useDeleteEvent();
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const entries: Record<number, { kind: string; label: string; eventId?: string }[]> = {};
  const add = (date: string, kind: string, label: string, eventId?: string) => {
    if (!date.startsWith(monthKey)) return;
    const day = Number(date.slice(8, 10));
    (entries[day] ??= []).push({ kind, label, eventId });
  };
  data.events.forEach(event => add(event.date, 'event', event.title, event.id));
  data.inspections.forEach(inspection => add(inspection.date, 'inspection', `${INSPECTION_TYPE_LABEL[inspection.type]} inspection`));
  data.correctiveActions.filter(action => action.status !== 'completed' && action.status !== 'verified').forEach(action => add(action.dueDate, 'due', `Action due: ${action.assignedTo}`));
  data.staff.forEach(member => (member.credentials ?? []).forEach(credential => add(credential.expires, 'expiry', `${member.name.split(' ')[0]}: ${credential.name} expires`)));
  Object.entries(DRILL_CADENCE).forEach(([type, cadence]) => {
    const status = drillStatus(data, type);
    if (status.last) {
      const due = new Date(`${status.last}T12:00:00`);
      due.setDate(due.getDate() + cadence.everyDays);
      add(due.toISOString().slice(0, 10), 'drill', `${cadence.label} drill due`);
    }
  });

  return <>
    <SectionHead title="Compliance Calendar" subtitle="Inspections, action deadlines, credential expirations, drill windows, and center events in one view.">
      <Button className="button-primary" onClick={() => setAdding(true)}><CalendarPlus size={16}/> Add event</Button>
    </SectionHead>
    <article className="panel calendar-panel">
      <header>
        <IconButton label="Previous month" onClick={() => setOffset(value => value - 1)}><ChevronLeft size={18}/></IconButton>
        <h2>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
        <IconButton label="Next month" onClick={() => setOffset(value => value + 1)}><ChevronRight size={18}/></IconButton>
      </header>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}
        {Array.from({ length: month.getDay() }).map((_, index) => <span key={`pad-${index}`} className="calendar-cell empty"/>)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const isToday = offset === 0 && day === base.getDate();
          return <div key={day} className={`calendar-cell ${isToday ? 'today' : ''}`}>
            <b>{day}</b>
            {(entries[day] ?? []).slice(0, 3).map((entry, entryIndex) => <span key={entryIndex} className={`calendar-pill kind-${entry.kind}`} title={entry.label}>
              {entry.label}
              {entry.eventId ? <button aria-label={`Remove ${entry.label}`} disabled={deleteEvent.isPending} onClick={() => deleteEvent.mutate({ eventId: entry.eventId! })}><Trash2 size={10}/></button> : null}
            </span>)}
            {(entries[day]?.length ?? 0) > 3 ? <small>+{entries[day]!.length - 3} more</small> : null}
          </div>;
        })}
      </div>
      <footer className="calendar-legend">
        <span><i className="kind-event"/>Center event (removable)</span>
        <span><i className="kind-inspection"/>Inspection</span>
        <span><i className="kind-due"/>Corrective action due</span>
        <span><i className="kind-expiry"/>Credential expires</span>
        <span><i className="kind-drill"/>Drill due</span>
      </footer>
    </article>
    {adding ? <EventModal eyebrow="Compliance calendar" onClose={() => setAdding(false)}/> : null}
  </>;
}

const LICENSING_REPORTS: { id: string; name: string; description: string; icon: typeof FileText; tone: string; build: (data: DashboardData) => ReportTable }[] = [
  { id: 'compliance-summary', name: 'Compliance Summary', description: 'One-page standing across every licensing area — perfect for board packets.', icon: ShieldCheck, tone: 'navy', build: complianceSummaryReport },
  { id: 'inspection-history', name: 'Inspection History', description: 'Every licensing visit with results and findings.', icon: ScrollText, tone: 'blue', build: inspectionsReport },
  { id: 'violations-actions', name: 'Violations & Corrective Actions', description: 'Citations paired with their fixes, owners, and due dates.', icon: ShieldAlert, tone: 'red', build: violationsReport },
  { id: 'drill-log', name: 'Emergency Drill Log', description: 'The full drill record formatted for licensing review.', icon: Flame, tone: 'amber', build: drillsReport },
  { id: 'staff-compliance', name: 'Staff Compliance', description: 'Credential status and expirations for every team member.', icon: GraduationCap, tone: 'green', build: staffComplianceReport },
  { id: 'child-compliance', name: 'Child File Compliance', description: 'Immunizations, contacts, and physicals on file per child.', icon: FileHeart, tone: 'purple', build: childComplianceReport },
];

export function LicensingTab({ data }: { data: DashboardData }) {
  const [section, setSection] = useState('dashboard');
  const [preview, setPreview] = useState<ReportTable | null>(null);

  const score = complianceScore(data);
  const openViolations = data.violations.filter(violation => violation.status === 'open');
  const activeActions = data.correctiveActions.filter(action => action.status !== 'completed' && action.status !== 'verified');
  const overdueDrillTypes = Object.entries(DRILL_CADENCE).filter(([type]) => drillStatus(data, type).overdue);
  const nextInspection = data.inspections.filter(inspection => inspection.status === 'scheduled' && inspection.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const staffIssues = staffComplianceRows(data).filter(row => row.status !== 'compliant');
  const childIssues = childComplianceRows(data).filter(row => row.status === 'action_needed');

  const attention: { icon: typeof AlertTriangle; text: string; target: string }[] = [
    ...openViolations.map(violation => ({ icon: ShieldAlert, text: `Open violation ${violation.code} — ${violation.description.slice(0, 70)}`, target: 'violations' })),
    ...activeActions.filter(action => daysUntil(action.dueDate) <= 7).map(action => ({ icon: Wrench, text: `Corrective action ${daysUntil(action.dueDate) < 0 ? 'overdue' : `due ${fmtShortDate(action.dueDate)}`}: ${action.description.slice(0, 60)}`, target: 'actions' })),
    ...overdueDrillTypes.map(([, cadence]) => ({ icon: Flame, text: `${cadence.label} drill is overdue — run and log one`, target: 'drills' })),
    ...staffIssues.map(({ member, expired, expiring }) => ({ icon: GraduationCap, text: `${member.name}: ${expired.length ? `${expired.length} credential(s) expired` : `${expiring.length} credential(s) expiring soon`}`, target: 'staff' })),
    ...childIssues.slice(0, 3).map(({ child }) => ({ icon: FileHeart, text: `${child.firstName} ${child.lastName}'s file is incomplete`, target: 'children' })),
    ...data.complaints.filter(complaint => complaint.status === 'open' || complaint.status === 'investigating').map(complaint => ({ icon: Siren, text: `Complaint under investigation (${fmtShortDate(complaint.receivedOn)})`, target: 'complaints' })),
  ];

  return <>
    <SectionHead title="Licensing Compliance" subtitle={`License ${data.center.license} · Everything your licensing specialist will ask for, in one place.`}>
      <Button className="button-soft" onClick={() => printReport(complianceSummaryReport(data), data.center.name)}><Printer size={16}/> Print summary</Button>
      <Button className="button-soft" onClick={() => downloadCsv('compliance-summary', complianceSummaryReport(data))}><Download size={16}/> CSV</Button>
    </SectionHead>

    <nav className="licensing-subnav" aria-label="Licensing sections">{SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={15}/>{label}</button>)}</nav>

    {section === 'dashboard' ? <>
      <section className="licensing-hero">
        <article className="panel score-card">
          <div className="score-ring" style={{ background: `conic-gradient(${score >= 90 ? '#14b8a6' : score >= 75 ? '#f59e0b' : '#ef4444'} ${score * 3.6}deg, #e8eef5 0deg)` }}><span>{score}</span></div>
          <div><p className="eyebrow">Compliance score</p><h2>{score >= 90 ? 'Licensing ready' : score >= 75 ? 'Nearly ready' : 'Needs attention'}</h2><p className="muted-note">Live score from violations, actions, drills, staff and child files, and checklists.</p></div>
        </article>
        <section className="stat-grid stat-grid-4 licensing-stats">
          <StatCard icon={<ShieldAlert/>} tone={openViolations.length ? 'red' : 'teal'} label="Open Violations" value={openViolations.length} onClick={() => setSection('violations')} actionLabel="Review citations"/>
          <StatCard icon={<Wrench/>} tone={activeActions.length ? 'amber' : 'green'} label="Actions In Progress" value={activeActions.length} onClick={() => setSection('actions')} actionLabel="View action plan"/>
          <StatCard icon={<ScrollText/>} tone="blue" label="Next Inspection" value={nextInspection ? fmtShortDate(nextInspection.date) : 'None set'} onClick={() => setSection('inspections')} actionLabel={nextInspection ? INSPECTION_TYPE_LABEL[nextInspection.type] : 'Schedule one'}/>
          <StatCard icon={<Flame/>} tone={overdueDrillTypes.length ? 'red' : 'teal'} label="Drills Overdue" value={overdueDrillTypes.length} onClick={() => setSection('drills')} actionLabel="Open drill tracker"/>
        </section>
      </section>
      <article className="panel table-panel">
        <header><div><h2>Needs your attention</h2><p>Everything pulling your score down, with a shortcut to fix it.</p></div><span className="count-pill">{attention.length}</span></header>
        {attention.length ? <div className="attention-links">{attention.map((item, index) => { const Icon = item.icon; return <button key={index} onClick={() => setSection(item.target)}><span className="attention-glyph"><Icon size={16}/></span><span>{item.text}</span><ChevronRight size={15}/></button>; })}</div>
          : <p className="empty-note">Nothing needs attention — your center is licensing ready. 🎉</p>}
      </article>
    </> : null}

    {section === 'inspections' ? <InspectionsSection data={data}/> : null}
    {section === 'complaints' ? <ComplaintsSection data={data}/> : null}
    {section === 'actions' ? <ActionsSection data={data}/> : null}
    {section === 'violations' ? <ViolationsSection data={data}/> : null}
    {section === 'drills' ? <DrillsSection data={data}/> : null}

    {section === 'monitoring' ? <>
      <SectionHead title="Monitoring" subtitle="Your own audit trail between state visits."/>
      <Checklist data={data} category="monitoring" title="Self-monitoring checklist" subtitle="Work through this monthly — it mirrors what a monitoring visit reviews."/>
      <article className="panel table-panel">
        <header><h2>Monitoring visits</h2><Button className="button-soft button-compact" onClick={() => setSection('inspections')}>All inspections</Button></header>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Date</th><th>Inspector</th><th>Result</th><th>Notes</th></tr></thead>
          <tbody>{data.inspections.filter(inspection => inspection.type === 'monitoring' || inspection.type === 'follow_up').map(inspection => <tr key={inspection.id}>
            <td>{fmtShortDate(inspection.date)}</td><td>{inspection.inspector}</td><td className="capitalize">{inspection.status}</td><td className="note-cell">{inspection.notes || '—'}</td>
          </tr>)}</tbody>
        </table></div>
      </article>
    </> : null}

    {section === 'staff' ? <>
      <SectionHead title="Staff Compliance" subtitle="Credentials, expirations, and files — what licensing checks first.">
        <Button className="button-soft" onClick={() => printReport(staffComplianceReport(data), data.center.name)}><Printer size={16}/> Print</Button>
        <Button className="button-soft" onClick={() => downloadCsv('staff-compliance', staffComplianceReport(data))}><Download size={16}/> CSV</Button>
      </SectionHead>
      <article className="panel table-panel">
        <header><h2>Team standing</h2><span className="muted-count">{staffComplianceRows(data).filter(row => row.status === 'compliant').length} / {data.staff.length} fully compliant</span></header>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Team member</th><th>Title</th><th>Credentials</th><th>Standing</th></tr></thead>
          <tbody>{staffComplianceRows(data).map(({ member, credentials, expired, expiring, status }) => <tr key={member.id}>
            <td><b>{member.name}</b></td>
            <td>{member.title ?? '—'}</td>
            <td className="note-cell">{credentials.length ? credentials.map(credential => `${credential.name} (exp ${fmtShortDate(credential.expires)})`).join(' · ') : 'None on file'}</td>
            <td>{status === 'compliant' ? pill('good', 'compliant') : status === 'expiring' ? pill('warn', `${expiring.length} expiring soon`) : pill('bad', `${expired.length} expired`)}</td>
          </tr>)}</tbody>
        </table></div>
      </article>
    </> : null}

    {section === 'children' ? <>
      <SectionHead title="Child Compliance" subtitle="Every child file audit-ready: immunizations, contacts, physicals.">
        <Button className="button-soft" onClick={() => printReport(childComplianceReport(data), data.center.name)}><Printer size={16}/> Print</Button>
        <Button className="button-soft" onClick={() => downloadCsv('child-compliance', childComplianceReport(data))}><Download size={16}/> CSV</Button>
      </SectionHead>
      <article className="panel table-panel">
        <header><h2>File audit</h2><span className="muted-count">{childComplianceRows(data).filter(row => row.status === 'compliant').length} / {data.children.length} complete</span></header>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Child</th><th>Classroom</th><th>Immunizations</th><th>Emergency contacts</th><th>Physical</th><th>Standing</th></tr></thead>
          <tbody>{childComplianceRows(data).map(({ child, immunizationsOk, contactsOk, physicalOk, status }) => <tr key={child.id}>
            <td><b>{child.firstName} {child.lastName}</b></td>
            <td>{roomName(data, child.classroomId)}</td>
            <td>{immunizationsOk ? pill('good', 'complete') : pill('bad', 'incomplete')}</td>
            <td>{contactsOk ? pill('good', 'on file') : pill('bad', 'missing')}</td>
            <td>{physicalOk ? fmtShortDate(child.medical!.lastPhysical) : pill('warn', 'missing')}</td>
            <td>{status === 'compliant' ? pill('good', 'compliant') : pill('bad', 'action needed')}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="empty-note">Update any child’s records from the Children tab — this audit refreshes live.</p>
      </article>
    </> : null}

    {section === 'ratios' ? <>
      <SectionHead title="Ratios" subtitle="Live staff-to-child ratios against your licensed limits."/>
      <article className="panel table-panel">
        <header><h2>Right now</h2><span className="muted-count">{presentCountOn(data, todayIso())} children checked in today</span></header>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Classroom</th><th>Age range</th><th>Present now</th><th>Teachers assigned</th><th>Current ratio</th><th>Licensed limit</th><th>Standing</th></tr></thead>
          <tbody>{data.classrooms.map(room => {
            const present = data.children.filter(child => child.classroomId === room.id && child.attendanceStatus === 'present').length;
            const teachers = room.teacherIds.length;
            const ratio = teachers ? Math.ceil(present / teachers) : present;
            const inRatio = teachers > 0 && ratio <= room.ratioLimit;
            return <tr key={room.id}>
              <td><b>{room.name}</b></td>
              <td>{room.ageRange}</td>
              <td>{present}</td>
              <td>{teachers}</td>
              <td><strong>1:{ratio}</strong></td>
              <td>1:{room.ratioLimit}</td>
              <td>{present === 0 ? pill('info', 'no children present') : inRatio ? pill('good', 'in ratio') : pill('bad', 'over ratio')}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <p className="empty-note">Ratios update live with attendance check-ins. Licensed limits come from center settings.</p>
      </article>
    </> : null}

    {section === 'health' ? <>
      <SectionHead title="Health & Safety" subtitle="The physical-environment checks licensing walks through on site."/>
      <Checklist data={data} category="health_safety" title="Health & safety checklist" subtitle="Walk the building with this list — click items as you verify them."/>
    </> : null}

    {section === 'forms' ? <>
      <SectionHead title="Forms" subtitle="Licensing forms and records — download blanks, upload completed copies."/>
      <DocumentVault data={data} categories={['licensing', 'medical', 'attendance', 'enrollment']} defaultCategory="licensing" title="Licensing Forms & Records" subtitle="Incident reports, medication authorizations, drill logs, and anything your specialist requests."/>
    </> : null}

    {section === 'calendar' ? <CalendarSection data={data}/> : null}

    {section === 'reports' ? <>
      <SectionHead title="Licensing Reports" subtitle="Preview, print, or download the records your licensing specialist asks for."/>
      <section className="report-grid">{LICENSING_REPORTS.map(({ id, name, description, icon: Icon, tone, build }) => <article className="panel report-card" key={id}>
        <span className={`report-icon tone-${tone}`}><Icon/></span>
        <h3>{name}</h3>
        <p>{description}</p>
        <div className="report-actions">
          <Button className="button-ghost button-compact" onClick={() => setPreview(build(data))}><Eye size={14}/> Preview</Button>
          <Button className="button-soft button-compact" onClick={() => printReport(build(data), data.center.name)}><Printer size={14}/> Print</Button>
          <Button className="button-teal button-compact" onClick={() => downloadCsv(id, build(data))}><Download size={14}/> CSV</Button>
        </div>
      </article>)}</section>
    </> : null}

    {preview ? <ReportPreviewModal table={preview} centerName={data.center.name} onClose={() => setPreview(null)}/> : null}
  </>;
}
