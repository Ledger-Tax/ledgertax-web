import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createReport, streamEvents } from '../lib/api';
import type { ApiEvent } from '../lib/api-types';
import { ADDRESS, event, json, mockFetch, ndjson, report } from './helpers';

beforeEach(() => {
  process.env['NEXT_PUBLIC_API_URL'] = 'http://api.test/';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['NEXT_PUBLIC_API_URL'];
});

function chunked(text: string, size: number): Response {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('streamEvents', () => {
  it('delivers events as they arrive, even when chunks split lines, and counts them', async () => {
    const events = [
      event(),
      event({ type: 'trade' }),
      event({ type: 'unknown', opType: 'change_trust' }),
    ];
    const { fn, calls } = mockFetch(() => chunked(ndjson(events), 17));
    vi.stubGlobal('fetch', fn);
    const seen: ApiEvent[] = [];
    const count = await streamEvents(ADDRESS, { onEvent: (e) => seen.push(e) });
    expect(count).toBe(3);
    expect(seen.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(calls[0]?.url).toBe(`http://api.test/events?address=${ADDRESS}&format=ndjson`);
  });

  it('works when the response has no readable body', async () => {
    const { fn } = mockFetch(() => new Response(ndjson([event()]), { status: 200 }));
    vi.stubGlobal('fetch', fn);
    expect(await streamEvents(ADDRESS, { onEvent: () => undefined })).toBe(1);
  });

  it('turns an API error answer into an ApiError with code and message', async () => {
    const { fn } = mockFetch(() =>
      json(
        { error: { code: 'invalid_address', message: 'Not a valid Stellar public address.' } },
        400,
      ),
    );
    vi.stubGlobal('fetch', fn);
    const error = await streamEvents(ADDRESS, { onEvent: () => undefined }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'invalid_address', status: 400 });
  });

  it('turns an error line at the end of the stream into an ApiError with the resume cursor', async () => {
    const { fn } = mockFetch(
      () =>
        new Response(
          ndjson([event()], {
            error: { code: 'upstream_failed', message: 'The history source failed', cursor: 'c9' },
          }),
        ),
    );
    vi.stubGlobal('fetch', fn);
    const error = await streamEvents(ADDRESS, { onEvent: () => undefined }).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: 'upstream_failed', cursor: 'c9' });
  });

  it('fails clearly when the stream ends without a completion marker, or has junk', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(() => new Response(JSON.stringify({ event: event() }) + '\n')).fn,
    );
    await expect(streamEvents(ADDRESS, { onEvent: () => undefined })).rejects.toMatchObject({
      code: 'bad_response',
    });
    vi.stubGlobal('fetch', mockFetch(() => new Response('not json\n')).fn);
    await expect(streamEvents(ADDRESS, { onEvent: () => undefined })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('reports an unreachable server and a missing configuration', async () => {
    vi.stubGlobal('fetch', (() => Promise.reject(new TypeError('failed'))) as typeof fetch);
    await expect(streamEvents(ADDRESS, { onEvent: () => undefined })).rejects.toMatchObject({
      code: 'network',
    });
    delete process.env['NEXT_PUBLIC_API_URL'];
    await expect(streamEvents(ADDRESS, { onEvent: () => undefined })).rejects.toMatchObject({
      code: 'not_configured',
    });
  });

  it('answers with a bad_response for an error answer it cannot understand', async () => {
    vi.stubGlobal('fetch', mockFetch(() => new Response('<html>oops</html>', { status: 502 })).fn);
    await expect(streamEvents(ADDRESS, { onEvent: () => undefined })).rejects.toMatchObject({
      code: 'bad_response',
      status: 502,
    });
  });
});

describe('createReport', () => {
  it('posts JSON and returns the report', async () => {
    const { fn, calls } = mockFetch(() => json(report()));
    vi.stubGlobal('fetch', fn);
    const result = await createReport({
      address: ADDRESS,
      currency: 'USD',
      labels: [{ eventId: 'a', label: 'income' }],
    });
    expect(result.totals.gain).toBe('12.50');
    expect(calls[0]?.url).toBe('http://api.test/reports');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      address: ADDRESS,
      currency: 'USD',
      labels: [{ eventId: 'a', label: 'income' }],
    });
  });

  it('keeps the row details of an invalid price file', async () => {
    const details = [{ row: 2, column: 'date', message: 'Must be a real date' }];
    vi.stubGlobal(
      'fetch',
      mockFetch(() =>
        json(
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
    await expect(createReport({ address: ADDRESS, currency: 'USD' })).rejects.toMatchObject({
      code: 'invalid_price_csv',
      details,
    });
  });

  it('rejects an answer with the wrong shape', async () => {
    vi.stubGlobal('fetch', mockFetch(() => json({ hello: 'world' })).fn);
    await expect(createReport({ address: ADDRESS, currency: 'USD' })).rejects.toMatchObject({
      code: 'bad_response',
    });
    vi.stubGlobal('fetch', mockFetch(() => new Response('nope')).fn);
    await expect(createReport({ address: ADDRESS, currency: 'USD' })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });
});
