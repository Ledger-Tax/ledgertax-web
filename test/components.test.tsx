import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddressForm } from '../components/AddressForm';
import { EventsView } from '../components/EventsView';
import { PricesPanel } from '../components/PricesPanel';
import { ReportView } from '../components/ReportView';
import { ADDRESS, SECRET_SHAPED, event, report } from './helpers';

describe('AddressForm', () => {
  it('has a labelled field and submits a valid public address', () => {
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} busy={false} />);
    const field = screen.getByLabelText('Stellar public address');
    fireEvent.change(field, { target: { value: ` ${ADDRESS} ` } });
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(ADDRESS);
  });

  it('removes anything shaped like a secret key at once, warns, and never submits it', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AddressForm onSubmit={onSubmit} busy={false} />);
    const field = screen.getByLabelText('Stellar public address') as HTMLInputElement;
    fireEvent.change(field, { target: { value: SECRET_SHAPED } });
    expect(field.value).toBe('');
    expect(container.innerHTML).not.toContain(SECRET_SHAPED);
    expect(screen.getByRole('alert').textContent).toContain('secret key');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    expect(onSubmit).not.toHaveBeenCalled();
    // typing a normal address afterwards clears the warning
    fireEvent.change(field, { target: { value: ADDRESS } });
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('shows an inline error for empty and invalid input and does not submit', () => {
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} busy={false} />);
    const field = screen.getByLabelText('Stellar public address');
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter an address.');
    fireEvent.change(field, { target: { value: 'hello' } });
    expect(screen.getByRole('alert').textContent).toContain('does not look like');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the field and button while busy', () => {
    render(<AddressForm onSubmit={vi.fn()} busy />);
    expect((screen.getByLabelText('Stellar public address') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('EventsView', () => {
  const noop = () => undefined;

  it('renders nothing before anything was loaded', () => {
    const { container } = render(
      <EventsView state={{ status: 'idle' }} labels={{}} onLabel={noop} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows a loading state with progress', () => {
    render(<EventsView state={{ status: 'loading', count: 25 }} labels={{}} onLabel={noop} />);
    expect(screen.getByRole('status').textContent).toContain('25 events so far');
  });

  it('shows an error with a retry button', () => {
    const onRetry = vi.fn();
    render(
      <EventsView
        state={{ status: 'error', code: 'network', message: 'Could not reach the server.' }}
        labels={{}}
        onLabel={noop}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Could not reach the server.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows an empty state', () => {
    render(<EventsView state={{ status: 'ready', events: [] }} labels={{}} onLabel={noop} />);
    expect(screen.getByRole('status').textContent).toContain('No events found');
  });

  it('shows the events, flags unknown ones visibly and for screen readers, and filters by type', () => {
    const events = [
      event({ type: 'payment_in', memo: 'hello' }),
      event({ type: 'unknown', opType: 'change_trust', amount: undefined }),
      event({
        type: 'trade',
        asset: 'native',
        amount: '300000000',
        counterAsset: `TEST:G${'B'.repeat(55)}`,
        counterAmount: '200000000',
        counterDecimals: 7,
      }),
    ];
    render(<EventsView state={{ status: 'ready', events }} labels={{}} onLabel={noop} />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3
    expect(screen.getByText(/not understood by the classifier/)).toBeTruthy();
    expect(screen.getByText(/1 event was not understood/)).toBeTruthy();
    expect(screen.getByText('30 XLM → 20 TEST (GBBB…BBBB)')).toBeTruthy();
    expect(screen.getByText('1.5 XLM')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'unknown' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('(change_trust)')).toBeTruthy();
  });

  it('lets the user relabel an event with the keyboard-operable select and shows the saved label', () => {
    const e = event({ type: 'payment_out' });
    const onLabel = vi.fn();
    render(
      <EventsView
        state={{ status: 'ready', events: [e] }}
        labels={{ [e.id]: { eventId: e.id, label: 'disposal' } }}
        onLabel={onLabel}
      />,
    );
    const select = screen.getByLabelText(/Label for Payment out/) as HTMLSelectElement;
    expect(select.value).toBe('disposal');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(['', 'disposal', 'transfer', 'gift', 'ignore']);
    fireEvent.change(select, { target: { value: 'gift' } });
    expect(onLabel).toHaveBeenLastCalledWith(e.id, 'gift');
    fireEvent.change(select, { target: { value: '' } });
    expect(onLabel).toHaveBeenLastCalledWith(e.id, undefined);
  });

  it('shows memos from the chain as plain text, never as markup', () => {
    const memo = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <EventsView
        state={{ status: 'ready', events: [event({ memo })] }}
        labels={{}}
        onLabel={noop}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });
});

describe('PricesPanel', () => {
  it('asks for a report with the default currency and no prices', () => {
    const onGenerate = vi.fn();
    render(<PricesPanel busy={false} error={undefined} labelCount={2} onGenerate={onGenerate} />);
    expect(screen.getByText(/2 labels/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ priceCsv: undefined, currency: 'USD' });
  });

  it('reads the chosen file in the browser and sends its text with the upper-cased currency', async () => {
    const onGenerate = vi.fn();
    render(<PricesPanel busy={false} error={undefined} labelCount={0} onGenerate={onGenerate} />);
    const csv = 'asset,date,price,currency\nnative,2025-01-01,0.1,EUR\n';
    fireEvent.change(screen.getByLabelText('Price file (CSV)'), {
      target: { files: [new File([csv], 'prices.csv', { type: 'text/csv' })] },
    });
    expect(await screen.findByText('Using prices.csv')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'eur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ priceCsv: csv, currency: 'EUR' });
  });

  it('refuses a file over 1 MiB and a currency that is not three capital letters', async () => {
    const onGenerate = vi.fn();
    render(<PricesPanel busy={false} error={undefined} labelCount={0} onGenerate={onGenerate} />);
    const big = new File(['x'], 'big.csv');
    Object.defineProperty(big, 'size', { value: 2_000_000 });
    fireEvent.change(screen.getByLabelText('Price file (CSV)'), { target: { files: [big] } });
    expect((await screen.findByRole('alert')).textContent).toContain('larger than 1 MiB');
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'US' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(screen.getByRole('alert').textContent).toContain('three capital letters');
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('lists the problems the server found in the price file, with line numbers', () => {
    render(
      <PricesPanel
        busy={false}
        labelCount={0}
        onGenerate={vi.fn()}
        error={{
          code: 'invalid_price_csv',
          message: 'The price file has 2 problem(s).',
          details: [
            { row: 2, column: 'date', message: 'Must be a real date' },
            { row: 5, message: 'Duplicate row' },
          ],
        }}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Line 2 (date): Must be a real date', 'Line 5: Duplicate row']);
  });

  it('shows other errors as one message and disables the button while busy', () => {
    const { rerender } = render(
      <PricesPanel
        busy={false}
        labelCount={0}
        onGenerate={vi.fn()}
        error={{ code: 'network', message: 'Could not reach the server.' }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not reach the server.');
    rerender(<PricesPanel busy labelCount={0} onGenerate={vi.fn()} error={undefined} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ReportView', () => {
  it('states what the report is and where it came from, and shows totals, problems and gains', () => {
    render(<ReportView report={report()} />);
    expect(screen.getByText('Accounting export, not tax advice.')).toBeTruthy();
    expect(screen.getByText('Horizon (https://horizon.example)')).toBeTruthy();
    expect(screen.getByText('ledgers 1 to 2')).toBeTruthy();
    expect(screen.getByText('12.50 USD')).toBeTruthy();
    expect(screen.getByText(/1 row could not be calculated/)).toBeTruthy();
    expect(screen.getByText('missing_price')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();
  });

  it('offers both CSV files as keyboard-reachable download links', async () => {
    render(<ReportView report={report()} />);
    const gains = (await screen.findByRole('link', {
      name: 'Download gains.csv',
    })) as HTMLAnchorElement;
    const events = screen.getByRole('link', { name: 'Download events.csv' }) as HTMLAnchorElement;
    expect(gains.getAttribute('download')).toBe('gains.csv');
    expect(events.getAttribute('download')).toBe('events.csv');
    expect(gains.href).toMatch(/^(blob|data):/);
  });

  it('puts the right text in each downloaded file, and releases the links when it goes away', async () => {
    const made: Blob[] = [];
    const revoked: string[] = [];
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      made.push(blob as Blob);
      return `blob:test-${made.length}`;
    });
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation((url) => void revoked.push(url));
    const { unmount } = render(<ReportView report={report()} />);
    await screen.findByRole('link', { name: 'Download gains.csv' });
    const texts = await Promise.all(made.map((b) => b.text()));
    expect(texts).toHaveLength(2);
    for (const text of texts)
      expect(text.startsWith('# Accounting export, not tax advice.')).toBe(true);
    expect(made[0]?.type).toContain('text/csv');
    unmount();
    expect(revoked.sort()).toEqual(['blob:test-1', 'blob:test-2']);
    create.mockRestore();
    revoke.mockRestore();
  });

  it('shows an empty state when nothing could be calculated, and no problem box when there are none', () => {
    render(<ReportView report={report({ gains: [], issues: [] })} />);
    expect(screen.getByRole('status').textContent).toContain('No gains or losses');
    expect(screen.queryByRole('region', { name: 'Problems' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
