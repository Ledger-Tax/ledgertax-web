import type { ApiEvent, ReportResponse } from '../lib/api-types';

export const ADDRESS = `G${'A'.repeat(55)}`;
export const ISSUER = `G${'B'.repeat(55)}`;
/** A throwaway string shaped like a secret key. It is not a key for any account. */
export const SECRET_SHAPED = `S${'ABCDEFGH'.repeat(7).slice(0, 55)}`;

let n = 0;
export function event(extra: Partial<ApiEvent> = {}): ApiEvent {
  n += 1;
  return {
    id: `tx${n}:0:0`,
    txHash: `tx${n}`,
    opIndex: 0,
    ledger: n,
    time: '2026-01-01T00:00:00Z',
    type: 'payment_in',
    address: ADDRESS,
    asset: 'native',
    amount: '15000000',
    decimals: 7,
    raw: { source: 'horizon', ref: String(n) },
    ...extra,
  };
}

export function ndjson(
  events: ApiEvent[],
  tail: object = { done: true, count: events.length },
): string {
  return `${[...events.map((e) => JSON.stringify({ event: e })), JSON.stringify(tail)].join('\n')}\n`;
}

export function report(extra: Partial<ReportResponse> = {}): ReportResponse {
  return {
    address: ADDRESS,
    generatedAt: '2026-01-01T00:00:00.000Z',
    method: 'fifo',
    currency: 'USD',
    fiatDecimals: 2,
    source: { description: 'Horizon (https://horizon.example)', range: 'ledgers 1 to 2' },
    counts: { events: 3, unknownEvents: 1, gains: 1, issues: 1 },
    totals: { gain: '12.50' },
    gains: [
      {
        acquiredAt: '2025-01-01T00:00:00Z',
        disposedAt: '2025-02-01T00:00:00Z',
        asset: 'native',
        quantity: '10.0000000',
        proceeds: '20.00',
        costBasis: '7.50',
        gain: '12.50',
        holdingDays: 31,
        currency: 'USD',
        disposalEventId: 'd',
        acquisitionEventId: 'a',
      },
    ],
    issues: [
      {
        code: 'missing_price',
        eventId: 'x',
        time: '2025-03-01T00:00:00Z',
        asset: 'native',
        message: 'No USD price.',
      },
    ],
    warnings: [],
    files: {
      eventsCsv: '# Accounting export, not tax advice.\nevent_id\n',
      gainsCsv: '# Accounting export, not tax advice.\nstatus\n',
    },
    ...extra,
  };
}

/** A fetch answering through a handler, recording the requests. */
export function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(init ? { url, init } : { url });
    return handler(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
