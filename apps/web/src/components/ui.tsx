import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Compass, X } from 'lucide-react';

export const spring = { type: 'spring' as const, damping: 25, stiffness: 200 };

export function Logo() {
  return <div className="logo-lockup"><span className="logo-mark"><Compass size={23} strokeWidth={2.4} /></span><span><b>Child Compass</b><em>Guiding Growth. Every Step.</em></span></div>;
}

export function Avatar({ label, tone = 'sky', size = 'md' }: { label: string; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = label.length <= 3 && label === label.toUpperCase() ? label : label.split(' ').map(part => part[0]).slice(0, 2).join('');
  return <span className={`avatar avatar-${tone} avatar-${size}`} aria-label={label}>{initials}</span>;
}

export function Button({ children, className = '', ...props }: HTMLMotionProps<'button'>) {
  return <motion.button whileTap={{ scale: 0.94 }} transition={spring} className={`button ${className}`} {...props}>{children}</motion.button>;
}

export function IconButton({ label, children, ...props }: HTMLMotionProps<'button'> & { label: string; children: ReactNode }) {
  return <motion.button whileTap={{ scale: 0.9 }} transition={spring} className="icon-button" aria-label={label} title={label} {...props}>{children}</motion.button>;
}

export function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <motion.section role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'modal-wide' : ''}`} initial={{ y: 50, opacity: 0, scale: .97 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={spring}>
      <header><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div><IconButton label="Close" onClick={onClose}><X size={19} /></IconButton></header>
      {children}
    </motion.section>
  </motion.div>;
}

export function LoadingScreen() {
  return <div className="loading-screen"><Logo /><div className="loading-orbit"><span /><span /><span /></div><p>Gathering today’s little moments…</p></div>;
}

export function ErrorScreen({ onRetry, onSignOut, message = 'We couldn’t reach your center right now. Check your connection and try again.' }: { onRetry: () => void; onSignOut: () => void; message?: string }) {
  return <div className="loading-screen" role="alert">
    <Logo />
    <p>{message}</p>
    <div style={{ display: 'flex', gap: 12 }}>
      <Button className="button-primary" onClick={onRetry}>Try again</Button>
      <Button className="button-ghost" onClick={onSignOut}>Sign out</Button>
    </div>
  </div>;
}
