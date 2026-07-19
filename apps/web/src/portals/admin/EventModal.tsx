import { useState } from 'react';
import { Button, Modal } from '../../components/ui';
import { useAddEvent } from '../../hooks/useCompass';
import { todayIso } from './common';

export function EventModal({ onClose, eyebrow = 'Center calendar' }: { onClose: () => void; eyebrow?: string }) {
  const addEvent = useAddEvent();
  const [form, setForm] = useState({ title: '', date: todayIso(), time: '', detail: '', attendees: '' });
  return <Modal title="Add event" eyebrow={eyebrow} onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await addEvent.mutateAsync({ title: form.title, date: form.date, time: form.time || undefined, detail: form.detail || undefined, attendees: form.attendees ? Number(form.attendees) : undefined });
      onClose();
    }}>
      <label>Event title<input required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Family Picnic Friday"/></label>
      <div className="form-row">
        <label>Date<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label>
        <label>Time (optional)<input value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} placeholder="9:00 AM – 1:00 PM"/></label>
      </div>
      <div className="form-row">
        <label>Details (optional)<input maxLength={300} value={form.detail} onChange={event => setForm({ ...form, detail: event.target.value })} placeholder="What the team should know"/></label>
        <label>Expected attendees<input type="number" min={0} value={form.attendees} onChange={event => setForm({ ...form, attendees: event.target.value })}/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={!form.title || addEvent.isPending}>{addEvent.isPending ? 'Saving…' : 'Add event'}</Button></div>
    </form>
  </Modal>;
}
