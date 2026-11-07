import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Disclaimer } from '../app/disclaimer';

describe('Disclaimer', () => {
  it('shows the required line', () => {
    render(<Disclaimer />);
    expect(screen.getByText('Accounting export, not tax advice.')).toBeTruthy();
  });
  it('does not claim to give tax advice', () => {
    const { container } = render(<Disclaimer />);
    expect(container.textContent).not.toMatch(/is tax advice/i);
  });
});
