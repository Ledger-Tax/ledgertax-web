'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createReport, streamEvents } from '../lib/api';
import type { ApiEvent, LabelKind, ReportResponse } from '../lib/api-types';
import { LabelStore } from '../lib/labels-store';
import type { LabelMap, StorageLike } from '../lib/labels-store';
import { AddressForm } from './AddressForm';
import { EventsView } from './EventsView';
import type { EventsState } from './EventsView';
import { PricesPanel } from './PricesPanel';
import type { PanelError } from './PricesPanel';
import { ReportView } from './ReportView';

/** Props of {@link Workbench}. */
export interface WorkbenchProps {
  /** Replacement label storage, for tests. */
  storage?: () => StorageLike | undefined;
}

function toPanelError(error: unknown): PanelError {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return { code: 'unknown', message: 'Something went wrong. Please try again.' };
}

/**
 * The whole flow on one page: enter an address, review the events, relabel them (labels stay in this
 * browser), supply prices and download the reports.
 */
export function Workbench({ storage }: WorkbenchProps) {
  const store = useMemo(() => new LabelStore(storage), [storage]);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<EventsState>({ status: 'idle' });
  const [labels, setLabels] = useState<LabelMap>({});
  const [report, setReport] = useState<ReportResponse | undefined>(undefined);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<PanelError | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);

  const load = useCallback(
    async (target: string): Promise<void> => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setAddress(target);
      setReport(undefined);
      setReportError(undefined);
      setLabels(store.load(target));
      setEvents({ status: 'loading', count: 0 });
      const collected: ApiEvent[] = [];
      try {
        await streamEvents(target, {
          signal: controller.signal,
          onEvent: (e) => {
            collected.push(e);
            if (collected.length % 25 === 0)
              setEvents({ status: 'loading', count: collected.length });
          },
        });
        setEvents({ status: 'ready', events: collected });
      } catch (error) {
        if (controller.signal.aborted) return;
        const e = toPanelError(error);
        setEvents({ status: 'error', code: e.code, message: e.message });
      }
    },
    [store],
  );

  useEffect(() => () => abort.current?.abort(), []);

  function handleLabel(eventId: string, label: LabelKind | undefined): void {
    if (!address) return;
    setLabels(store.set(address, eventId, label));
  }

  async function handleGenerate(input: {
    priceCsv: string | undefined;
    currency: string;
  }): Promise<void> {
    if (!address) return;
    setReportBusy(true);
    setReportError(undefined);
    try {
      const result = await createReport({
        address,
        currency: input.currency,
        ...(input.priceCsv !== undefined ? { priceCsv: input.priceCsv } : {}),
        labels: Object.values(labels),
      });
      setReport(result);
    } catch (error) {
      setReport(undefined);
      setReportError(toPanelError(error));
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="workbench">
      <AddressForm onSubmit={(a) => void load(a)} busy={events.status === 'loading'} />
      <EventsView
        state={events}
        labels={labels}
        onLabel={handleLabel}
        {...(address ? { onRetry: () => void load(address) } : {})}
      />
      {events.status === 'ready' ? (
        <PricesPanel
          busy={reportBusy}
          error={reportError}
          labelCount={Object.keys(labels).length}
          onGenerate={(i) => void handleGenerate(i)}
        />
      ) : null}
      {report ? <ReportView report={report} /> : null}
    </div>
  );
}
