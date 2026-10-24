import { describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemorySubjectKeyStore,
  InMemoryUnitOfWork,
} from '@ddd-ts-kit/kernel';
import { eraseDataSubject } from '@/platform/erasure/erase-data-subject';
import { NotASubjectIdError } from '@/platform/erasure/not-a-subject-id-error';
import { UnknownDataSubjectError } from '@/platform/erasure/unknown-data-subject-error';
import type { StoreFedProjection } from '@/platform/event-store/store-fed-projections';

describe('eraseDataSubject', () => {
  it('destroys the key of the subject, then rebuilds every projection fed by the store', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-1');

    const erasure = await eraseDataSubject('patient-1', {
      keys,
      projections: [projection('scheduling.history', 4, order), projection('scheduling.counts', 7, order)],
    });

    expect(erasure).toEqual({ erased: true, copies: {}, rebuilt: { 'scheduling.history': 4, 'scheduling.counts': 7 } });
    expect(order).toEqual(['scheduling.history', 'scheduling.counts']);
  });

  it('rebuilds again for a subject already erased, which completes an erasure whose rebuild failed', async () => {
    const order: string[] = [];

    const erasure = await eraseDataSubject('patient-2', {
      keys: new InMemorySubjectKeyStore(),
      projections: [projection('scheduling.history', 0, order)],
    });

    expect(erasure).toEqual({ erased: false, copies: {}, rebuilt: { 'scheduling.history': 0 } });
    expect(order).toEqual(['scheduling.history']);
  });

  it('refuses a subject that is not an opaque identifier before any key is touched: a name or an email', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];
    const pasted = await keys.keyFor('Ada Lovelace');

    await expect(
      eraseDataSubject('Ada Lovelace', { keys, projections: [projection('scheduling.history', 0, order)] }),
    ).rejects.toThrow(NotASubjectIdError);

    await expect(
      eraseDataSubject('ada@example.org', { keys, projections: [projection('scheduling.history', 0, order)] }),
    ).rejects.toThrow(NotASubjectIdError);

    await expect(keys.find(pasted.id)).resolves.toEqual(pasted);
    expect(order).toEqual([]);
  });

  it('refuses an id that destroys no key and that nobody knows, before any rebuild', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patinet-1', {
        keys: new InMemorySubjectKeyStore(),
        projections: [projection('scheduling.history', 0, order)],
        isKnown: async () => false,
      }),
    ).rejects.toThrow(UnknownDataSubjectError);

    expect(order).toEqual([]);
  });

  it('erases a subject nobody knows any more, as long as it has a key: the key comes first, the record after', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-gone');

    const erasure = await eraseDataSubject('patient-gone', {
      keys,
      projections: [projection('scheduling.history', 2, order)],
      isKnown: async () => false,
    });

    expect(erasure).toEqual({ erased: true, copies: {}, rebuilt: { 'scheduling.history': 2 } });
    expect(order).toEqual(['scheduling.history']);
  });

  it('rebuilds even when the erasure fails, since its key may be gone already, then throws its failure', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patient-3', {
        keys: new UnrecordedErasureKeyStore(),
        projections: [projection('scheduling.history', 0, order)],
      }),
    ).rejects.toThrow('audit database unreachable');

    expect(order).toEqual(['scheduling.history']);
  });
});

describe('eraseDataSubject, the copies the contexts keep of the person', () => {
  it('erases every copy once per network, after the key and before the rebuilds, and counts the rows of each', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-4');

    const erasure = await eraseDataSubject('patient-4', {
      keys,
      projections: [projection('scheduling.history', 1, order)],
      copies: [copy('identity.persons', 1, order), copy('scheduling.patient', 3, order)],
      inEveryNetwork: inNetworks(['acme', 'north'], order),
    });

    expect(erasure).toEqual({
      erased: true,
      copies: { 'identity.persons': 2, 'scheduling.patient': 6 },
      rebuilt: { 'scheduling.history': 1 },
    });

    expect(order).toEqual([
      'acme',
      'identity.persons',
      'north',
      'identity.persons',
      'acme',
      'scheduling.patient',
      'north',
      'scheduling.patient',
      'scheduling.history',
    ]);
  });

  it('takes a subject whose copies alone are left for a run again, not for a mistyped id', async () => {
    const order: string[] = [];

    const erasure = await eraseDataSubject('patient-5', {
      keys: new InMemorySubjectKeyStore(),
      projections: [projection('scheduling.history', 0, order)],
      copies: [copy('notification.contacts', 1, order)],
      isKnown: async () => false,
    });

    expect(erasure).toEqual({
      erased: false,
      copies: { 'notification.contacts': 1 },
      rebuilt: { 'scheduling.history': 0 },
    });
  });

  it('runs the other copies and the rebuilds when one copy fails, then throws that failure: running again completes', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patient-6', {
        keys: new InMemorySubjectKeyStore(),
        projections: [projection('scheduling.history', 0, order)],
        copies: [failingCopy('identity.persons'), copy('notification.contacts', 1, order)],
        isKnown: async () => false,
      }),
    ).rejects.toThrow('identity unreachable');

    expect(order).toEqual(['notification.contacts', 'scheduling.history']);
  });
});

function copy(name: string, rows: number, order: string[]) {
  return {
    name,
    erase: async () => {
      order.push(name);

      return rows;
    },
  };
}

function failingCopy(name: string) {
  return { name, erase: () => Promise.reject(new Error('identity unreachable')) };
}

/** Runs the work once per network, naming the network before, as the command line does with the execution scope. */
function inNetworks(networks: readonly string[], order: string[]) {
  return async (work: () => Promise<number>): Promise<number> => {
    let total = 0;

    for (const network of networks) {
      order.push(network);
      total += await work();
    }

    return total;
  };
}

/** A key store that destroys the key, then fails, as the audited store does when its entry cannot be written. */
class UnrecordedErasureKeyStore extends InMemorySubjectKeyStore {
  override async erase(subject: string): Promise<boolean> {
    await super.erase(subject);

    throw new Error('audit database unreachable');
  }
}

function projection(name: string, replayed: number, order: string[]): StoreFedProjection {
  return {
    name,
    subscription: new CatchUpSubscription({
      name,
      store: new InMemoryEventStore(),
      checkpoints: new InMemoryCheckpointStore(),
      unitOfWork: new InMemoryUnitOfWork(),
      apply: async () => undefined,
    }),
    rebuild: async () => {
      order.push(name);

      return { replayed };
    },
  };
}
