import { describe, expect, it } from 'vitest';
import { InMemoryJobStore } from '@ddd-ts-kit/scheduling';
import { lazyJobStore } from '../src/kernel/lazy-job-store';
import { createApplication, kernelModule } from '../src';

describe('the lazy job store of the kernel module', () => {
  it('erases the jobs of a subject in the bound job store', async () => {
    const store = new InMemoryJobStore();
    const lazy = lazyJobStore(createApplication({ modules: [kernelModule({ jobStore: store })] }).resolve);
    const now = new Date('2026-03-02T10:00:00.000Z');
    const enqueuedBy = { correlationId: 'c', actor: { id: 'a', type: 'user' as const, roles: [], attributes: {} } };

    await lazy.add({
      id: 'job-1',
      name: 'billing.x',
      queue: 'billing',
      payload: {},
      subject: 'person-1',
      enqueuedBy,
      enqueuedAt: now,
      runAt: now,
    });

    expect(await lazy.eraseSubject('person-1')).toBe(1);
    expect(await store.find('job-1')).toBeUndefined();
  });
});
