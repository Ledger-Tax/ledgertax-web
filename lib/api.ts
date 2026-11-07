import type { ApiEvent, ReportRequest, ReportResponse } from './api-types';

/** An error answered by the API, or a failure to reach it. */
export class ApiError extends Error {
  /** The API's error code, or `network` / `not_configured` / `bad_response` for client-side problems. */
  readonly code: string;
  readonly status: number;
  /** Extra detail from the API (for example price file rows). */
  readonly details: unknown;
  /** Cursor from the API for a stream that failed part-way. */
  readonly cursor: string | undefined;

  constructor(code: string, message: string, status = 0, details?: unknown, cursor?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.cursor = cursor;
  }
}

/** Base URL of the API, from NEXT_PUBLIC_API_URL at build time. Empty if not configured. */
export function apiBaseUrl(): string {
  return (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');
}

interface ErrorShape {
  error?: { code?: unknown; message?: unknown; details?: unknown; cursor?: unknown };
}

function toApiError(body: unknown, status: number): ApiError {
  const e = (body as ErrorShape | null)?.error;
  if (e && typeof e.code === 'string' && typeof e.message === 'string') {
    return new ApiError(
      e.code,
      e.message,
      status,
      e.details,
      typeof e.cursor === 'string' ? e.cursor : undefined,
    );
  }
  return new ApiError(
    'bad_response',
    'The server sent an answer this app does not understand.',
    status,
  );
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const base = apiBaseUrl();
  if (base === '') {
    throw new ApiError(
      'not_configured',
      'The API address is not configured (NEXT_PUBLIC_API_URL).',
    );
  }
  try {
    return await fetch(`${base}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'network',
      'Could not reach the server. Check your connection and the API address.',
    );
  }
}

async function failFrom(res: Response): Promise<never> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  throw toApiError(body, res.status);
}

/** Options for {@link streamEvents}. */
export interface StreamOptions {
  since?: string;
  signal?: AbortSignal;
  /** Called with each event as it arrives (for progress). */
  onEvent: (event: ApiEvent) => void;
}

/**
 * Reads the events of an address as a stream (NDJSON), so progress can be shown for long histories.
 *
 * @returns the number of events
 * @throws ApiError for API errors, including an error line at the end of a stream (with its cursor)
 */
export async function streamEvents(address: string, options: StreamOptions): Promise<number> {
  const query = new URLSearchParams({ address, format: 'ndjson' });
  if (options.since) query.set('since', options.since);
  const init: RequestInit = { headers: { accept: 'application/x-ndjson' } };
  if (options.signal) init.signal = options.signal;
  const res = await request(`/events?${query.toString()}`, init);
  if (!res.ok) return failFrom(res);

  let count = 0;
  let finished = false;
  const handle = (line: string): void => {
    if (line.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new ApiError('bad_response', 'The event stream contained a line that is not JSON.');
    }
    const obj = parsed as { event?: ApiEvent; done?: boolean; count?: number } & ErrorShape;
    if (obj.event) {
      count += 1;
      options.onEvent(obj.event);
    } else if (obj.done) finished = true;
    else if (obj.error) throw toApiError(obj, 200);
  };

  const body = res.body;
  if (body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
      }
    }
    handle(buffer);
  } else {
    for (const line of (await res.text()).split('\n')) handle(line);
  }
  if (!finished)
    throw new ApiError('bad_response', 'The event stream ended without a completion marker.');
  return count;
}

/**
 * Asks the API for a report. Prices and labels are sent with the request and are not stored by the server.
 *
 * @throws ApiError, with `details` holding price file rows for `invalid_price_csv`
 */
export async function createReport(
  body: ReportRequest,
  signal?: AbortSignal,
): Promise<ReportResponse> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  if (signal) init.signal = signal;
  const res = await request('/reports', init);
  if (!res.ok) return failFrom(res);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('bad_response', 'The report answer was not JSON.', res.status);
  }
  const r = json as Partial<ReportResponse>;
  if (!r.files || typeof r.files.gainsCsv !== 'string' || !Array.isArray(r.gains)) {
    throw new ApiError('bad_response', 'The report answer has an unexpected shape.', res.status);
  }
  return r as ReportResponse;
}
