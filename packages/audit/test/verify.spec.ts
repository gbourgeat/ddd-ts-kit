import { describe, expect, it } from 'vitest';
import {
  InMemoryAuditTrail,
  hashOf,
  verifyChain,
  type AuditCheckpoint,
  type AuditEntry,
  type AuditRecord,
} from '../src';

const CHAIN = 'tenant:acme';

function aRecord(id: string, tenantId = 'acme'): AuditRecord {
  return {
    id,
    occurredAt: new Date('2026-03-01T10:00:00.000Z'),
    category: 'command',
    action: 'CancelAppointmentCommand',
    outcome: 'succeeded',
    actor: { id: 'ada', type: 'user', tenantId },
    tenantId,
    correlationId: 'correlation-1',
    origin: 'http',
  };
}

async function aChain(length: number, tenantId = 'acme'): Promise<AuditEntry[]> {
  const trail = new InMemoryAuditTrail();

  for (let index = 1; index <= length; index += 1) {
    await trail.record(aRecord(`${tenantId}-${index}`, tenantId));
  }

  return trail.entries;
}

function nth(entries: readonly AuditEntry[], index: number): AuditEntry {
  const entry = entries[index];

  if (entry === undefined) {
    throw new Error(`The chain holds no entry at index ${index}`);
  }

  return entry;
}

function present(entries: readonly (AuditEntry | undefined)[]): AuditEntry[] {
  return entries.filter((entry) => entry !== undefined);
}

/** What somebody who can write to the store does: change the content and recompute the hashes after it. */
function rewrittenFrom(entries: readonly AuditEntry[], sequence: number): AuditEntry[] {
  const rewritten: AuditEntry[] = [];

  for (const entry of entries) {
    const previous = rewritten.at(-1);

    const forged =
      entry.sequence < sequence
        ? entry
        : { ...entry, action: 'ForgedCommand', previousHash: previous?.hash ?? entry.previousHash };

    rewritten.push({ ...forged, hash: hashOf(forged) });
  }

  return rewritten;
}

describe('verifyChain', () => {
  it('holds for an untouched chain, and for no entry at all', async () => {
    expect(await verifyChain(await aChain(5))).toEqual({ valid: true, checked: 5 });
    expect(await verifyChain([])).toEqual({ valid: true, checked: 0 });
  });

  it('reports altered content at the entry that no longer hashes to its hash', async () => {
    const entries = await aChain(5);

    entries[2] = { ...nth(entries, 2), reason: 'INVENTED' };

    expect(await verifyChain(entries)).toEqual({
      valid: false,
      checked: 2,
      break: { kind: 'altered-content', chain: CHAIN, position: 2, sequence: 3, entryId: 'acme-3' },
    });
  });

  it('reports altered content where an entry was rewritten with a hash of its own', async () => {
    const entries = await aChain(5);
    const forged = { ...nth(entries, 2), action: 'ForgedCommand' };

    entries[2] = { ...forged, hash: hashOf(forged) };

    const outcome = await verifyChain(entries);

    expect(outcome).toMatchObject({
      valid: false,
      break: { kind: 'altered-content', position: 3, sequence: 4, entryId: 'acme-4' },
    });
  });

  it('reports a missing entry where the sequence jumps', async () => {
    const entries = await aChain(5);

    entries.splice(2, 1);

    expect(await verifyChain(entries)).toEqual({
      valid: false,
      checked: 2,
      break: { kind: 'missing-entry', chain: CHAIN, position: 2, sequence: 3, entryId: 'acme-4' },
    });
  });

  it('reports a missing entry when the chain does not start at its first position', async () => {
    const [, ...headless] = await aChain(3);

    expect(await verifyChain(headless)).toMatchObject({
      valid: false,
      break: { kind: 'missing-entry', position: 0, sequence: 1 },
    });
  });

  it('reports a missing entry when the chain stops before the position asked for', async () => {
    const outcome = await verifyChain(await aChain(3), { to: 5 });

    expect(outcome).toEqual({
      valid: false,
      checked: 3,
      break: { kind: 'missing-entry', chain: CHAIN, position: 3, sequence: 4 },
    });
  });

  it('reports reordered entries, without sorting them back', async () => {
    const [first, second, third, fourth] = await aChain(4);

    const outcome = await verifyChain(present([first, third, second, fourth]));

    expect(outcome).toEqual({
      valid: false,
      checked: 1,
      break: { kind: 'reordered', chain: CHAIN, position: 1, sequence: 2, entryId: 'acme-3' },
    });
  });

  it('reports a position that appears twice as reordered: the chain forked', async () => {
    const [first, second] = await aChain(2);

    expect(await verifyChain(present([first, second, second]))).toMatchObject({
      valid: false,
      break: { kind: 'reordered', position: 2, sequence: 3 },
    });
  });
});

describe('verifyChain, ranges, several chains and readers', () => {
  it('examines only the positions asked for, trusting the entry before the first one', async () => {
    const entries = await aChain(6);

    entries[0] = { ...nth(entries, 0), reason: 'INVENTED' };

    expect(await verifyChain(entries, { from: 3, to: 5 })).toEqual({ valid: true, checked: 3 });
    expect(await verifyChain(entries, { to: 5 })).toMatchObject({ valid: false, break: { position: 0 } });
  });

  it('verifies each chain found in the entries on its own', async () => {
    const acme = await aChain(3);
    const other = await aChain(2, 'other');
    const mixed = [nth(acme, 0), nth(other, 0), nth(acme, 1), nth(other, 1), nth(acme, 2)];

    expect(await verifyChain(mixed)).toEqual({ valid: true, checked: 5 });
    expect(await verifyChain(mixed, { chain: 'tenant:other' })).toEqual({ valid: true, checked: 2 });

    mixed[3] = { ...nth(other, 1), outcome: 'failed' };

    expect(await verifyChain(mixed)).toEqual({
      valid: false,
      checked: 4,
      break: { kind: 'altered-content', chain: 'tenant:other', position: 1, sequence: 2, entryId: 'other-2' },
    });
  });

  it('reads the chain from a reader, page by page', async () => {
    const trail = new InMemoryAuditTrail();

    for (let index = 1; index <= 230; index += 1) {
      await trail.record(aRecord(`acme-${index}`));
    }

    expect(await verifyChain(trail, { chain: CHAIN })).toEqual({ valid: true, checked: 230 });

    trail.entries[150] = { ...nth(trail.entries, 150), action: 'ForgedCommand' };

    expect(await verifyChain(trail, { chain: CHAIN })).toMatchObject({
      valid: false,
      checked: 150,
      break: { kind: 'altered-content', sequence: 151 },
    });
  });

  it('needs to be told which chain to read from a reader', async () => {
    await expect(verifyChain(new InMemoryAuditTrail())).rejects.toThrow(TypeError);
  });
});

describe('anchoring', () => {
  it('hands a checkpoint over every N entries of a chain', async () => {
    const sealed: AuditCheckpoint[] = [];

    const trail = new InMemoryAuditTrail({
      sealing: { every: 3, onSeal: (checkpoint) => void sealed.push(checkpoint) },
    });

    for (let index = 1; index <= 7; index += 1) {
      await trail.record(aRecord(`acme-${index}`));
    }

    await trail.record(aRecord('other-1', 'other'));

    expect(sealed).toEqual([
      { chain: CHAIN, sequence: 3, hash: trail.entries[2]?.hash },
      { chain: CHAIN, sequence: 6, hash: trail.entries[5]?.hash },
    ]);
  });

  it('shows a chain rewritten as a whole, which is consistent with itself', async () => {
    const sealed: AuditCheckpoint[] = [];

    const trail = new InMemoryAuditTrail({
      sealing: { every: 2, onSeal: (checkpoint) => void sealed.push(checkpoint) },
    });

    for (let index = 1; index <= 5; index += 1) {
      await trail.record(aRecord(`acme-${index}`));
    }

    const rewritten = rewrittenFrom(trail.entries, 2);

    expect(await verifyChain(rewritten)).toEqual({ valid: true, checked: 5 });

    expect(await verifyChain(rewritten, { checkpoints: sealed })).toEqual({
      valid: false,
      checked: 1,
      break: { kind: 'altered-content', chain: CHAIN, position: 1, sequence: 2, entryId: 'acme-2' },
    });

    expect(await verifyChain(trail.entries, { checkpoints: sealed })).toEqual({ valid: true, checked: 5 });
  });
});
