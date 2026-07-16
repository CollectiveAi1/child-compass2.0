import { useState } from 'react';
import { Building2, CheckCircle2, Save, ShieldCheck, Users } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { Button } from '../../components/ui';
import { useUpdateCenter } from '../../hooks/useCompass';
import { SectionHead, StatCard } from './common';

export function SettingsTab({ data }: { data: DashboardData }) {
  const update = useUpdateCenter();
  const [form, setForm] = useState({ name: data.center.name, address: data.center.address, phone: data.center.phone, license: data.center.license, capacity: String(data.center.capacity) });
  const [saved, setSaved] = useState(false);

  return <>
    <SectionHead title="Settings" subtitle="Your center profile, license, and classroom setup."/>
    <section className="stat-grid stat-grid-4">
      <StatCard icon={<Building2/>} tone="blue" label="Licensed Capacity" value={data.center.capacity} sub={`${data.children.length} currently enrolled`}/>
      <StatCard icon={<Users/>} tone="teal" label="Classrooms" value={data.classrooms.length} sub={data.classrooms.map(room => room.name).join(' · ')}/>
      <StatCard icon={<ShieldCheck/>} tone="green" label="License" value={data.center.license} sub="Ohio Early Learning Center"/>
      <StatCard icon={<Users/>} tone="purple" label="Team" value={data.staff.length} sub="Active staff accounts"/>
    </section>

    <section className="settings-grid">
      <article className="panel settings-form-panel">
        <header><h2>Center profile</h2>{saved ? <span className="saved-flash"><CheckCircle2 size={15}/> Saved</span> : null}</header>
        <form className="stacked-form" onSubmit={async event => {
          event.preventDefault();
          await update.mutateAsync({ name: form.name, address: form.address, phone: form.phone, license: form.license, capacity: Number(form.capacity) || data.center.capacity });
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}>
          <label>Center name<input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
          <label>Address<input maxLength={160} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })}/></label>
          <div className="form-row">
            <label>Phone<input maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
            <label>License number<input maxLength={40} value={form.license} onChange={event => setForm({ ...form, license: event.target.value })}/></label>
          </div>
          <label>Licensed capacity<input type="number" min={1} max={500} value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })}/></label>
          <div className="modal-actions"><Button className="button-primary" disabled={update.isPending}><Save size={15}/> {update.isPending ? 'Saving…' : 'Save changes'}</Button></div>
        </form>
      </article>
      <article className="panel">
        <header><h2>Classrooms</h2></header>
        <div className="room-summary-list">{data.classrooms.map(room => {
          const enrolled = data.children.filter(child => child.classroomId === room.id).length;
          return <div key={room.id} className="room-summary">
            <span className="room-swatch" style={{ background: room.color }}>✦</span>
            <div><b>{room.name}</b><small>{room.ageRange} · ratio 1:{room.ratioLimit}</small></div>
            <div className="room-fill"><b>{enrolled} / {room.capacity}</b><small>enrolled</small></div>
          </div>;
        })}</div>
        <p className="empty-note">Demo data resets when the server restarts. Connect a database before storing real center records.</p>
      </article>
    </section>
  </>;
}
