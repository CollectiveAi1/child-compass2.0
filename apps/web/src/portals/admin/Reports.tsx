import { useRef, useState } from 'react';
import { CalendarCheck, CalendarRange, Download, Eye, FileHeart, FileText, FolderOpen, GraduationCap, HandCoins, Printer, Trash2, Upload, UserPlus, Users, UtensilsCrossed } from 'lucide-react';
import type { DashboardData, DocumentCategory } from '@compass/shared';
import { DOCUMENT_CATEGORIES } from '@compass/shared';
import { Button, Modal } from '../../components/ui';
import { useDeleteDocument, useUploadDocument } from '../../hooks/useCompass';
import { getDocumentFile } from '../../lib/api';
import { useSession } from '../../lib/session';
import { downloadCsv, formatBytes, printReport, readFileAsDataUrl, triggerDownload, type ReportTable } from '../../lib/reports';
import { cacfpReport, dailyAttendanceReport, enrollmentReport, financialReport, medicalReport, rosterReport, staffReport, weeklyAttendanceReport } from './reportDefs';
import { fmtDateTime, SectionHead, todayIso } from './common';

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

function PreviewModal({ table, centerName, onClose }: { table: ReportTable; centerName: string; onClose: () => void }) {
  return <Modal title={table.title} eyebrow={table.subtitle ?? 'Report preview'} onClose={onClose} wide>
    <div className="table-scroll preview-scroll">
      <table className="data-table preview-table">
        <thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {table.footer ? <p className="empty-note">{table.footer}</p> : null}
    <div className="modal-actions">
      <Button className="button-soft" onClick={() => printReport(table, centerName)}><Printer size={16}/> Print / Save PDF</Button>
      <Button className="button-primary" onClick={() => downloadCsv(table.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), table)}><Download size={16}/> Download CSV</Button>
    </div>
  </Modal>;
}

export function ReportsTab({ data }: { data: DashboardData }) {
  const token = useSession(state => state.token)!;
  const [date, setDate] = useState(todayIso());
  const [preview, setPreview] = useState<ReportTable | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('other');
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();

  const documents = data.documents.filter(document => categoryFilter === 'all' || document.category === categoryFilter);

  const handleUpload = async (file: File) => {
    setUploadError('');
    if (file.size > 3 * 1024 * 1024) { setUploadError('Files up to 3 MB are supported in the demo.'); return; }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await upload.mutateAsync({ name: file.name, category: uploadCategory, contentType: file.type || 'application/octet-stream', size: file.size, dataUrl });
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Upload failed.'); }
  };

  const download = async (documentId: string, name: string) => {
    const file = await getDocumentFile(documentId, token);
    triggerDownload(file.dataUrl, name);
  };

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

    <article className="panel document-vault">
      <header>
        <div><h2><FolderOpen size={19} className="head-icon"/> Document Vault</h2><p>Upload, store, and share center files — forms, records, licenses, and curriculum resources.</p></div>
        <div className="vault-upload">
          <select value={uploadCategory} aria-label="Upload category" onChange={event => setUploadCategory(event.target.value as DocumentCategory)}>{DOCUMENT_CATEGORIES.map(category => <option key={category} value={category}>{category[0]!.toUpperCase() + category.slice(1)}</option>)}</select>
          <Button className="button-primary" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload size={16}/> {upload.isPending ? 'Uploading…' : 'Upload file'}</Button>
          <input ref={fileInput} type="file" hidden aria-label="Upload document" onChange={event => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ''; }}/>
        </div>
      </header>
      {uploadError ? <p className="form-error">{uploadError}</p> : null}
      <div className="filter-chips">
        <button className={categoryFilter === 'all' ? 'active' : ''} onClick={() => setCategoryFilter('all')}>All ({data.documents.length})</button>
        {DOCUMENT_CATEGORIES.map(category => { const count = data.documents.filter(document => document.category === category).length; return count ? <button key={category} className={categoryFilter === category ? 'active' : ''} onClick={() => setCategoryFilter(category)}>{category[0]!.toUpperCase() + category.slice(1)} ({count})</button> : null; })}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Uploaded by</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>{documents.map(document => <tr key={document.id}>
            <td><span className="cell-person"><span className="doc-icon"><FileText size={16}/></span><b>{document.name}</b></span></td>
            <td className="capitalize">{document.category}</td>
            <td>{formatBytes(document.size)}</td>
            <td>{document.uploadedBy}</td>
            <td>{fmtDateTime(document.uploadedAt)}</td>
            <td><div className="row-actions">
              <Button className="button-soft button-compact" onClick={() => void download(document.id, document.name)}><Download size={14}/> Download</Button>
              <Button className="button-ghost button-compact" aria-label={`Delete ${document.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ documentId: document.id })}><Trash2 size={14}/></Button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {!documents.length ? <p className="empty-note">No documents in this category yet — upload the first one.</p> : null}
      </div>
    </article>

    {preview ? <PreviewModal table={preview} centerName={data.center.name} onClose={() => setPreview(null)}/> : null}
  </>;
}
