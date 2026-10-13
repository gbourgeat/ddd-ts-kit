import { describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  InMemoryProcessStore,
  UnreadableProcessStateError,
  type StoredProcess,
} from '../src/index.js';

const instance = (version: number): StoredProcess => ({
  name: 'billing.dunning',
  id: 'invoice-1',
  state: { stage: 'reminded', at: new Date('2026-03-01T10:00:00.000Z') },
  version,
  ended: false,
  timeouts: { 'second-reminder': 'job-7' },
});

describe('the process store in memory', () => {
  it('keeps an instance as JSON, and lists what it holds', async () => {
    const store = new InMemoryProcessStore();

    await store.save(instance(1));

    expect(await store.load('billing.dunning', 'invoice-1')).toEqual({
      ...instance(1),
      state: { stage: 'reminded', at: '2026-03-01T10:00:00.000Z' },
    });

    expect(await store.load('billing.dunning', 'invoice-2')).toBe(undefined);
    expect(store.list().map(({ version }) => version)).toEqual([1]);
  });

  it('refuses a version that is not the next one', async () => {
    const store = new InMemoryProcessStore();

    await store.save(instance(1));

    await expect(store.save(instance(1))).rejects.toThrow(ConcurrencyError);
    await expect(store.save({ ...instance(2), state: undefined })).resolves.toBe(undefined);
    expect((await store.load('billing.dunning', 'invoice-1'))?.state).toBe(null);
  });

  it('names a state it cannot read', () => {
    expect(new UnreadableProcessStateError('billing.dunning', 'invoice-1')).toMatchObject({
      code: 'UNREADABLE_PROCESS_STATE',
    });
  });
});
