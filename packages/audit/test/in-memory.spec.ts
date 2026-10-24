import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAuditTrail } from '../src';
import { archiveSpecs } from './support/archive-specs';
import { auditTrailContract } from '../src/testing';

const runner = { describe, it, expect, beforeEach };

let trail: InMemoryAuditTrail;

auditTrailContract(runner, {
  name: 'InMemoryAuditTrail',
  createTrail: () => {
    trail = new InMemoryAuditTrail();

    return trail;
  },
  tamper: (entry, action) => {
    const index = trail.entries.findIndex((stored) => stored.id === entry.id);

    trail.entries[index] = { ...entry, action };
  },
});

describe('InMemoryAuditTrail', () => {
  it('chains by what chainOf answers when one is given', async () => {
    const perContext = new InMemoryAuditTrail({ chainOf: (record) => record.context ?? 'none' });

    const record = {
      id: 'entry-1',
      occurredAt: new Date(0),
      category: 'command',
      action: 'A',
      outcome: 'succeeded',
      correlationId: 'c',
      origin: 'cli',
    } as const;

    await perContext.record({ ...record, actor: { id: 'ada', type: 'user' }, context: 'billing' });

    expect(perContext.entries.map((entry) => entry.chain)).toEqual(['billing']);
  });

  it('refuses a cursor it did not give', async () => {
    const reading = new InMemoryAuditTrail().search(
      {},
      { kind: 'cursor', cursor: 'not-a-cursor', limit: 10, sort: [] },
    );

    await expect(reading).rejects.toMatchObject({ code: 'INVALID_PAGE_REQUEST' });
  });
});

archiveSpecs('InMemoryAuditTrail', async () => {
  const archivable = new InMemoryAuditTrail();

  return {
    trail: archivable,
    tamper: async (id) => {
      const index = archivable.entries.findIndex((entry) => entry.id === id);
      const entry = archivable.entries[index];

      if (entry !== undefined) {
        archivable.entries.splice(index, 1, { ...entry, action: 'forged' });
      }
    },
  };
});
