import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, CheckCircle2, Clock3, Download, FilePlus2, HandCoins, Pencil, Plus, Printer, RefreshCw, School } from 'lucide-react';
import type { Classroom, DashboardData, Invoice, TuitionRates } from '@compass/shared';
import { formatMoney, weekMondayOf } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useAddClassroom, useCreateInvoice, useRecordPayment, useRunWeeklyBilling, useUpdateCenter, useUpdateClassroom } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { financialReport } from './reportDefs';
import { fmtShortDate, roomName, SectionHead, StatCard, todayIso } from './common';

const RATE_FIELDS: { key: keyof TuitionRates; label: string }[] = [
  { key: 'registrationFee', label: 'Registration fee' },
  { key: 'weeklyTuition', label: 'Weekly tuition' },
  { key: 'lateFee', label: 'Late fee' },
  { key: 'miscFee', label: 'Miscellaneous fee' },
];

const dollars = (cents: number) => (cents / 100).toFixed(2);
const cents = (value: string) => Math.round((Number(value) || 0) * 100);

function RateInputs({ rates, onChange }: { rates: Record<keyof TuitionRates, string>; onChange: (key: keyof TuitionRates, value: string) => void }) {
  return <div className="form-row">
    {RATE_FIELDS.map(({ key, label }) => <label key={key}>{label} (USD)<input type="number" min="0" step="0.01" required value={rates[key]} onChange={event => onChange(key, event.target.value)}/></label>)}
  </div>;
}

// One modal covers both jobs: edit a classroom's saved rates, or set up a new
// classroom whose rates immediately drive its tuition billing.
function ClassroomModal({ room, onClose }: { room?: Classroom; onClose: () => void }) {
  const create = useAddClassroom();
  const update = useUpdateClassroom();
  const [form, setForm] = useState({ name: room?.name ?? '', ageRange: room?.ageRange ?? '', capacity: String(room?.capacity ?? 12), ratioLimit: String(room?.ratioLimit ?? 6) });
  const [rates, setRates] = useState<Record<keyof TuitionRates, string>>({
    registrationFee: dollars(room?.rates.registrationFee ?? 15000), weeklyTuition: dollars(room?.rates.weeklyTuition ?? 30000),
    lateFee: dollars(room?.rates.lateFee ?? 2500), miscFee: dollars(room?.rates.miscFee ?? 1500),
  });
  const busy = create.isPending || update.isPending;
  return <Modal title={room ? `${room.name} — rates & details` : 'Set up a classroom'} eyebrow="Classrooms & tuition rates" onClose={onClose} wide>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      const payload = { name: form.name, ageRange: form.ageRange, capacity: Number(form.capacity) || 1, ratioLimit: Number(form.ratioLimit) || 1, rates: { registrationFee: cents(rates.registrationFee), weeklyTuition: cents(rates.weeklyTuition), lateFee: cents(rates.lateFee), miscFee: cents(rates.miscFee) } };
      if (room) await update.mutateAsync({ classroomId: room.id, ...payload });
      else await create.mutateAsync(payload);
      onClose();
    }}>
      <div className="form-row">
        <label>Classroom name<input required maxLength={60} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Sunbeam Studio"/></label>
        <label>Age group<input required maxLength={40} value={form.ageRange} onChange={event => setForm({ ...form, ageRange: event.target.value })} placeholder="2–3 years"/></label>
      </div>
      <div className="form-row">
        <label>Capacity<input type="number" min={1} max={100} value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })}/></label>
        <label>Ratio limit (1 teacher per)<input type="number" min={1} max={30} value={form.ratioLimit} onChange={event => setForm({ ...form, ratioLimit: event.target.value })}/></label>
      </div>
      <fieldset className="mini-fieldset"><legend>Fee schedule</legend>
        <RateInputs rates={rates} onChange={(key, value) => setRates({ ...rates, [key]: value })}/>
        <p className="empty-note">Weekly tuition powers recurring billing. The other fees auto-fill one-off invoices.</p>
      </fieldset>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={busy || !form.name || !form.ageRange}>{busy ? 'Saving…' : room ? 'Save rates' : 'Add classroom'}</Button></div>
    </form>
  </Modal>;
}

// New invoice with fee-type auto-fill: pick a child and a fee type and the
// amount + description come from that child's classroom rate schedule.
function NewInvoiceModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const createInvoice = useCreateInvoice();
  const [childId, setChildId] = useState(data.children[0]?.id ?? '');
  const [feeType, setFeeType] = useState<'weeklyTuition' | 'registrationFee' | 'lateFee' | 'miscFee' | 'custom'>('weeklyTuition');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [touched, setTouched] = useState(false);

  const child = data.children.find(item => item.id === childId);
  const room = data.classrooms.find(item => item.id === child?.classroomId);

  useEffect(() => {
    if (!room || feeType === 'custom' || touched) return;
    const labels = { weeklyTuition: `Weekly tuition — ${room.name}`, registrationFee: `Registration fee — ${room.name}`, lateFee: 'Late pickup fee', miscFee: 'Miscellaneous fee' } as const;
    setDescription(labels[feeType]);
    setAmount(dollars(room.rates[feeType]));
  }, [room, feeType, touched]);

  return <Modal title="New invoice" eyebrow="Family billing" onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await createInvoice.mutateAsync({ childId, description, amount: cents(amount), dueDate });
      onClose();
    }}>
      <div className="form-row">
        <label>Child<select value={childId} onChange={event => { setChildId(event.target.value); setTouched(false); }}>{data.children.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {roomName(data, item.classroomId)}</option>)}</select></label>
        <label>Fee type<select value={feeType} onChange={event => { setFeeType(event.target.value as 'custom'); setTouched(false); }}>
          <option value="weeklyTuition">Weekly tuition (from classroom rate)</option>
          <option value="registrationFee">Registration fee (from classroom rate)</option>
          <option value="lateFee">Late fee (from classroom rate)</option>
          <option value="miscFee">Miscellaneous fee (from classroom rate)</option>
          <option value="custom">Custom charge</option>
        </select></label>
      </div>
      <label>Description<input required maxLength={120} value={description} onChange={event => { setDescription(event.target.value); setTouched(true); }} placeholder="August tuition"/></label>
      <div className="form-row">
        <label>Amount (USD)<input type="number" min="0.01" step="0.01" required value={amount} onChange={event => { setAmount(event.target.value); setTouched(true); }}/></label>
        <label>Due date<input type="date" required value={dueDate} onChange={event => setDueDate(event.target.value)}/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={createInvoice.isPending || !Number(amount)}>{createInvoice.isPending ? 'Creating…' : 'Create invoice'}</Button></div>
    </form>
  </Modal>;
}

function RecordPaymentModal({ invoice, childName, onClose }: { invoice: Invoice; childName: string; onClose: () => void }) {
  const record = useRecordPayment();
  const [method, setMethod] = useState('Card on file');
  return <Modal title="Record payment" eyebrow={childName} onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => { event.preventDefault(); await record.mutateAsync({ invoiceId: invoice.id, method }); onClose(); }}>
      <div className="payment-summary"><p>{invoice.description}</p><h2>{formatMoney(invoice.amount)}</h2><small>Due {fmtShortDate(invoice.dueDate)}</small></div>
      <label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}>
        <option>Card on file</option><option>ACH transfer</option><option>Check</option><option>Cash</option><option>Subsidy / voucher</option>
      </select></label>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-teal" disabled={record.isPending}>{record.isPending ? 'Recording…' : 'Mark as paid'}</Button></div>
    </form>
  </Modal>;
}

export function BillingTab({ data, openRecord, onRecordHandled }: { data: DashboardData; openRecord?: boolean; onRecordHandled: () => void }) {
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState<Invoice | null>(null);
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const runWeekly = useRunWeeklyBilling();
  const updateCenter = useUpdateCenter();

  const unpaid = data.invoices.filter(invoice => invoice.status !== 'paid');
  const overdue = data.invoices.filter(invoice => invoice.status === 'overdue');
  useEffect(() => {
    if (openRecord) {
      setRecording(data.invoices.find(invoice => invoice.status !== 'paid') ?? null);
      onRecordHandled();
    }
  }, [openRecord, onRecordHandled, data.invoices]);
  const report = () => financialReport(data);
  const childFor = (invoice: Invoice) => data.children.find(child => child.id === invoice.childId);

  const week = weekMondayOf();
  const weekLabel = new Date(`${week}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const billedThisWeek = data.children.filter(child => data.invoices.some(invoice => invoice.childId === child.id && invoice.description.startsWith('Weekly tuition') && invoice.description.includes(`week of ${weekLabel}`))).length;
  const weeklyTotal = data.children.reduce((sum, child) => sum + (data.classrooms.find(room => room.id === child.classroomId)?.rates.weeklyTuition ?? 0), 0);

  return <>
    <SectionHead title="Billing & Payments" subtitle="Tuition rates by classroom, recurring weekly billing, and family accounts.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print report</Button>
      <Button className="button-soft" onClick={() => downloadCsv('financial-report', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setCreating(true)}><FilePlus2 size={16}/> New invoice</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<BadgeDollarSign/>} tone="green" label="Collected" value={formatMoney(data.stats.revenueCollected)} sub="Payments received"/>
      <StatCard icon={<Clock3/>} tone="amber" label="Outstanding" value={formatMoney(data.stats.revenueOutstanding)} sub={`${unpaid.length} open ${unpaid.length === 1 ? 'invoice' : 'invoices'}`}/>
      <StatCard icon={<AlertTriangle/>} tone="red" label="Overdue" value={overdue.length} sub={overdue.length ? formatMoney(overdue.reduce((sum, invoice) => sum + invoice.amount, 0)) : 'Nothing overdue'}/>
      <StatCard icon={<CheckCircle2/>} tone="teal" label="Weekly Tuition Value" value={formatMoney(weeklyTotal)} sub={`Across ${data.children.length} enrolled children`}/>
    </section>

    <article className="panel table-panel">
      <header>
        <div><h2><School size={18} className="head-icon"/> Tuition rates by classroom</h2><p>Each classroom keeps its own fee schedule — edit anytime and future billing follows the new rates.</p></div>
        <Button className="button-primary" onClick={() => setAddingRoom(true)}><Plus size={16}/> Add classroom</Button>
      </header>
      <div className="rate-grid">
        {data.classrooms.map(room => {
          const enrolled = data.children.filter(child => child.classroomId === room.id).length;
          return <article className="rate-card" key={room.id}>
            <header><span className="room-swatch" style={{ background: room.color }}>✦</span><div><h3>{room.name}</h3><small>{room.ageRange} · {enrolled} enrolled</small></div></header>
            <dl>{RATE_FIELDS.map(({ key, label }) => <div key={key} className={key === 'weeklyTuition' ? 'rate-primary' : ''}><dt>{label}{key === 'weeklyTuition' ? ' (recurring)' : ''}</dt><dd>{formatMoney(room.rates[key])}</dd></div>)}</dl>
            <Button className="button-soft button-compact" onClick={() => setEditingRoom(room)}><Pencil size={14}/> Edit rates</Button>
          </article>;
        })}
      </div>
    </article>

    <article className="panel table-panel recurring-panel">
      <header>
        <div><h2><RefreshCw size={18} className="head-icon"/> Recurring weekly tuition</h2><p>Week of {weekLabel}: <b>{billedThisWeek} of {data.children.length}</b> children invoiced from their classroom's weekly rate.</p></div>
        <div className="row-actions">
          <label className="toggle-chip">
            <input type="checkbox" checked={data.center.autoWeeklyBilling} disabled={updateCenter.isPending} onChange={event => updateCenter.mutate({ autoWeeklyBilling: event.target.checked })}/>
            <span>Auto-generate every week</span>
          </label>
          <Button className="button-teal" disabled={runWeekly.isPending} onClick={async () => { const result = await runWeekly.mutateAsync({}); setLastRun((result as { created: number }).created); }}>
            <RefreshCw size={15}/> {runWeekly.isPending ? 'Generating…' : 'Generate this week now'}
          </Button>
        </div>
      </header>
      <div className="recurring-progress"><i style={{ width: `${Math.round((billedThisWeek / Math.max(data.children.length, 1)) * 100)}%` }}/></div>
      <p className="empty-note">{lastRun !== null ? `${lastRun} new ${lastRun === 1 ? 'invoice' : 'invoices'} generated just now. ` : ''}{data.center.autoWeeklyBilling ? 'Auto-billing is on — each week’s tuition invoices appear on their own and land in every family’s account.' : 'Auto-billing is off — use the button to generate the current week whenever you’re ready.'}</p>
    </article>

    <article className="panel table-panel">
      <header><h2>Family invoices</h2><span className="muted-count">{data.invoices.length} invoices</span></header>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Family</th><th>Description</th><th>Due date</th><th>Amount</th><th>Status</th><th>Paid via</th><th>Action</th></tr></thead>
          <tbody>{data.invoices.map(invoice => { const child = childFor(invoice); return <tr key={invoice.id}>
            <td><span className="cell-person"><Avatar label={child ? `${child.firstName} ${child.lastName}` : 'Family'} tone={child?.avatar} size="sm"/><b>{child ? `${child.firstName} ${child.lastName}` : '—'}</b></span></td>
            <td>{invoice.description}</td>
            <td>{fmtShortDate(invoice.dueDate)}</td>
            <td><strong>{formatMoney(invoice.amount)}</strong></td>
            <td><span className={`invoice-status ${invoice.status}`}>{invoice.status}</span></td>
            <td>{invoice.method ?? '—'}</td>
            <td>{invoice.status !== 'paid' ? <Button className="button-teal button-compact" onClick={() => setRecording(invoice)}><HandCoins size={14}/> Record payment</Button> : <span className="muted-count">Settled</span>}</td>
          </tr>; })}</tbody>
        </table>
      </div>
    </article>

    {creating ? <NewInvoiceModal data={data} onClose={() => setCreating(false)}/> : null}
    {recording ? <RecordPaymentModal invoice={recording} childName={(() => { const child = childFor(recording); return child ? `${child.firstName} ${child.lastName}` : 'Family'; })()} onClose={() => setRecording(null)}/> : null}
    {editingRoom ? <ClassroomModal room={editingRoom} onClose={() => setEditingRoom(null)}/> : null}
    {addingRoom ? <ClassroomModal onClose={() => setAddingRoom(false)}/> : null}
  </>;
}
