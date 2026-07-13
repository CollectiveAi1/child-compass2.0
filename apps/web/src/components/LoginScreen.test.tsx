// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('offers three distinguishable demo roles and submits the selected identity', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen onLogin={onLogin} loading={false} error="" />);
    expect(screen.getByRole('button', { name: /^admin —/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^teacher —/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^parent —/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^teacher —/i }));
    await userEvent.click(screen.getByRole('button', { name: /enter teacher portal/i }));
    expect(onLogin).toHaveBeenCalledWith('teacher@compass.demo', 'demo123');
  });
});
