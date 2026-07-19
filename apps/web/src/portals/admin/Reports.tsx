import { useState } from 'react';
import { CalendarCheck, CalendarRange, Download, Eye, FileHeart, FileText, GraduationCap, HandCoins, Printer, UserPlus, Users, UtensilsCrossed } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { Button } from '../../components/ui';
import { downloadCsv, printReport, type ReportTable } from '../../lib/reports';
import { cacfpReport, dailyAttendanceReport, enrollmentReport, financialReport, medicalReport, rosterReport, staffReport, weeklyAttendanceReport } from './reportDefs';
import { DocumentVault, ReportPreviewModal } from './DocumentVault';
import { SectionHead, todayIso } from './common';

interface ReportDef {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
  tone: string;
  needsDate?: boolean;
  build: (data: DashboardData, date: string) => ReportTable;
}

const REPORTS: ReportDef[] = [
  { id: 'daily-attendance', name: 'Daily Attendance Sheet', description: 'Sign-in/out sheet with times and signature lines for any day.', icon: CalendarCheck, tone: 'teal', needsDate: true, build: (data, date) => dailyAttendanceReport(data, date) },
  { id: 'weekly-attendance', name: 'Weekly Attendance Summary', description: 'Per-child presence across the current week.', icon: CalendarRange, tone: 'blue', build: data => weeklyAttendanceReport(data) },
  { id: 'roster', name: 'Child Roster', description: 'Every enrolled child with guardian contacts and start dates.', icon: Users, tone: 'purple', build: data => rosterReport(data) },
  { id: 'medical', name: 'Medical Records Summary', description: 'Allergies, conditions, physicians, immunizations, and emergency contacts.', icon: FileHeart, tone: 'red', build: data => medicalReport(data) },
  { id: 'enrollment', name: 'Enrollment Applications', description: 'The full pipeline from inquiry to enrolled.', icon: UserPlus, tone: 'amber', build: data => enrollmentReport(data) },
  { id: 'staff', name: 'Staff Roster & Credentials', description: 'Team roster with credential expirations for licensing visits.', icon: GraduationCap, tone: 'green', build: data => staffReport(data) },
  { id: 'financial', name: 'Financial Report', description: 'All invoices with payment status, methods, and totals.', icon: HandCoins, tone: 'navy', build: data => financialReport(data) },
  { id: 'cacfp', name: 'CACFP Meal Counts', description: 'Daily meal counts formatted for food-program claims.', icon: UtensilsCrossed, tone: 'teal', build: data => cacfpReport(data) },
];

export function ReportsTab({ data }: { data: DashboardData }) {
  const [date, setDate] = useState(todayIso());
  const [preview, setPreview] = useState<ReportTable | null>(null);

  return <>
    <SectionHead title="Reports" subtitle="Print or download everything your center needs — attendance sheets, financials, medical records, and more.">
      <label className="date-chip"><input type="date" value={date} max={todayIso()} onChange={event => setDate(event.target.value || todayIso())} aria-label="Report date"/></label>
    </SectionHead>

    <section className="report-grid">{REPORTS.map(({ id, name, description, icon: Icon, tone, needsDate, build }) => <article className="panel report-card" key={id}>
      <span className={`report-icon tone-${tone}`}><Icon/></span>
      <h3>{name}</h3>
      <p>{description}{needsDate ? ` Uses the selected date (${new Date(`${date}T12:00:00`).toLocaleDateString()}).` : ''}</p>
      <div className="report-actions">
        <Button className="button-ghost button-compact" onClick={() => setPreview(build(data, date))}><Eye size={14}/> Preview</Button>
        <Button className="button-soft button-compact" onClick={() => printReport(build(data, date), data.center.name)}><Printer size={14}/> Print</Button>
        <Button className="button-teal button-compact" onClick={() => downloadCsv(id, build(data, date))}><Download size={14}/> CSV</Button>
      </div>
    </article>)}</section>

    <DocumentVault data={data}/>

    {preview ? <ReportPreviewModal table={preview} centerName={data.center.name} onClose={() => setPreview(null)}/> : null}
  </>;
}
