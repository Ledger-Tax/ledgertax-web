import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workbench } from '../components/Workbench';
import type { StorageLike } from '../lib/labels-store';
import { ADDRESS, SECRET_SHAPED, event, json, mockFetch, ndjson, report } from './helpers';

beforeEach(() => {
  process.env['NEXT_PUBLIC_API_URL'] = 'http://api.test';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['NEXT_PUBLIC_API_URL'];
});

function storage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function enterAddress(value = ADDRESS) {
  fireEvent.change(screen.getByLabelText('Stellar public address'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
}

describe('Workbench: the whole flow', () => {
  it('loads events, keeps a label in the browser, sends prices and labels with the report request, and offers downloads', async () => {
    const out = event({ type: 'payment_out' });
    const store = storage();
    const { fn, calls } = mockFetch((url) => {
      if (url.includes('/events')) return new Response(ndjson([event(), out]));
      return json(report());
    });
    vi.stubGlobal('fetch', fn);
    const getStore = () => store;
    render(<Workbench storage={getStore} />);

    enterAddress();
    const select = (await screen.findByLabelText(/Label for Payment out/)) as HTMLSelectElement;
    expect(screen.getAllByRole('row')).toHaveLength(3);

    // relabel: kept in the browser only
    fireEvent.change(select, { target: { value: 'disposal' } });
    expect((screen.getByLabelText(/Label for Payment out/) as HTMLSelectElement).value).toBe(
      'disposal',
    );
    expect([...store.data.values()].join('')).toContain('disposal');
    expect(calls.every((c) => !String(c.init?.body ?? '').includes('disposal'))).toBe(true);

    // prices and report
    const csv = 'asset,date,price,currency\nnative,2026-01-01,0.5,USD\n';
    fireEvent.change(screen.getByLabelText('Price file (CSV)'), {
      target: { files: [new File([csv], 'p.csv')] },
    });
    await screen.findByText('Using p.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('link', { name: 'Download gains.csv' })).toBeTruthy();
    expect(screen.getByText('12.50 USD')).toBeTruthy();
    const post = calls.find((c) => c.url.endsWith('/reports'));
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      address: ADDRESS,
      currency: 'USD',
      priceCsv: csv,
      labels: [{ eventId: out.id, label: 'disposal' }],
    });
  });

  it('restores saved labels when the same address is loaded again', async () => {
    const out = event({ type: 'payment_out' });
    const store = storage();
    store.data.set(
      `ledgertax:labels:${ADDRESS}`,
      JSON.stringify({ [out.id]: { eventId: out.id, label: 'gift' } }),
    );
    vi.stubGlobal('fetch', mockFetch(() => new Response(ndjson([out]))).fn);
    render(<Workbench storage={() => store} />);
    enterAddress();
    expect(
      ((await screen.findByLabelText(/Label for Payment out/)) as HTMLSelectElement).value,
    ).toBe('gift');
  });

  it('works without any storage at all', async () => {
    const out = event({ type: 'payment_out' });
    vi.stubGlobal('fetch', mockFetch(() => new Response(ndjson([out]))).fn);
    render(<Workbench storage={() => undefined} />);
    enterAddress();
    const select = (await screen.findByLabelText(/Label for Payment out/)) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'transfer' } });
    expect((screen.getByLabelText(/Label for Payment out/) as HTMLSelectElement).value).toBe(
      'transfer',
    );
  });

  it('shows a loading state, then the error when the API fails, and retries', async () => {
    let attempt = 0;
    const { fn } = mockFetch(() => {
      attempt += 1;
      return attempt === 1
        ? json({ error: { code: 'upstream_failed', message: 'The history source failed.' } }, 502)
        : new Response(ndjson([event()]));
    });
    vi.stubGlobal('fetch', fn);
    render(<Workbench storage={() => undefined} />);
    enterAddress();
    expect(screen.getByRole('status').textContent).toContain('Loading history');
    expect(await screen.findByText(/The history source failed\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('shows an empty state for an address with no events', async () => {
    vi.stubGlobal('fetch', mockFetch(() => new Response(ndjson([]))).fn);
    render(<Workbench storage={() => undefined} />);
    enterAddress();
    expect((await screen.findByRole('status')).textContent).toContain('No events found');
  });

  it('shows the price file problems from the server and no report', async () => {
    const details = [
      {
        row: 3,
        column: 'price',
        message: 'Must be a non-negative decimal with at most 12 decimals',
      },
    ];
    vi.stubGlobal(
      'fetch',
      mockFetch((url) =>
        url.includes('/events')
          ? new Response(ndjson([event()]))
          : json(
              {
                error: {
                  code: 'invalid_price_csv',
                  message: 'The price file has 1 problem(s).',
                  details,
                },
              },
              422,
            ),
      ).fn,
    );
    render(<Workbench storage={() => undefined} />);
    enterAddress();
    fireEvent.click(await screen.findByRole('button', { name: 'Generate report' }));
    expect(await screen.findByText(/Line 3 \(price\)/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Download gains.csv' })).toBeNull();
  });

  it('never sends a secret key anywhere: no request is made', async () => {
    const { fn, calls } = mockFetch(() => new Response(ndjson([])));
    vi.stubGlobal('fetch', fn);
    render(<Workbench storage={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Stellar public address'), {
      target: { value: SECRET_SHAPED },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('secret key'));
    expect(calls).toHaveLength(0);
  });

  it('says so when the API is not configured', async () => {
    delete process.env['NEXT_PUBLIC_API_URL'];
    vi.stubGlobal('fetch', mockFetch(() => new Response('')).fn);
    render(<Workbench storage={() => undefined} />);
    enterAddress();
    expect(await screen.findByText(/not configured/)).toBeTruthy();
  });
});
