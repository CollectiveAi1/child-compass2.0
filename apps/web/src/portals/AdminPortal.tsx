import { useState } from 'react';
import { BarChart3, BookOpen, CalendarCheck, ClipboardList, Contact, DollarSign, LayoutDashboard, MessageCircle, Settings, UserPlus, Users, UtensilsCrossed } from 'lucide-react';
import { formatMoney } from '@compass/shared';
import { AppShell, type ShellNotification } from '../components/AppShell';
import { ErrorScreen, LoadingScreen } from '../components/ui';
import { useDashboard } from '../hooks/useCompass';
import { useSession } from '../lib/session';
import { DashboardTab, type QuickAction } from './admin/Dashboard';
import { EnrollmentTab } from './admin/Enrollment';
import { ChildrenTab } from './admin/Children';
import { AttendanceTab } from './admin/Attendance';
import { StaffTab } from './admin/Staff';
import { CurriculumTab } from './admin/CurriculumTab';
import { ActivitiesTab } from './admin/Activities';
import { CommunicationsTab } from './admin/Communications';
import { BillingTab } from './admin/Billing';
import { CacfpTab } from './admin/Cacfp';
import { ReportsTab } from './admin/Reports';
import { SettingsTab } from './admin/SettingsTab';
import { daysUntil } from './admin/common';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19}/> },
  { id: 'enrollment', label: 'Enrollment', icon: <UserPlus size={19}/> },
  { id: 'children', label: 'Children', icon: <Contact size={19}/> },
  { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={19}/> },
  { id: 'staff', label: 'Staff', icon: <Users size={19}/> },
  { id: 'curriculum', label: 'Curriculum', icon: <BookOpen size={19}/> },
  { id: 'activities', label: 'Daily Activities', icon: <ClipboardList size={19}/> },
  { id: 'communications', label: 'Communications', icon: <MessageCircle size={19}/> },
  { id: 'billing', label: 'Billing & Payments', icon: <DollarSign size={19}/> },
  { id: 'cacfp', label: 'CACFP', icon: <UtensilsCrossed size={19}/>, tag: 'Food Program' },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={19}/> },
  { id: 'settings', label: 'Settings', icon: <Settings size={19}/> },
];

const ACTION_TARGETS: Record<QuickAction, { tab: string; intent?: string }> = {
  'add-child': { tab: 'children', intent: 'add-child' },
  'take-attendance': { tab: 'attendance' },
  'send-message': { tab: 'communications' },
  'record-payment': { tab: 'billing', intent: 'record-payment' },
  'add-activity': { tab: 'activities', intent: 'log-activity' },
  'view-reports': { tab: 'reports' },
  'view-activities': { tab: 'activities' },
  'view-curriculum': { tab: 'curriculum' },
  'view-cacfp': { tab: 'cacfp' },
  'view-staff': { tab: 'staff' },
};

export function AdminPortal() {
  const { data, isError, refetch } = useDashboard();
  const clear = useSession(state => state.clear);
  const [active, setActive] = useState('dashboard');
  const [intent, setIntent] = useState<string | null>(null);
  if (!data) return isError ? <ErrorScreen onRetry={() => void refetch()} onSignOut={clear}/> : <LoadingScreen/>;

  const handleAction = (action: QuickAction) => {
    const target = ACTION_TARGETS[action];
    setActive(target.tab);
    setIntent(target.intent ?? null);
  };

  const overdue = data.invoices.filter(invoice => invoice.status === 'overdue');
  const expiringCredentials = data.staff.flatMap(member => (member.credentials ?? []).filter(credential => daysUntil(credential.expires) <= 30).map(credential => ({ member, credential })));
  const newInquiries = data.enrollments.filter(application => application.status === 'inquiry');
  const notifications: ShellNotification[] = [
    ...overdue.map(invoice => { const child = data.children.find(item => item.id === invoice.childId); return { id: invoice.id, title: 'Payment overdue', detail: `${child ? `${child.firstName} ${child.lastName}` : 'A family'} · ${formatMoney(invoice.amount)} · ${invoice.description}`, tone: 'warning' as const }; }),
    ...expiringCredentials.map(({ member, credential }) => ({ id: `${member.id}-${credential.name}`, title: 'Credential renewal due', detail: `${member.name} — ${credential.name} ${daysUntil(credential.expires) < 0 ? 'has expired' : `expires in ${daysUntil(credential.expires)} days`}`, tone: 'warning' as const })),
    ...newInquiries.map(application => ({ id: application.id, title: 'New enrollment inquiry', detail: `${application.childName} · ${application.guardianName}`, tone: 'info' as const })),
  ];

  const messageBadge = data.stats.unreadMessages;
  const nav = navigation.map(item => item.id === 'communications' && messageBadge ? { ...item, badge: messageBadge } : item);
  const consumeIntent = () => setIntent(null);

  return <AppShell navigation={nav} active={active} onNavigate={id => { setActive(id); setIntent(null); }} centerName={data.center.name} notifications={notifications}>
    <main className="portal-page admin-page">
      {active === 'dashboard' ? <DashboardTab data={data} onAction={handleAction}/> : null}
      {active === 'enrollment' ? <EnrollmentTab data={data}/> : null}
      {active === 'children' ? <ChildrenTab data={data} openAdd={intent === 'add-child'} onAddHandled={consumeIntent}/> : null}
      {active === 'attendance' ? <AttendanceTab data={data}/> : null}
      {active === 'staff' ? <StaffTab data={data}/> : null}
      {active === 'curriculum' ? <CurriculumTab data={data}/> : null}
      {active === 'activities' ? <ActivitiesTab data={data} openLog={intent === 'log-activity'} onLogHandled={consumeIntent}/> : null}
      {active === 'communications' ? <CommunicationsTab data={data}/> : null}
      {active === 'billing' ? <BillingTab data={data} openRecord={intent === 'record-payment'} onRecordHandled={consumeIntent}/> : null}
      {active === 'cacfp' ? <CacfpTab data={data}/> : null}
      {active === 'reports' ? <ReportsTab data={data}/> : null}
      {active === 'settings' ? <SettingsTab data={data}/> : null}
    </main>
  </AppShell>;
}
