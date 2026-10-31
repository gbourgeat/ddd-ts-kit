import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { InMemoryAuditTrail, verifyTrail } from '../src';
import { archiveSpecs } from './support/archive-specs';
import { archivableAuditTrailContract, auditTrailContract } from '../src/testing';

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
  cut: (chain, fromSequence) => {
    const kept = trail.entries.filter((entry) => entry.chain !== chain || entry.sequence < fromSequence);

    trail.entries.splice(0, trail.entries.length, ...kept);
  },
});

// A store of its own may give no way to cut its tail: the contract runs without it too.
archivableAuditTrailContract(runner, {
  name: 'InMemoryAuditTrail, given no way to cut its tail',
  createTrail: () => new InMemoryAuditTrail(),
});

archivableAuditTrailContract(runner, {
  name: 'InMemoryAuditTrail',
  createTrail: () => {
    trail = new InMemoryAuditTrail();

    return trail;
  },
  cut: (chain, fromSequence) => {
    const kept = trail.entries.filter((entry) => entry.chain !== chain || entry.sequence < fromSequence);

    trail.entries.splice(0, trail.entries.length, ...kept);
  },
});

describe('InMemoryAuditTrail', () => {
  it('reports an archive whose file is not lines of JSON, though it has the digest its row records', async () => {
    const archived = new InMemoryAuditTrail();
    const files = new InMemoryFileStorage();
    const text = 'not json\n';

    await archived.record({
      id: 'entry-1',
      occurredAt: new Date(0),
      category: 'command',
      action: 'A',
      outcome: 'succeeded',
      actor: { id: 'ada', type: 'user' },
      correlationId: 'c',
      origin: 'cli',
      tenantId: 'acme',
    });

    archived.archives.push({
      chain: 'tenant:acme',
      fromSequence: 1,
      toSequence: 1,
      lastHash: (await archived.chainHeads())[0]?.hash ?? '',
      entries: 1,
      fileKey: 'audit-archives/one.ndjson',
      fileDigest: createHash('sha256').update(text, 'utf8').digest('hex'),
      archivedAt: new Date(0),
    });

    await files.put('audit-archives/one.ndjson', Readable.from([Buffer.from(text)]), {
      mediaType: 'application/x-ndjson',
    });

    expect((await verifyTrail(archived, { files })).breaks).toEqual([
      { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 1 },
    ]);
  });

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
    cut: async (chain, fromSequence) => {
      const kept = archivable.entries.filter((entry) => entry.chain !== chain || entry.sequence < fromSequence);

      archivable.entries.splice(0, archivable.entries.length, ...kept);
    },
    forgeArchive: async (archive) => {
      archivable.archives.push(archive);
    },
    removeCovered: async (chain, toSequence) => {
      const kept = archivable.entries.filter((entry) => entry.chain !== chain || entry.sequence > toSequence);

      archivable.entries.splice(0, archivable.entries.length, ...kept);
    },
  };
});
