import { useState } from 'react';
import { CheckCircle2, Coffee, Cookie, Download, Printer, RefreshCw, Save, UtensilsCrossed } from 'lucide-react';
import type { DashboardData, MealType } from '@compass/shared';
import { formatMoney } from '@compass/shared';
import { Button } from '../../components/ui';
import { useRecordMeal } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { cacfpReport } from './reportDefs';
import { daysUntil, fmtDate, fmtShortDate, SectionHead, StatCard, todayIso } from './common';

const MEALS: { id: MealType; label: string; icon: typeof Coffee }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee },
  { id: 'lunch', label: 'Lunch', icon: UtensilsCrossed },
  { id: 'snack', label: 'Snack', icon: Cookie },
];

function MealCard({ data, meal, label, icon: Icon }: { data: DashboardData; meal: MealType; label: string; icon: typeof Coffee }) {
  const record = useRecordMeal();
  const existing = data.meals.find(item => item.date === todayIso() && item.meal === meal);
  const presentNow = data.children.filter(child => child.attendanceStatus !== 'expected').length;
  const [editing, setEditing] = useState(false);
  const [children, setChildren] = useState(String(existing?.childCount ?? presentNow));
  const [adults, setAdults] = useState(String(existing?.adultCount ?? 4));
  return <article className={`panel meal-card ${existing ? 'recorded' : ''}`}>
    <header><span className="meal-icon"><Icon/></span><div><h3>{label}</h3><small>{existing ? `Recorded by ${existing.recordedBy}` : 'Not recorded yet'}</small></div>{existing ? <CheckCircle2 className="meal-check" size={19}/> : null}</header>
    {editing ? <form className="meal-form" onSubmit={async event => {
      event.preventDefault();
      await record.mutateAsync({ date: todayIso(), meal, childCount: Number(children) || 0, adultCount: Number(adults) || 0 });
      setEditing(false);
    }}>
      <label>Children<input type="number" min={0} max={500} value={children} onChange={event => setChildren(event.target.value)}/></label>
      <label>Adults<input type="number" min={0} max={100} value={adults} onChange={event => setAdults(event.target.value)}/></label>
      <Button className="button-teal button-compact" disabled={record.isPending}><Save size={14}/> {record.isPending ? 'Saving…' : 'Save'}</Button>
    </form> : <div className="meal-counts">
      <div><h2>{existing ? existing.childCount : '—'}</h2><small>Children</small></div>
      <div><h2>{existing ? existing.adultCount : '—'}</h2><small>Adults</small></div>
      <Button className={existing ? 'button-soft button-compact' : 'button-teal button-compact'} onClick={() => { setChildren(String(existing?.childCount ?? presentNow)); setAdults(String(existing?.adultCount ?? 4)); setEditing(true); }}>{existing ? 'Edit counts' : 'Record counts'}</Button>
    </div>}
  </article>;
}

export function CacfpTab({ data }: { data: DashboardData }) {
  const mealsToday = data.meals.filter(record => record.date === todayIso());
  const totalToday = mealsToday.reduce((sum, record) => sum + record.childCount + record.adultCount, 0);
  const currentClaim = data.cacfpClaims.find(claim => claim.status === 'draft');
  const pastClaims = data.cacfpClaims.filter(claim => claim.status !== 'draft');
  const renewal = `${new Date().getFullYear()}-08-15`;
  const monthLabel = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const report = () => cacfpReport(data);

  return <>
    <SectionHead title="CACFP — Food Program" subtitle="Daily meal counts, monthly claims, and program renewal.">
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print counts</Button>
      <Button className="button-soft" onClick={() => downloadCsv('cacfp-meal-counts', report())}><Download size={16}/> CSV</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<UtensilsCrossed/>} tone="teal" label="Meals Served Today" value={totalToday} sub={`${mealsToday.length} of 3 services recorded`}/>
      <StatCard icon={<CheckCircle2/>} tone="blue" label="Claim Month" value={currentClaim ? monthLabel(currentClaim.month) : '—'} sub={currentClaim ? `${currentClaim.daysSubmitted} / ${currentClaim.daysInMonth} days submitted` : 'No open claim'}/>
      <StatCard icon={<CheckCircle2/>} tone="green" label="Last Claim" value={pastClaims[0] ? formatMoney(pastClaims[0].amount) : '—'} sub={pastClaims[0] ? `${monthLabel(pastClaims[0].month)} · ${pastClaims[0].status}` : ''}/>
      <StatCard icon={<RefreshCw/>} tone="amber" label="Renewal Due" value={fmtShortDate(renewal)} sub={`${Math.max(daysUntil(renewal), 0)} days remaining`}/>
    </section>

    <h2 className="subsection-title">Today’s meal service — {fmtDate(todayIso())}</h2>
    <section className="meal-grid">{MEALS.map(({ id, label, icon }) => <MealCard key={id} data={data} meal={id} label={label} icon={icon}/>)}</section>

    <section className="cacfp-lower">
      <article className="panel table-panel">
        <header><h2>Meal count log</h2><span className="muted-count">{data.meals.length} records</span></header>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Meal</th><th>Children</th><th>Adults</th><th>Total</th><th>Recorded by</th></tr></thead>
            <tbody>{[...data.meals].sort((a, b) => b.date.localeCompare(a.date) || a.meal.localeCompare(b.meal)).map(record => <tr key={record.id}>
              <td>{fmtShortDate(record.date)}</td><td className="capitalize">{record.meal}</td><td>{record.childCount}</td><td>{record.adultCount}</td><td><strong>{record.childCount + record.adultCount}</strong></td><td>{record.recordedBy}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </article>
      <article className="panel claims-panel">
        <header><h2>Claims history</h2></header>
        {currentClaim ? <div className="claim-row current">
          <div><b>{monthLabel(currentClaim.month)}</b><small>In progress — {currentClaim.daysSubmitted} of {currentClaim.daysInMonth} days entered</small></div>
          <div className="claim-progress"><i style={{ width: `${Math.round((currentClaim.daysSubmitted / currentClaim.daysInMonth) * 100)}%` }}/></div>
          <span className="status-select status-inquiry">draft</span>
        </div> : null}
        {pastClaims.map(claim => <div className="claim-row" key={claim.id}>
          <div><b>{monthLabel(claim.month)}</b><small>{claim.daysSubmitted} of {claim.daysInMonth} days · {formatMoney(claim.amount)}</small></div>
          <span className={`status-select status-${claim.status === 'approved' ? 'approved' : 'enrolled'}`}>{claim.status}</span>
        </div>)}
        <p className="empty-note">Reimbursement deposits post 4–6 weeks after state approval.</p>
      </article>
    </section>
  </>;
}
