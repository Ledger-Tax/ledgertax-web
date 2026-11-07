'use client';

import { useEffect, useId, useState } from 'react';
import type { ReportResponse } from '../lib/api-types';
import { shortAsset } from '../lib/format';

/** Props of {@link ReportView}. */
export interface ReportViewProps {
  report: ReportResponse;
}

/** Makes a link target for a CSV text: a blob URL where the browser supports it, else a data URL. */
function csvUrl(text: string): { url: string; revoke: () => void } {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }
  return {
    url: `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`,
    revoke: () => undefined,
  };
}

/**
 * Shows a finished report: how it was made, the totals, a plain preview of the gains, every problem
 * as a visible row, and download links for the two CSV files.
 */
export function ReportView({ report }: ReportViewProps) {
  const titleId = useId();
  const [links, setLinks] = useState<{ events: string; gains: string } | undefined>(undefined);

  useEffect(() => {
    const events = csvUrl(report.files.eventsCsv);
    const gains = csvUrl(report.files.gainsCsv);
    setLinks({ events: events.url, gains: gains.url });
    return () => {
      events.revoke();
      gains.revoke();
    };
  }, [report]);

  return (
    <section aria-labelledby={titleId} className="panel">
      <h2 id={titleId}>Report</h2>
      <p>
        <strong>Accounting export, not tax advice.</strong>
      </p>
      <dl className="facts">
        <dt>Method</dt>
        <dd>{report.method.toUpperCase()}</dd>
        <dt>Currency</dt>
        <dd>{report.currency}</dd>
        <dt>History source</dt>
        <dd>{report.source.description}</dd>
        <dt>History range</dt>
        <dd>{report.source.range}</dd>
        <dt>Events</dt>
        <dd>
          {report.counts.events} ({report.counts.unknownEvents} not understood)
        </dd>
        <dt>Total gain of the calculated rows</dt>
        <dd>
          {report.totals.gain} {report.currency}
        </dd>
      </dl>

      {report.issues.length > 0 ? (
        <div role="region" aria-label="Problems" className="error-panel">
          <p>
            <strong>
              {report.issues.length} row{report.issues.length === 1 ? '' : 's'} could not be
              calculated
            </strong>{' '}
            and {report.issues.length === 1 ? 'is' : 'are'} not in the total:
          </p>
          <ul>
            {report.issues.map((i, n) => (
              <li key={`${i.eventId}-${n}`}>
                <code>{i.code}</code> on {i.time.slice(0, 10)}
                {i.asset ? ` (${shortAsset(i.asset)})` : ''}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length > 0 ? (
        <ul className="muted">
          {report.warnings.map((w) => (
            <li key={w.asset}>
              {w.quantity} {shortAsset(w.asset)} left through fees or transfers without known lots.
            </li>
          ))}
        </ul>
      ) : null}

      {/* WAVE-ISSUE(web-2): a preview with totals by year replaces this plain gains table. */}
      {report.gains.length === 0 ? (
        <p role="status">No gains or losses were calculated.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Realised gains and losses</caption>
            <thead>
              <tr>
                <th scope="col">Acquired</th>
                <th scope="col">Disposed</th>
                <th scope="col">Asset</th>
                <th scope="col">Quantity</th>
                <th scope="col">Proceeds</th>
                <th scope="col">Cost</th>
                <th scope="col">Gain</th>
                <th scope="col">Days held</th>
              </tr>
            </thead>
            <tbody>
              {report.gains.slice(0, 200).map((g, n) => (
                <tr key={`${g.disposalEventId}-${g.acquisitionEventId}-${n}`}>
                  <td>{g.acquiredAt.slice(0, 10)}</td>
                  <td>{g.disposedAt.slice(0, 10)}</td>
                  <td>{shortAsset(g.asset)}</td>
                  <td>{g.quantity}</td>
                  <td>{g.proceeds}</td>
                  <td>{g.costBasis}</td>
                  <td>{g.gain}</td>
                  <td>{g.holdingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.gains.length > 200 ? (
            <p className="muted">
              Showing the first 200 of {report.gains.length} rows. The CSV has all of them.
            </p>
          ) : null}
        </div>
      )}

      <p className="downloads">
        {links ? (
          <>
            <a href={links.gains} download="gains.csv" className="button">
              Download gains.csv
            </a>{' '}
            <a href={links.events} download="events.csv" className="button">
              Download events.csv
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
