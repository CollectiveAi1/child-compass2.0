import { useRef, useState, type ReactNode } from 'react';
import { Download, FileText, FolderOpen, Printer, Trash2, Upload } from 'lucide-react';
import type { DashboardData, DocumentCategory } from '@compass/shared';
import { DOCUMENT_CATEGORIES } from '@compass/shared';
import { Button, Modal } from '../../components/ui';
import { useDeleteDocument, useUploadDocument } from '../../hooks/useCompass';
import { getDocumentFile } from '../../lib/api';
import { useSession } from '../../lib/session';
import { downloadCsv, formatBytes, printReport, readFileAsDataUrl, triggerDownload, type ReportTable } from '../../lib/reports';
import { fmtDateTime } from './common';

const label = (category: string) => category[0]!.toUpperCase() + category.slice(1);

// Shared file cabinet: category-tagged upload, download, and delete. Used by
// the Reports tab (all categories) and Licensing Compliance forms (licensing).
export function DocumentVault({ data, categories = DOCUMENT_CATEGORIES, defaultCategory = 'other', title = 'Document Vault', subtitle = 'Upload, store, and share center files — forms, records, licenses, and curriculum resources.', headerExtra }: {
  data: DashboardData; categories?: DocumentCategory[]; defaultCategory?: DocumentCategory; title?: string; subtitle?: string; headerExtra?: ReactNode;
}) {
  const token = useSession(state => state.token)!;
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(defaultCategory);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();

  const scoped = data.documents.filter(document => categories.includes(document.category));
  const documents = scoped.filter(document => categoryFilter === 'all' || document.category === categoryFilter);

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

  return <article className="panel document-vault">
    <header>
      <div><h2><FolderOpen size={19} className="head-icon"/> {title}</h2><p>{subtitle}</p></div>
      <div className="vault-upload">
        {headerExtra}
        <select value={uploadCategory} aria-label="Upload category" onChange={event => setUploadCategory(event.target.value as DocumentCategory)}>{categories.map(category => <option key={category} value={category}>{label(category)}</option>)}</select>
        <Button className="button-primary" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload size={16}/> {upload.isPending ? 'Uploading…' : 'Upload file'}</Button>
        <input ref={fileInput} type="file" hidden aria-label="Upload document" onChange={event => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ''; }}/>
      </div>
    </header>
    {uploadError ? <p className="form-error">{uploadError}</p> : null}
    {categories.length > 1 ? <div className="filter-chips">
      <button className={categoryFilter === 'all' ? 'active' : ''} onClick={() => setCategoryFilter('all')}>All ({scoped.length})</button>
      {categories.map(category => { const count = scoped.filter(document => document.category === category).length; return count ? <button key={category} className={categoryFilter === category ? 'active' : ''} onClick={() => setCategoryFilter(category)}>{label(category)} ({count})</button> : null; })}
    </div> : null}
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
  </article>;
}

// Shared report preview with print / CSV actions.
export function ReportPreviewModal({ table, centerName, onClose }: { table: ReportTable; centerName: string; onClose: () => void }) {
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
