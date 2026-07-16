import { useState } from 'react';
import { CalendarCheck, CalendarX, Download, LogIn, LogOut, Percent, Printer, RotateCcw } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { Avatar, Button } from '../../components/ui';
import { useAttendance } from '../../hooks/useCompass';
import { downloadCsv, printReport } from '../../lib/reports';
import { dailyAttendanceReport } from './reportDefs';
import { fmtDate, fmtTime, presentCountOn, roomName, SectionHead, StatCard, todayIso } from './common';

export function AttendanceTab({ data }: { data: DashboardData }) {
  const [date, setDate] = useState(todayIso());
  const attendance = useAttendance();
  const isToday = date === todayIso();
  const present = presentCountOn(data, date);
  const absent = Math.max(data.children.length - present, 0);
  const rate = Math.round((present / Math.max(data.children.length, 1)) * 100);
  const report = () => dailyAttendanceReport(data, date);

  return <>
    <SectionHead title="Attendance" subtitle={isToday ? 'Live check-in board — changes sync to every portal instantly.' : `Attendance history for ${fmtDate(date)}.`}>
      <label className="date-chip"><input type="date" value={date} max={todayIso()} onChange={event => setDate(event.target.value || todayIso())} aria-label="Attendance date"/></label>
      <Button className="button-soft" onClick={() => printReport(report(), data.center.name)}><Printer size={16}/> Print sheet</Button>
      <Button className="button-soft" onClick={() => downloadCsv(`attendance-${date}`, report())}><Download size={16}/> CSV</Button>
    </SectionHead>

    <section className="stat-grid stat-grid-4">
      <StatCard icon={<CalendarCheck/>} tone="teal" label="Present" value={present} sub={isToday ? 'Checked in today' : 'Checked in'}/>
      <StatCard icon={<CalendarX/>} tone="red" label="Absent" value={absent} sub={isToday ? 'Not yet arrived' : 'Marked absent'}/>
      <StatCard icon={<Percent/>} tone="blue" label="Attendance Rate" value={`${rate}%`} sub="Of enrolled children"/>
      <StatCard icon={<CalendarCheck/>} tone="green" label="Classrooms In Ratio" value={data.classrooms.length} sub="All rooms covered"/>
    </section>

    <article className="panel table-panel">
      <header><h2>{isToday ? 'Today’s board' : fmtDate(date)}</h2><span className="muted-count">{data.children.length} children</span></header>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Child</th><th>Classroom</th><th>Status</th><th>Time in</th><th>Time out</th>{isToday ? <th>Actions</th> : null}</tr></thead>
          <tbody>{data.children.map(child => {
            const entry = data.attendanceLog.find(item => item.date === date && item.childId === child.id);
            const status = isToday ? child.attendanceStatus : entry?.status === 'present' ? 'present' : 'expected';
            return <tr key={child.id}>
              <td><span className="cell-person"><Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar} size="sm"/><b>{child.firstName} {child.lastName}</b></span></td>
              <td>{roomName(data, child.classroomId)}</td>
              <td><span className={`status-chip status-${isToday ? child.attendanceStatus : entry?.status === 'present' ? 'present' : 'absent'}`}>{isToday ? child.attendanceStatus.replace('_', ' ') : entry?.status === 'present' ? 'present' : 'absent'}</span></td>
              <td>{fmtTime(isToday ? child.checkedInAt : entry?.checkedInAt)}</td>
              <td>{fmtTime(isToday ? child.checkedOutAt : entry?.checkedOutAt)}</td>
              {isToday ? <td><div className="row-actions">
                {status === 'expected' ? <Button className="button-teal button-compact" disabled={attendance.isPending} onClick={() => attendance.mutate({ childId: child.id, status: 'present' })}><LogIn size={14}/> Check in</Button> : null}
                {status === 'present' ? <Button className="button-soft button-compact" disabled={attendance.isPending} onClick={() => attendance.mutate({ childId: child.id, status: 'went_home' })}><LogOut size={14}/> Check out</Button> : null}
                {status === 'went_home' ? <Button className="button-ghost button-compact" disabled={attendance.isPending} onClick={() => attendance.mutate({ childId: child.id, status: 'expected' })}><RotateCcw size={14}/> Reset</Button> : null}
              </div></td> : null}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </article>
  </>;
}
