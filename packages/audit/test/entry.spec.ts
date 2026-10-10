import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, InMemoryAuditTrail, canonicalize, hashOf, type AuditEntry, type AuditRecord } from '@ddd-ts-kit/audit';

/*
 * What a project writes once, in a declaration file of its platform. This spec imports the
 * package by its name, as a project does: the augmentation targets the published types.
 */
declare module '@ddd-ts-kit/audit' {
  interface AuditEntryExtensions {
    readonly region: 'eu' | 'us';
    readonly release: { readonly version: string };
    readonly clock: Date;
  }
}

const record: AuditRecord = {
  id: 'entry-1',
  occurredAt: new Date('2026-03-01T10:00:00.000Z'),
  category: 'command',
  action: 'CancelAppointmentCommand',
  outcome: 'succeeded',
  actor: { id: 'ada', type: 'user', tenantId: 'acme' },
  tenantId: 'acme',
  correlationId: 'correlation-1',
  origin: 'http',
  extensions: { region: 'eu', release: { version: '1.4.0' } },
};

describe('AuditEntryExtensions', () => {
  it('types the fields a project adds, optional when read', async () => {
    const trail = new InMemoryAuditTrail();

    await trail.record(record);
    const [entry] = trail.entries;

    const region: 'eu' | 'us' | undefined = entry?.extensions.region;
    // @ts-expect-error -- an extension is optional when read: an entry written before the project declared it has none
    const certain: 'eu' | 'us' = entry?.extensions.region;

    expect([region, certain, entry?.extensions.release?.version]).toEqual(['eu', 'eu', '1.4.0']);
  });

  it('refuses a value outside the declared type, a field nobody declared and a value that is not JSON', () => {
    // @ts-expect-error -- 'asia' is not a declared region
    const wrong: AuditEntry['extensions'] = { region: 'asia' };
    // @ts-expect-error -- 'datacenter' was never declared
    const unknown: AuditEntry['extensions'] = { datacenter: 'par-1' };
    // @ts-expect-error -- a Date is not JSON: the extension reads as never, so nothing can be given
    const notJson: AuditEntry['extensions'] = { clock: new Date(0) };

    expect([wrong, unknown, notJson]).toHaveLength(3);
  });
});

describe('canonicalize', () => {
  it('sorts the keys at every depth, drops undefined and writes dates in ISO 8601 UTC', () => {
    const value = { b: 1, a: { d: undefined, c: [true, null, 'x'], b: new Date('2026-03-01T11:00:00.000+01:00') } };

    expect(canonicalize(value)).toBe('{"a":{"b":"2026-03-01T10:00:00.000Z","c":[true,null,"x"]},"b":1}');
  });

  it('gives the same text whatever the order the keys were written in', () => {
    expect(canonicalize({ one: 1, two: { x: 'é', y: 2 } })).toBe(canonicalize({ two: { y: 2, x: 'é' }, one: 1 }));
  });
});

describe('hashOf', () => {
  it('is the SHA-256 of the canonical form of the entry without its hash, which anybody can compute again', async () => {
    const trail = new InMemoryAuditTrail();

    await trail.record(record);
    const [entry] = trail.entries;

    const canonical =
      '{"action":"CancelAppointmentCommand","actor":{"id":"ada","tenantId":"acme","type":"user"},"category":"command","chain":"tenant:acme",' +
      '"correlationId":"correlation-1","extensions":{"region":"eu","release":{"version":"1.4.0"}},"id":"entry-1",' +
      `"occurredAt":"2026-03-01T10:00:00.000Z","origin":"http","outcome":"succeeded","previousHash":"${GENESIS_HASH}","sequence":1,"tenantId":"acme"}`;

    expect(entry?.hash).toBe(createHash('sha256').update(canonical, 'utf8').digest('hex'));
    expect(entry === undefined ? undefined : hashOf(entry)).toBe(entry?.hash);
  });

  it('changes with any field, the link to the previous entry included', async () => {
    const trail = new InMemoryAuditTrail();

    await trail.record(record);
    const [entry] = trail.entries;

    if (entry === undefined) throw new Error('The entry was not recorded');

    expect(hashOf({ ...entry, outcome: 'failed' })).not.toBe(entry.hash);
    expect(hashOf({ ...entry, previousHash: 'f'.repeat(64) })).not.toBe(entry.hash);
    expect(hashOf({ ...entry, sequence: 2 })).not.toBe(entry.hash);
  });
});
