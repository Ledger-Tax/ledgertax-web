import type { ApiLabel } from './api-types';

/** Labels by event id for one address. */
export type LabelMap = Record<string, ApiLabel>;

const PREFIX = 'ledgertax:labels:';
const VALID = new Set(['income', 'disposal', 'transfer', 'gift', 'ignore']);

/** Minimal storage interface so tests can supply one. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Keeps the user's labels in the browser only (never sent to the server except inside a report
 * request). Every read and write is guarded: if storage is missing, blocked or full, labels live in
 * memory for the session and the app keeps working.
 */
export class LabelStore {
  private readonly memory = new Map<string, LabelMap>();
  private readonly getStorage: () => StorageLike | undefined;

  /** @param getStorage - returns the storage to use; defaults to `window.localStorage` */
  constructor(getStorage?: () => StorageLike | undefined) {
    this.getStorage =
      getStorage ??
      (() => {
        try {
          return typeof window === 'undefined' ? undefined : window.localStorage;
        } catch {
          return undefined;
        }
      });
  }

  /** Labels saved for an address (empty if none, or if storage is unreadable). */
  load(address: string): LabelMap {
    const cached = this.memory.get(address);
    if (cached) return { ...cached };
    try {
      const raw = this.getStorage()?.getItem(PREFIX + address);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        const map: LabelMap = {};
        if (parsed && typeof parsed === 'object') {
          for (const [id, value] of Object.entries(parsed)) {
            const v = value as Partial<ApiLabel> | null;
            if (v && typeof v.label === 'string' && VALID.has(v.label)) {
              map[id] = {
                eventId: id,
                label: v.label as ApiLabel['label'],
                ...(typeof v.note === 'string' ? { note: v.note.slice(0, 500) } : {}),
              };
            }
          }
        }
        this.memory.set(address, map);
        return { ...map };
      }
    } catch {
      // unreadable or corrupt storage: start empty
    }
    return {};
  }

  /** Sets or clears (label `undefined`) the label of one event, and saves. */
  set(
    address: string,
    eventId: string,
    label: ApiLabel['label'] | undefined,
    note?: string,
  ): LabelMap {
    const without = Object.fromEntries(
      Object.entries(this.load(address)).filter(([id]) => id !== eventId),
    );
    const map: LabelMap =
      label === undefined
        ? without
        : { ...without, [eventId]: { eventId, label, ...(note ? { note } : {}) } };
    this.memory.set(address, map);
    try {
      this.getStorage()?.setItem(PREFIX + address, JSON.stringify(map));
    } catch {
      // storage full or blocked: the labels stay in memory
    }
    return { ...map };
  }

  /** Removes every saved label of an address. */
  clear(address: string): void {
    this.memory.delete(address);
    try {
      this.getStorage()?.removeItem(PREFIX + address);
    } catch {
      // nothing to do
    }
  }
}
