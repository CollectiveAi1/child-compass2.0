import { describe, expect, it } from 'vitest';
import { nextAttendanceStatus, portalForRole } from './index';

describe('attendance workflow', () => {
  it('cycles expected children through present and went home', () => {
    expect(nextAttendanceStatus('expected')).toBe('present');
    expect(nextAttendanceStatus('present')).toBe('went_home');
    expect(nextAttendanceStatus('went_home')).toBe('expected');
  });
});

describe('role portals', () => {
  it('maps each role to a distinct portal', () => {
    expect(portalForRole('admin')).toBe('/admin');
    expect(portalForRole('teacher')).toBe('/teacher');
    expect(portalForRole('parent')).toBe('/parent');
  });
});
