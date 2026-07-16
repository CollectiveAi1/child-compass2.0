import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, CheckCircle2, Clock3, Download, FilePlus2, HandCoins, Printer } from 'lucide-react';
import type { DashboardData, Invoice } from '@compass/shared';
import { formatMoney } from '@compass/shared';
import { Avatar, Button, Modal } from '../../components/ui';
import { useCreateInvoice, useRecordPayment } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { financialReport } from './reportDefs';
import { fmtShortDate, SectionHead, StatCard, todayIso } from './common';

function NewInvoiceModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const create = useCreateInvoice();
  const [form, setForm] = useState({ childId: data.children[0]?.id ?? '', description: '', amount: '', dueDate: todayIso() });
  return <Modal title="New invoice" eyebrow="Family billing" onClose={onClose}>
    <form className="stacked-form" onSubmit={async event => {
      event.preventDefault();
      await create.mutateAsync({ childId: form.childId, description: form.description, amount: Math.round(Number(form.amount) * 100), dueDate: form.dueDate });
      onClose();
    }}>
      <label>Child<select value={form.childId} onChange={event => setForm({ ...form, childId: event.target.value })}>{data.children.map(child => <option key={child.id} value={child.id}>{child.firstName} {child.lastName}</option>)}</select></label>
      <label>Description<input required maxLength={120} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="August tuition"/></label>
      <div className="form-row">
        <label>Amount (USD)<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="1240.00"/></label>
        <label>Due date<input type="date" required value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })}/></label>
      </div>
      <div className="modal-actions"><Button type="button" className="button-ghost" onClick={onClose}>Cancel</Button><Button className="button-primary" disabled={create.isPending || !Number(form.amount)}>{create.isPending ? 'Creating…' : 'Create invoice'}</Button></div>
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

  return <>
    <SectionHead title="Billing & Payments" subtitle="Tuition, fees, and family account health.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print report</Button>
      <Button className="button-soft" onClick={() => downloadCsv('financial-report', report())}><Download size={16}/> CSV</Button>
      <Button className="button-primary" onClick={() => setCreating(true)}><FilePlus2 size={16}/> New invoice</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<BadgeDollarSign/>} tone="green" label="Collected" value={formatMoney(data.stats.revenueCollected)} sub="Payments received"/>
      <StatCard icon={<Clock3/>} tone="amber" label="Outstanding" value={formatMoney(data.stats.revenueOutstanding)} sub={`${unpaid.length} open ${unpaid.length === 1 ? 'invoice' : 'invoices'}`}/>
      <StatCard icon={<AlertTriangle/>} tone="red" label="Overdue" value={overdue.length} sub={overdue.length ? formatMoney(overdue.reduce((sum, invoice) => sum + invoice.amount, 0)) : 'Nothing overdue'}/>
      <StatCard icon={<CheckCircle2/>} tone="teal" label="Collection Rate" value={`${Math.round((data.stats.revenueCollected / Math.max(data.stats.revenueCollected + data.stats.revenueOutstanding, 1)) * 100)}%`} sub="Of billed revenue"/>
    </section>

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
  </>;
}
