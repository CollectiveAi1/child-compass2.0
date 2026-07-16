import { useRef, useState } from 'react';
import { BookOpen, Check, Download, FileText, Printer, Trash2, Upload } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { Button } from '../../components/ui';
import { useDeleteDocument, useUploadDocument } from '../../hooks/useCompass';
import { getDocumentFile } from '../../lib/api';
import { useSession } from '../../lib/session';
import { downloadCsv, formatBytes, printReport, readFileAsDataUrl, triggerDownload } from '../../lib/reports';
import { fmtDateTime, roomName, SectionHead } from './common';

export function CurriculumTab({ data }: { data: DashboardData }) {
  const token = useSession(state => state.token)!;
  const [roomId, setRoomId] = useState(data.curriculum[0]?.classroomId ?? data.classrooms[0]?.id ?? '');
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const plan = data.curriculum.find(item => item.classroomId === roomId) ?? data.curriculum[0];
  const documents = data.documents.filter(document => document.category === 'curriculum');

  const printPlan = () => {
    if (!plan) return;
    printReport({
      title: `Lesson Plan — ${plan.theme}`, subtitle: `${roomName(data, plan.classroomId)} · ${fmtDateTime(plan.date)}`,
      columns: ['Time', 'Activity', 'Details'],
      rows: plan.schedule.map(item => [item.time, item.title, item.detail]),
      footer: `Goal: ${plan.goal} · Materials: ${plan.materials.join(', ')}`,
    }, data.center.name);
  };

  const handleUpload = async (file: File) => {
    setUploadError('');
    if (file.size > 3 * 1024 * 1024) { setUploadError('Files up to 3 MB are supported.'); return; }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await upload.mutateAsync({ name: file.name, category: 'curriculum', contentType: file.type || 'application/octet-stream', size: file.size, dataUrl });
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Upload failed.'); }
  };

  const download = async (documentId: string, name: string) => {
    const file = await getDocumentFile(documentId, token);
    triggerDownload(file.dataUrl, name);
  };

  return <>
    <SectionHead title="Curriculum" subtitle="Weekly themes, daily rhythms, and shared teaching resources.">
      <Button className="button-soft" onClick={printPlan}><Printer size={16}/> Print plan</Button>
      {plan ? <Button className="button-soft" onClick={() => downloadCsv(`lesson-plan-${plan.classroomId}`, { title: plan.theme, columns: ['Time', 'Activity', 'Details'], rows: plan.schedule.map(item => [item.time, item.title, item.detail]) })}><Download size={16}/> CSV</Button> : null}
    </SectionHead>

    <div className="filter-chips room-tabs">{data.classrooms.map(room => <button key={room.id} className={roomId === room.id ? 'active' : ''} onClick={() => setRoomId(room.id)}><i style={{ background: room.color }}/>{room.name}</button>)}</div>

    {plan ? <section className="curriculum-admin-grid">
      <article className="panel curriculum-theme-card">
        <p className="eyebrow">{roomName(data, plan.classroomId)} · This week</p>
        <h2><BookOpen size={20} className="head-icon"/> {plan.theme}</h2>
        <p className="theme-goal">{plan.goal}</p>
        <h3>Materials basket</h3>
        <ul className="material-list">{plan.materials.map(item => <li key={item}><Check/>{item}</li>)}</ul>
      </article>
      <article className="panel">
        <header><h2>Day rhythm</h2></header>
        <div className="schedule-full">{plan.schedule.map(item => <div key={item.time}><time>{item.time}</time><i/><span><b>{item.title}</b><p>{item.detail}</p></span></div>)}</div>
      </article>
      <article className="panel documents-card">
        <header><h2>Teaching resources</h2><Button className="button-teal button-compact" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload size={14}/> {upload.isPending ? 'Uploading…' : 'Upload'}</Button></header>
        <input ref={fileInput} type="file" hidden aria-label="Upload curriculum document" onChange={event => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ''; }}/>
        {uploadError ? <p className="form-error">{uploadError}</p> : null}
        {documents.length ? documents.map(document => <div className="document-row" key={document.id}>
          <span className="doc-icon"><FileText/></span>
          <div><b>{document.name}</b><small>{formatBytes(document.size)} · {document.uploadedBy} · {fmtDateTime(document.uploadedAt)}</small></div>
          <div className="row-actions">
            <Button className="button-soft button-compact" onClick={() => void download(document.id, document.name)}><Download size={14}/></Button>
            <Button className="button-ghost button-compact" aria-label={`Delete ${document.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ documentId: document.id })}><Trash2 size={14}/></Button>
          </div>
        </div>) : <p className="empty-note">No curriculum documents yet — upload the first one.</p>}
      </article>
    </section> : <p className="empty-note">No curriculum plan found for this classroom yet.</p>}
  </>;
}
