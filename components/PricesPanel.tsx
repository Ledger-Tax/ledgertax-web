'use client';

import { useId, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

/** The part of an API error this panel can show. */
export interface PanelError {
  code: string;
  message: string;
  details?: unknown;
}

/** Props of {@link PricesPanel}. */
export interface PricesPanelProps {
  busy: boolean;
  error: PanelError | undefined;
  /** How many labels will be sent with the request (for the user's information). */
  labelCount: number;
  onGenerate: (input: { priceCsv: string | undefined; currency: string }) => void;
}

const MAX_BYTES = 1_048_576;

/** Reads a File as text (File.text() where it exists, FileReader otherwise). */
export function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

interface RowIssue {
  row: number;
  column?: string;
  message: string;
}

function rowIssues(details: unknown): RowIssue[] {
  if (!Array.isArray(details)) return [];
  return details.filter(
    (d): d is RowIssue =>
      !!d && typeof (d as RowIssue).row === 'number' && typeof (d as RowIssue).message === 'string',
  );
}

/**
 * Lets the user choose a currency and upload a price file (`asset,date,price,currency`), then ask for
 * a report. The file is read in the browser and sent with the request; the server does not keep it.
 */
export function PricesPanel({ busy, error, labelCount, onGenerate }: PricesPanelProps) {
  const fileId = useId();
  const currencyId = useId();
  const [csv, setCsv] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState('');
  const [localError, setLocalError] = useState('');
  const [currency, setCurrency] = useState('USD');

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    setLocalError('');
    if (!file) {
      setCsv(undefined);
      setFileName('');
      return;
    }
    if (file.size > MAX_BYTES) {
      setCsv(undefined);
      setFileName('');
      setLocalError('That file is larger than 1 MiB. Use a smaller price file.');
      return;
    }
    try {
      setCsv(await readFileText(file));
      setFileName(file.name);
    } catch {
      setCsv(undefined);
      setFileName('');
      setLocalError('The file could not be read.');
    }
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setLocalError('Enter a currency as three capital letters, for example USD.');
      return;
    }
    setLocalError('');
    onGenerate({ priceCsv: csv, currency });
  }

  const issues = error?.code === 'invalid_price_csv' ? rowIssues(error.details) : [];

  return (
    <form onSubmit={handleSubmit} className="panel" noValidate aria-labelledby={`${fileId}-title`}>
      <h2 id={`${fileId}-title`}>Prices and report</h2>
      <p className="muted">
        Prices are yours: a CSV with the header <code>asset,date,price,currency</code>, one price
        per asset per day. A missing price becomes an error row in the report, never a guess. The
        file and your {labelCount} label{labelCount === 1 ? '' : 's'} are sent with the request and
        not stored on the server.
      </p>
      <div className="field">
        <label htmlFor={fileId}>Price file (CSV)</label>
        <input
          id={fileId}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void handleFile(e)}
        />
        {fileName ? <span className="muted">Using {fileName}</span> : null}
      </div>
      <div className="field">
        <label htmlFor={currencyId}>Currency</label>
        <input
          id={currencyId}
          type="text"
          value={currency}
          maxLength={3}
          autoComplete="off"
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Working…' : 'Generate report'}
      </button>
      <div role="alert" className="error-text">
        {localError || (error && issues.length === 0 ? error.message : '')}
      </div>
      {issues.length > 0 ? (
        <div role="alert" className="error-panel">
          <p>The price file has problems:</p>
          <ul>
            {issues.slice(0, 50).map((i, n) => (
              <li key={`${i.row}-${n}`}>
                Line {i.row}
                {i.column ? ` (${i.column})` : ''}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
