import { describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemorySubjectKeyStore,
  InMemoryUnitOfWork,
} from '@ddd-ts-kit/kernel';
import { eraseDataSubject } from '@/platform/events/erase-data-subject';
import type { StoreFedProjection } from '@/platform/events/store-fed-projections';

describe('eraseDataSubject', () => {
  it('destroys the key of the subject, then rebuilds every projection fed by the store', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-1');

    const erasure = await eraseDataSubject('patient-1', {
      keys,
      projections: [projection('scheduling.history', 4, order), projection('scheduling.counts', 7, order)],
    });

    expect(erasure).toEqual({ erased: true, rebuilt: { 'scheduling.history': 4, 'scheduling.counts': 7 } });
    expect(order).toEqual(['scheduling.history', 'scheduling.counts']);
  });

  it('rebuilds again for a subject already erased, which completes an erasure whose rebuild failed', async () => {
    const order: string[] = [];

    const erasure = await eraseDataSubject('patient-2', {
      keys: new InMemorySubjectKeyStore(),
      projections: [projection('scheduling.history', 0, order)],
    });

    expect(erasure).toEqual({ erased: false, rebuilt: { 'scheduling.history': 0 } });
    expect(order).toEqual(['scheduling.history']);
  });
});

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
