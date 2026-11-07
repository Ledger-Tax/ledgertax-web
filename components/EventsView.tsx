'use client';

import { useId, useMemo, useState } from 'react';
import type { ApiEvent, EventType, LabelKind } from '../lib/api-types';
import { LABEL_NAMES, labelChoices } from '../lib/label-choices';
import type { LabelMap } from '../lib/labels-store';
import { formatUnits, shortAsset, shorten } from '../lib/format';

/** What the events view is showing. */
export type EventsState =
  | { status: 'idle' }
  | { status: 'loading'; count: number }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; events: ApiEvent[] };

/** Props of {@link EventsView}. */
export interface EventsViewProps {
  state: EventsState;
  labels: LabelMap;
  /** Sets (or clears, with `undefined`) the label of one event. */
  onLabel: (eventId: string, label: LabelKind | undefined) => void;
  /** Called by the retry button of the error state. */
  onRetry?: () => void;
}

const TYPE_NAMES: Record<EventType, string> = {
  payment_in: 'Payment in',
  payment_out: 'Payment out',
  trade: 'Trade',
  fee: 'Fee',
  account_funded: 'Account funded',
  account_merged: 'Account merged',
  claimable_claimed: 'Claimable balance claimed',
  unknown: 'Unknown',
};

function amountText(event: ApiEvent): string {
  if (event.type === 'trade' && event.amount && event.counterAmount) {
    return `${formatUnits(event.amount, event.decimals ?? 7)} ${shortAsset(event.asset)} → ${formatUnits(event.counterAmount, event.counterDecimals ?? 7)} ${shortAsset(event.counterAsset)}`;
  }
  if (event.amount)
    return `${formatUnits(event.amount, event.decimals ?? 7)} ${shortAsset(event.asset)}`;
  return '';
}

/**
 * Table of events with a type filter and a label selector per event. It always shows one of:
 * nothing yet, loading with progress, an error, an empty result, or the table. Events the classifier
 * did not understand are flagged, never hidden.
 */
export function EventsView({ state, labels, onLabel, onRetry }: EventsViewProps) {
  const filterId = useId();
  const [filter, setFilter] = useState<'all' | EventType>('all');
  const events = state.status === 'ready' ? state.events : undefined;

  const types = useMemo(
    () => (events ? [...new Set(events.map((e) => e.type))].sort() : []),
    [events],
  );
  const shown = useMemo(
    () => (events ? events.filter((e) => filter === 'all' || e.type === filter) : []),
    [events, filter],
  );

  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    return (
      <p role="status" aria-live="polite" className="panel">
        Loading history… {state.count} event{state.count === 1 ? '' : 's'} so far.
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="panel error-panel">
        <p>
          <strong>Could not load the history.</strong> {state.message}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (state.events.length === 0) {
    return (
      <p role="status" className="panel">
        No events found for this address in the history the server holds. A new account, or one
        whose activity is older than the server keeps, shows nothing.
      </p>
    );
  }

  const unknownCount = state.events.filter((e) => e.type === 'unknown').length;

  return (
    <section aria-labelledby={`${filterId}-title`} className="panel">
      <h2 id={`${filterId}-title`}>Events ({state.events.length})</h2>
      {unknownCount > 0 ? (
        <p className="muted">
          {unknownCount} event{unknownCount === 1 ? ' was' : 's were'} not understood and are marked
          “Unknown”. They are kept, not guessed.
        </p>
      ) : null}
      <div className="row">
        <label htmlFor={filterId}>Show</label>
        <select
          id={filterId}
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | EventType)}
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_NAMES[t]}
            </option>
          ))}
        </select>
        <span className="muted" aria-live="polite">
          {shown.length} shown
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Classified events, oldest first</caption>
          <thead>
            <tr>
              <th scope="col">Time (UTC)</th>
              <th scope="col">Type</th>
              <th scope="col">Amount</th>
              <th scope="col">Counterparty</th>
              <th scope="col">Memo</th>
              <th scope="col">Label</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const choices = labelChoices(e);
              const current = labels[e.id]?.label;
              return (
                <tr key={e.id} className={e.type === 'unknown' ? 'row-unknown' : undefined}>
                  <td>{e.time.replace('T', ' ').replace('Z', '')}</td>
                  <td>
                    <span className={`badge badge-${e.type}`}>{TYPE_NAMES[e.type]}</span>
                    {e.type === 'unknown' ? (
                      <span className="muted">
                        {' '}
                        {e.opType ? `(${e.opType})` : ''}
                        <span className="sr-only"> not understood by the classifier</span>
                      </span>
                    ) : null}
                  </td>
                  <td>{amountText(e)}</td>
                  <td title={e.counterparty}>{shorten(e.counterparty)}</td>
                  <td>{e.memo ? <span title={e.memo}>{e.memo.slice(0, 40)}</span> : null}</td>
                  <td>
                    <select
                      aria-label={`Label for ${TYPE_NAMES[e.type]} at ${e.time}`}
                      value={current ?? ''}
                      onChange={(ev) =>
                        onLabel(
                          e.id,
                          ev.target.value === '' ? undefined : (ev.target.value as LabelKind),
                        )
                      }
                    >
                      <option value="">No label (default meaning)</option>
                      {choices.map((c) => (
                        <option key={c} value={c}>
                          {LABEL_NAMES[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* WAVE-ISSUE(web-1): bulk relabel (select several events and label them at once) plugs in here. */}
    </section>
  );
}
