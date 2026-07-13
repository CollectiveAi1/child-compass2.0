import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, GraduationCap, Heart, LockKeyhole, Sparkles } from 'lucide-react';
import type { Role } from '@compass/shared';
import { Button, Logo, spring } from './ui';

const roles = [
  { role: 'admin' as const, title: 'Admin', name: 'Maya Brooks', email: 'admin@compass.demo', note: 'Control center, people, billing & compliance', icon: Building2, tone: 'blue' },
  { role: 'teacher' as const, title: 'Teacher', name: 'Jordan Ellis', email: 'teacher@compass.demo', note: 'Living dashboard, attendance & quick logs', icon: GraduationCap, tone: 'mint' },
  { role: 'parent' as const, title: 'Parent', name: 'Alex Morgan', email: 'parent@compass.demo', note: 'Daily stories, messages & family billing', icon: Heart, tone: 'pink' },
];

export function LoginScreen({ onLogin, loading, error }: { onLogin: (email: string, password: string) => Promise<void>; loading: boolean; error: string }) {
  const [selected, setSelected] = useState<Role>('teacher');
  const current = roles.find(item => item.role === selected)!;
  return <main className="login-page">
    <div className="login-doodle doodle-one">✦</div><div className="login-doodle doodle-two">⌁</div><div className="login-doodle doodle-three">♡</div>
    <section className="login-story">
      <Logo />
      <div className="login-copy"><p className="eyebrow"><Sparkles size={15} /> A calmer kind of child care software</p><h1>Every little moment,<br/><em>beautifully connected.</em></h1><p>One nurturing place for center teams to move faster—and families to feel closer.</p></div>
      <div className="login-illustration" aria-label="A playful path connecting school and home"><span className="sun-shape">☀</span><div className="little-school"><i/><i/><b>Willow &<br/>Wonder</b></div><div className="path-line"/><div className="little-home"><span>♡</span></div><div className="tiny-tree">♧</div></div>
      <p className="trust-note"><LockKeyhole size={14} /> Private by design · Built for real child care days</p>
    </section>
    <section className="login-panel">
      <div className="login-form-card"><p className="eyebrow">Welcome to the demo</p><h2>Choose your view</h2><p className="muted">Each portal is fully connected to the same center.</p>
        <div className="role-picker">
          {roles.map(({ role, title, name, note, icon: Icon, tone }) => <motion.button key={role} aria-label={`${title} — ${note}`} className={`role-option ${selected === role ? 'selected' : ''} role-${tone}`} onClick={() => setSelected(role)} whileTap={{ scale: .97 }} transition={spring}>
            <span className="role-icon"><Icon size={21}/></span><span><b>{title}</b><small>{name}</small></span><span className="radio-dot"/>
          </motion.button>)}
        </div>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <Button className="button-primary login-button" disabled={loading} onClick={() => onLogin(current.email, 'demo123')}>{loading ? 'Opening your portal…' : `Enter ${current.title} Portal`}<ArrowRight size={18}/></Button>
        <div className="demo-key"><span>Demo access</span><code>{current.email}</code><code>demo123</code></div>
      </div>
    </section>
  </main>;
}
