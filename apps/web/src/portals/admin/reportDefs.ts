import type { DashboardData } from '@compass/shared';
import { childAge, formatMoney } from '@compass/shared';
import type { ReportTable } from '../../lib/reports';
import { attendanceWeek, fmtDate, fmtTime, roomName } from './common';

// Every admin report is a plain table built from dashboard data, so a single
// pair of print/CSV helpers can output all of them.

export function dailyAttendanceReport(data: DashboardData, date: string): ReportTable {
  const rows = [...data.children]
    .sort((a, b) => roomName(data, a.classroomId).localeCompare(roomName(data, b.classroomId)) || a.lastName.localeCompare(b.lastName))
    .map(child => {
      const entry = data.attendanceLog.find(item => item.date === date && item.childId === child.id);
      return [`${child.firstName} ${child.lastName}`, roomName(data, child.classroomId), entry?.status === 'present' ? 'Present' : 'Absent', fmtTime(entry?.checkedInAt), fmtTime(entry?.checkedOutAt), ''];
    });
  const present = rows.filter(row => row[2] === 'Present').length;
  return {
    title: 'Daily Attendance Sheet', subtitle: fmtDate(date),
    columns: ['Child', 'Classroom', 'Status', 'Time in', 'Time out', 'Guardian signature'],
    rows, footer: `${present} of ${data.children.length} children present · Generated for licensing and CACFP records.`,
  };
}

export function weeklyAttendanceReport(data: DashboardData): ReportTable {
  const week = attendanceWeek(data);
  const rows = data.children.map(child => {
    const days = week.map(day => data.attendanceLog.some(entry => entry.date === day.date && entry.childId === child.id && entry.status === 'present') ? '✓' : '—');
    return [`${child.firstName} ${child.lastName}`, roomName(data, child.classroomId), ...days, days.filter(day => day === '✓').length];
  });
  return {
    title: 'Weekly Attendance Summary', subtitle: `${fmtDate(week[0]!.date)} – ${fmtDate(week[week.length - 1]!.date)}`,
    columns: ['Child', 'Classroom', ...week.map(day => new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' })), 'Days'],
    rows,
  };
}

export function rosterReport(data: DashboardData): ReportTable {
  return {
    title: 'Child Roster', subtitle: `${data.children.length} enrolled children`,
    columns: ['Child', 'Age', 'Birthday', 'Classroom', 'Guardian', 'Guardian phone', 'Enrolled'],
    rows: data.children.map(child => [`${child.firstName} ${child.lastName}`, childAge(child.birthday), fmtDate(child.birthday), roomName(data, child.classroomId), child.guardianName ?? '—', child.guardianPhone ?? '—', child.enrolledOn ? fmtDate(child.enrolledOn) : '—']),
  };
}

export function medicalReport(data: DashboardData): ReportTable {
  return {
    title: 'Medical Records Summary', subtitle: 'Allergies, conditions, physicians, and immunization status',
    columns: ['Child', 'Classroom', 'Allergies', 'Conditions', 'Medications', 'Physician', 'Immunizations', 'Emergency contact'],
    rows: data.children.map(child => {
      const medical = child.medical;
      const immunizations = medical?.immunizations.length ? medical.immunizations.map(shot => `${shot.name}: ${shot.status}`).join('; ') : 'No records on file';
      const contact = medical?.emergencyContacts[0];
      return [`${child.firstName} ${child.lastName}`, roomName(data, child.classroomId), child.allergies.join(', ') || 'None', medical?.conditions ?? '—', medical?.medications ?? '—', medical?.physician || '—', immunizations, contact ? `${contact.name} ${contact.phone}` : '—'];
    }),
    footer: 'Confidential — store printed copies in a locked file per licensing requirements.',
  };
}

export function enrollmentReport(data: DashboardData): ReportTable {
  return {
    title: 'Enrollment Applications', subtitle: `${data.enrollments.length} applications in the pipeline`,
    columns: ['Child', 'Birthday', 'Guardian', 'Email', 'Phone', 'Requested room', 'Requested start', 'Status', 'Notes'],
    rows: data.enrollments.map(application => [application.childName, fmtDate(application.birthday), application.guardianName, application.guardianEmail, application.guardianPhone, roomName(data, application.classroomId), fmtDate(application.requestedStart), application.status, application.notes]),
  };
}

export function staffReport(data: DashboardData): ReportTable {
  return {
    title: 'Staff Roster & Credentials', subtitle: `${data.staff.length} team members`,
    columns: ['Name', 'Title', 'Email', 'Phone', 'Classrooms', 'Hired', 'Credentials'],
    rows: data.staff.map(member => [member.name, member.title ?? '—', member.email, member.phone ?? '—', member.classroomIds.map(id => roomName(data, id)).join(', ') || 'All rooms', member.hiredOn ? fmtDate(member.hiredOn) : '—', (member.credentials ?? []).map(credential => `${credential.name} (exp ${fmtDate(credential.expires)})`).join('; ') || '—']),
  };
}

export function financialReport(data: DashboardData): ReportTable {
  const collected = data.invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const outstanding = data.invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  return {
    title: 'Financial Report — Tuition & Fees', subtitle: `Collected ${formatMoney(collected)} · Outstanding ${formatMoney(outstanding)}`,
    columns: ['Invoice', 'Child', 'Guardian', 'Description', 'Due date', 'Amount', 'Status', 'Paid', 'Method'],
    rows: data.invoices.map(invoice => {
      const child = data.children.find(item => item.id === invoice.childId);
      return [invoice.id, child ? `${child.firstName} ${child.lastName}` : '—', child?.guardianName ?? '—', invoice.description, fmtDate(invoice.dueDate), formatMoney(invoice.amount), invoice.status, invoice.paidAt ? fmtDate(invoice.paidAt) : '—', invoice.method ?? '—'];
    }),
  };
}

export function cacfpReport(data: DashboardData): ReportTable {
  const rows = [...data.meals]
    .sort((a, b) => a.date.localeCompare(b.date) || a.meal.localeCompare(b.meal))
    .map(record => [fmtDate(record.date), record.meal[0]!.toUpperCase() + record.meal.slice(1), record.childCount, record.adultCount, record.childCount + record.adultCount, record.recordedBy]);
  const totalMeals = data.meals.reduce((sum, record) => sum + record.childCount + record.adultCount, 0);
  return {
    title: 'CACFP Meal Count Report', subtitle: 'Child and Adult Care Food Program daily meal counts',
    columns: ['Date', 'Meal', 'Children', 'Adults', 'Total', 'Recorded by'],
    rows, footer: `${totalMeals} total meals recorded in this period.`,
  };
}
