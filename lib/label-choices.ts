import type { ApiEvent, LabelKind } from './api-types';

/** Display names of the labels. */
export const LABEL_NAMES: Record<LabelKind, string> = {
  income: 'Income (acquired at the price I supply)',
  disposal: 'Disposal (a sale at the price I supply)',
  transfer: 'Transfer (no gain)',
  gift: 'Gift (no gain)',
  ignore: 'Ignore (leave out of the calculation)',
};

const INFLOW: ApiEvent['type'][] = ['payment_in', 'account_funded', 'claimable_claimed'];

/**
 * Labels that make sense for an event. They mirror the rules of the API: an incoming movement can be
 * income, a transfer or a gift; an outgoing one a disposal, a transfer or a gift; anything else can
 * only be ignored. The API ignores a label that does not fit and reports it.
 */
export function labelChoices(event: ApiEvent): LabelKind[] {
  const inflow =
    INFLOW.includes(event.type) || (event.type === 'account_merged' && event.direction === 'in');
  const outflow =
    event.type === 'payment_out' || (event.type === 'account_merged' && event.direction === 'out');
  if (inflow) return ['income', 'transfer', 'gift', 'ignore'];
  if (outflow) return ['disposal', 'transfer', 'gift', 'ignore'];
  return ['ignore'];
}
