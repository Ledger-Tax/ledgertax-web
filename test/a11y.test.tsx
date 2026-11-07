import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workbench } from '../components/Workbench';
import { ADDRESS, event, json, mockFetch, ndjson, report } from './helpers';

beforeEach(() => {
  process.env['NEXT_PUBLIC_API_URL'] = 'http://api.test';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['NEXT_PUBLIC_API_URL'];
});

/** The accessible name of a control, from the sources a screen reader uses. */
function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy)
    return labelledBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0)
    return [...labels]
      .map((l) => l.textContent ?? '')
      .join(' ')
      .trim();
  return (el.textContent ?? '').trim();
}

describe('accessibility of the full flow', () => {
  it('gives every control a name, keeps natural tab order and ties errors to their fields', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch((url) =>
        url.includes('/events')
          ? new Response(
              ndjson([
                event({ type: 'payment_out' }),
                event({ type: 'unknown', opType: 'change_trust', amount: undefined }),
              ]),
            )
          : json(report()),
      ).fn,
    );
    const { container } = render(<Workbench storage={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Stellar public address'), {
      target: { value: ADDRESS },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    await screen.findByRole('link', { name: 'Download gains.csv' });

    const controls = [...container.querySelectorAll('input, select, button, a[href], textarea')];
    expect(controls.length).toBeGreaterThan(5);
    for (const el of controls) {
      expect(nameOf(el), `${el.tagName} ${el.outerHTML.slice(0, 80)}`).not.toBe('');
      // natural order: nothing may jump the queue
      expect(
        Number(el.getAttribute('tabindex') ?? 0),
        el.outerHTML.slice(0, 80),
      ).toBeLessThanOrEqual(0);
    }
    // every table has a caption and column headers with a scope
    for (const table of container.querySelectorAll('table')) {
      expect(table.querySelector('caption')).not.toBeNull();
      for (const th of table.querySelectorAll('th')) expect(th.getAttribute('scope')).toBe('col');
    }
    // headings do not skip a level
    const levels = [...container.querySelectorAll('h1, h2, h3')].map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1)
      expect((levels[i] ?? 0) - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1);
    // nothing is communicated only by colour: unknown rows also say so in text
    expect(screen.getByText(/not understood by the classifier/)).toBeTruthy();
  });

  it('connects the address field to its hint and its error message', () => {
    render(<Workbench storage={() => undefined} />);
    const field = screen.getByLabelText('Stellar public address');
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    const described = (field.getAttribute('aria-describedby') ?? '').split(' ');
    expect(described).toHaveLength(2);
    const texts = described.map((id) => document.getElementById(id)?.textContent ?? '');
    expect(texts[0]).toContain('Never enter a secret key');
    expect(texts[1]).toBe('Enter an address.');
  });
});
