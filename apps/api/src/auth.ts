import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@compass/shared';
import { store } from './store';

const JWT_SECRET = process.env.JWT_SECRET || 'compass-demo-secret-change-in-production';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('JWT_SECRET is not set — tokens are signed with the built-in demo secret. Set JWT_SECRET in your environment before real use.');
}

export interface AuthRequest extends Request { user?: User }

export function signUser(user: User): string {
  return jwt.sign({ sub: user.id, centerId: user.centerId, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

export function userFromToken(token: string): User | undefined {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; centerId: string };
    return store().users.find(item => item.id === payload.sub && item.centerId === payload.centerId);
  } catch { return undefined; }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Please sign in to continue.' });
  try {
    const user = userFromToken(token);
    if (!user) throw new Error('User not found');
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Your session has expired. Please sign in again.' });
  }
}

export function allow(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden', message: 'This action is not available for your role.' });
    next();
  };
}
