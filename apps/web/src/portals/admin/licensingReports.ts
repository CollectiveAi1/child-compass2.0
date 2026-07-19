import type { DashboardData } from '@compass/shared';
import type { ReportTable } from '../../lib/reports';
import { daysUntil, fmtDate, presentCountOn, roomName, todayIso } from './common';

// Report builders for the Licensing Compliance tab — same table shape the
// shared print/CSV/preview helpers consume.

export const INSPECTION_TYPE_LABEL: Record<string, string> = { annual: 'Annual', renewal: 'Renewal', monitoring: 'Monitoring', follow_up: 'Follow-up', complaint: 'Complaint' };

// Drill cadence required by licensing: how many days may pass between drills.
export const DRILL_CADENCE: Record<string, { label: string; everyDays: number }> = {
  fire: { label: 'Fire', everyDays: 31 },
  tornado: { label: 'Tornado', everyDays: 92 },
  lockdown: { label: 'Lockdown', everyDays: 92 },
  evacuation: { label: 'Evacuation', everyDays: 183 },
};

export function drillStatus(data: DashboardData, type: string): { last?: string; dueIn: number; overdue: boolean } {
  const last = data.drills.filter(drill => drill.type === type).map(drill => drill.date).sort().at(-1);
  const cadence = DRILL_CADENCE[type]!.everyDays;
  if (!last) return { dueIn: 0, overdue: true };
  const dueIn = cadence + daysUntil(last);
  return { last, dueIn, overdue: dueIn < 0 };
}

export function staffComplianceRows(data: DashboardData) {
  return data.staff.map(member => {
    const credentials = member.credentials ?? [];
    const expired = credentials.filter(credential => daysUntil(credential.expires) < 0);
    const expiring = credentials.filter(credential => daysUntil(credential.expires) >= 0 && daysUntil(credential.expires) <= 30);
    const status = expired.length ? 'action_needed' : expiring.length ? 'expiring' : 'compliant';
    return { member, credentials, expired, expiring, status };
  });
}

export function childComplianceRows(data: DashboardData) {
  return data.children.map(child => {
    const medical = child.medical;
    const immunizationsOk = !!medical?.immunizations.length && medical.immunizations.every(shot => shot.status === 'complete');
    const contactsOk = (medical?.emergencyContacts.length ?? 0) >= 1;
    const physicalOk = !!medical?.lastPhysical;
    const status = immunizationsOk && contactsOk && physicalOk ? 'compliant' : 'action_needed';
    return { child, immunizationsOk, contactsOk, physicalOk, status };
  });
}

export function inspectionsReport(data: DashboardData): ReportTable {
  return {
    title: 'Licensing Inspection History', subtitle: `License ${data.center.license}`,
    columns: ['Date', 'Type', 'Inspector', 'Result', 'Findings', 'Notes'],
    rows: data.inspections.map(inspection => [fmtDate(inspection.date), INSPECTION_TYPE_LABEL[inspection.type] ?? inspection.type, inspection.inspector, inspection.status.replace('_', ' '), inspection.findings, inspection.notes]),
  };
}

export function violationsReport(data: DashboardData): ReportTable {
  const rows = data.violations.map(violation => {
    const action = data.correctiveActions.find(item => item.violationId === violation.id);
    return [violation.code, violation.description, violation.severity, fmtDate(violation.citedOn), violation.status, action ? `${action.description} (${action.status.replace('_', ' ')}, due ${fmtDate(action.dueDate)})` : '—'];
  });
  return {
    title: 'Violations & Corrective Actions', subtitle: `${data.violations.filter(violation => violation.status === 'open').length} open of ${data.violations.length} cited`,
    columns: ['Rule code', 'Violation', 'Severity', 'Cited', 'Status', 'Corrective action'],
    rows,
  };
}

export function drillsReport(data: DashboardData): ReportTable {
  return {
    title: 'Emergency Drill Log', subtitle: 'Fire monthly · tornado & lockdown quarterly · evacuation twice yearly',
    columns: ['Date', 'Drill', 'Time', 'Duration', 'Participants', 'Conducted by', 'Notes'],
    rows: data.drills.map(drill => [fmtDate(drill.date), DRILL_CADENCE[drill.type]?.label ?? drill.type, drill.timeOfDay, `${drill.durationMinutes} min`, drill.participants, drill.conductedBy, drill.notes ?? '—']),
    footer: 'Retain drill records for the current and previous licensing year.',
  };
}

export function staffComplianceReport(data: DashboardData): ReportTable {
  return {
    title: 'Staff Compliance', subtitle: 'Credentials and expirations for licensing review',
    columns: ['Team member', 'Title', 'Credentials', 'Expired', 'Expiring ≤30 days', 'Status'],
    rows: staffComplianceRows(data).map(({ member, credentials, expired, expiring, status }) => [member.name, member.title ?? '—', credentials.map(credential => `${credential.name} (exp ${fmtDate(credential.expires)})`).join('; ') || 'None on file', expired.length, expiring.length, status.replace('_', ' ')]),
  };
}

export function childComplianceReport(data: DashboardData): ReportTable {
  return {
    title: 'Child File Compliance', subtitle: 'Immunizations, emergency contacts, and physicals on file',
    columns: ['Child', 'Classroom', 'Immunizations', 'Emergency contacts', 'Physical on file', 'Status'],
    rows: childComplianceRows(data).map(({ child, immunizationsOk, contactsOk, physicalOk, status }) => [`${child.firstName} ${child.lastName}`, roomName(data, child.classroomId), immunizationsOk ? 'Complete' : 'Incomplete', contactsOk ? 'On file' : 'Missing', physicalOk ? fmtDate(child.medical!.lastPhysical) : 'Missing', status.replace('_', ' ')]),
    footer: 'Confidential — store printed copies in a locked file per licensing requirements.',
  };
}

export function complianceSummaryReport(data: DashboardData): ReportTable {
  const openViolations = data.violations.filter(violation => violation.status === 'open').length;
  const overdueActions = data.correctiveActions.filter(action => action.status !== 'completed' && action.status !== 'verified' && daysUntil(action.dueDate) < 0).length;
  const staffIssues = staffComplianceRows(data).filter(row => row.status === 'action_needed').length;
  const childIssues = childComplianceRows(data).filter(row => row.status === 'action_needed').length;
  const overdueDrills = Object.keys(DRILL_CADENCE).filter(type => drillStatus(data, type).overdue).length;
  const checksNeedingAction = data.complianceChecks.filter(check => check.status !== 'compliant').length;
  const present = presentCountOn(data, todayIso());
  return {
    title: 'Licensing Compliance Summary', subtitle: `${data.center.name} · License ${data.center.license}`,
    columns: ['Area', 'Standing', 'Detail'],
    rows: [
      ['Inspections', data.inspections.some(inspection => inspection.status === 'failed') ? 'Attention' : 'Good', `Last result: ${data.inspections[0] ? `${INSPECTION_TYPE_LABEL[data.inspections[0].type]} — ${data.inspections[0].status}` : 'none on record'}`],
      ['Violations', openViolations ? 'Attention' : 'Clear', `${openViolations} open of ${data.violations.length} cited`],
      ['Corrective actions', overdueActions ? 'Overdue' : 'On track', `${overdueActions} past due`],
      ['Complaints', data.complaints.some(complaint => complaint.status === 'open' || complaint.status === 'investigating') ? 'In progress' : 'Clear', `${data.complaints.length} on record`],
      ['Staff compliance', staffIssues ? 'Attention' : 'Compliant', `${staffIssues} team members with expired credentials`],
      ['Child files', childIssues ? 'Attention' : 'Compliant', `${childIssues} files incomplete`],
      ['Ratios today', 'In ratio', `${present} children present across ${data.classrooms.length} classrooms`],
      ['Emergency drills', overdueDrills ? 'Overdue' : 'Current', `${overdueDrills} drill types past due`],
      ['Monitoring & health checks', checksNeedingAction ? 'Attention' : 'Compliant', `${checksNeedingAction} checklist items need action`],
    ],
    footer: `Generated ${fmtDate(todayIso())} for licensing and board review.`,
  };
}
