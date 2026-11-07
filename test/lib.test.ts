import { describe, expect, it } from 'vitest';
import { checkAddress } from '../lib/address';
import { formatUnits, shortAsset, shorten } from '../lib/format';
import { labelChoices } from '../lib/label-choices';
import { LabelStore } from '../lib/labels-store';
import type { StorageLike } from '../lib/labels-store';
import { ADDRESS, ISSUER, SECRET_SHAPED, event } from './helpers';

describe('formatUnits', () => {
  it('formats with BigInt, never floating point', () => {
    expect(formatUnits('15000000', 7)).toBe('1.5');
    expect(formatUnits('1', 7)).toBe('0.0000001');
    expect(formatUnits('100000000000', 7)).toBe('10000');
    expect(formatUnits('0', 7)).toBe('0');
    expect(formatUnits('-25', 2)).toBe('-0.25');
    expect(formatUnits('123456789012345678901234567890', 7)).toBe('12345678901234567890123.456789');
  });
  it('returns the text unchanged when it is not a whole number', () => {
    expect(formatUnits('1.5', 7)).toBe('1.5');
    expect(formatUnits('abc', 7)).toBe('abc');
    expect(formatUnits('10', -1)).toBe('10');
  });
});

describe('display helpers', () => {
  it('shortens assets and long values', () => {
    expect(shortAsset('native')).toBe('XLM');
    expect(shortAsset(`TEST:${ISSUER}`)).toBe('TEST (GBBB…BBBB)');
    expect(shortAsset(undefined)).toBe('');
    expect(shorten(ADDRESS)).toBe('GAAAAA…AAAAAA');
    expect(shorten('short')).toBe('short');
  });
});

describe('checkAddress', () => {
  it('accepts a public address and a muxed address, trimming spaces', () => {
    expect(checkAddress(` ${ADDRESS} `)).toEqual({ kind: 'ok', address: ADDRESS });
    expect(checkAddress(`M${'A'.repeat(68)}`).kind).toBe('ok');
  });
  it('flags empty and invalid input', () => {
    expect(checkAddress('   ').kind).toBe('empty');
    for (const bad of ['hello', 'G123', `g${'a'.repeat(55)}`, `G${'1'.repeat(55)}`]) {
      expect(checkAddress(bad).kind, bad).toBe('invalid');
    }
  });
  it('flags anything shaped like a secret key, in any letter case', () => {
    expect(checkAddress(SECRET_SHAPED).kind).toBe('secret');
    expect(checkAddress(SECRET_SHAPED.toLowerCase()).kind).toBe('secret');
  });
});

describe('labelChoices', () => {
  it('offers labels that fit the event, like the API does', () => {
    expect(labelChoices(event({ type: 'payment_in' }))).toEqual([
      'income',
      'transfer',
      'gift',
      'ignore',
    ]);
    expect(labelChoices(event({ type: 'payment_out' }))).toEqual([
      'disposal',
      'transfer',
      'gift',
      'ignore',
    ]);
    expect(labelChoices(event({ type: 'account_merged', direction: 'in' }))).toContain('income');
    expect(labelChoices(event({ type: 'account_merged', direction: 'out' }))).toContain('disposal');
    for (const type of ['trade', 'fee', 'unknown'] as const) {
      expect(labelChoices(event({ type }))).toEqual(['ignore']);
    }
  });
});

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('LabelStore', () => {
  it('saves and reloads labels per address, and clears them', () => {
    const storage = memoryStorage();
    const a = new LabelStore(() => storage);
    a.set(ADDRESS, 'e1', 'income', 'a note');
    a.set(ADDRESS, 'e2', 'disposal');
    a.set(ADDRESS, 'e2', undefined);
    const fresh = new LabelStore(() => storage); // a new page load
    expect(fresh.load(ADDRESS)).toEqual({ e1: { eventId: 'e1', label: 'income', note: 'a note' } });
    expect(fresh.load(ISSUER)).toEqual({});
    fresh.clear(ADDRESS);
    expect(new LabelStore(() => storage).load(ADDRESS)).toEqual({});
  });

  it('keeps working in memory when storage is missing, blocked or full', () => {
    const none = new LabelStore(() => undefined);
    expect(none.set(ADDRESS, 'e1', 'gift')).toEqual({ e1: { eventId: 'e1', label: 'gift' } });
    expect(none.load(ADDRESS)['e1']?.label).toBe('gift');

    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = new LabelStore(() => broken);
    expect(store.load(ADDRESS)).toEqual({});
    expect(store.set(ADDRESS, 'e1', 'income')['e1']?.label).toBe('income');
    expect(() => store.clear(ADDRESS)).not.toThrow();
    const throwing = new LabelStore(() => {
      throw new Error('no storage at all');
    });
    expect(throwing.load(ADDRESS)).toEqual({});
  });

  it('ignores corrupt data and labels it does not know', () => {
    const storage = memoryStorage();
    storage.data.set(`ledgertax:labels:${ADDRESS}`, '{not json');
    expect(new LabelStore(() => storage).load(ADDRESS)).toEqual({});
    storage.data.set(
      `ledgertax:labels:${ISSUER}`,
      JSON.stringify({ a: { label: 'sale' }, b: { label: 'income' }, c: 5, d: null }),
    );
    expect(new LabelStore(() => storage).load(ISSUER)).toEqual({
      b: { eventId: 'b', label: 'income' },
    });
  });
});
