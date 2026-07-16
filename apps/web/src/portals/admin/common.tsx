import type { ReactNode } from 'react';
import type { DashboardData } from '@compass/shared';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
export const fmtShortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export const roomName = (data: DashboardData, id: string) => data.classrooms.find(room => room.id === id)?.name ?? '—';

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(`${iso.slice(0, 10)}T12:00:00`).getTime() - Date.now()) / 86_400_000);
}

export function presentCountOn(data: DashboardData, date: string): number {
  return data.attendanceLog.filter(entry => entry.date === date && entry.status === 'present').length;
}

// Recent weekday history (from the log) plus today, oldest first — feeds the
// dashboard chart and the weekly attendance report.
export function attendanceWeek(data: DashboardData): { date: string; present: number; absent: number }[] {
  const dates = [...new Set(data.attendanceLog.map(entry => entry.date))].sort();
  if (!dates.includes(todayIso())) dates.push(todayIso());
  return dates.slice(-6).map(date => {
    const present = presentCountOn(data, date);
    return { date, present, absent: Math.max(data.children.length - present, 0) };
  });
}

export type StatTone = 'blue' | 'teal' | 'red' | 'green' | 'amber' | 'purple';

export function StatCard({ icon, tone, label, value, sub, subTone, onClick, actionLabel }: { icon: ReactNode; tone: StatTone; label: string; value: ReactNode; sub?: ReactNode; subTone?: 'positive' | 'negative' | 'link' | 'muted'; onClick?: () => void; actionLabel?: string }) {
  const body = <>
    <span className={`stat-chip tone-${tone}`}>{icon}</span>
    <div className="stat-copy">
      <p>{label}</p>
      <h2>{value}</h2>
      {actionLabel ? <small className="sub-link">{actionLabel}</small> : sub ? <small className={`sub-${subTone ?? 'muted'}`}>{sub}</small> : null}
    </div>
  </>;
  return onClick
    ? <button type="button" className="stat-card stat-card-action" onClick={onClick}>{body}</button>
    : <article className="stat-card">{body}</article>;
}

export function SectionHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="section-head"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{children ? <div className="section-head-actions">{children}</div> : null}</div>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="empty-note">{children}</p>;
}
