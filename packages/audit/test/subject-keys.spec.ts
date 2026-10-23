import { describe, expect, it } from 'vitest';
import {
  DomainError,
  FixedExecutionScope,
  InMemorySubjectKeyStore,
  NoExecutionContextError,
  type AuditRecord,
  type AuditTrail,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  SUBJECT_ERASURE_ACTION,
  UNEXPECTED_ERROR,
  auditRecordOf,
  auditedSubjectKeys,
  verifyChain,
} from '../src';
import { NOW, aSource } from './support/fixtures';

/** A trail whose store is down: every record is refused. */
class UnreachableAuditTrail implements AuditTrail {
  async record(): Promise<void> {
    throw new Error('audit database unreachable');
  }
}

/** A key store whose erasure fails, after or before destroying anything: the caller cannot tell. */
class FailingErasureKeyStore extends InMemorySubjectKeyStore {
  override async erase(): Promise<boolean> {
    throw new Error('key database unreachable');
  }
}

/** A key store that refuses an erasure as a business rule, with a code of its own. */
class LockedKeyStore extends InMemorySubjectKeyStore {
  override async erase(): Promise<boolean> {
    throw new KeyStoreLocked('The key store is locked for maintenance');
  }
}

class KeyStoreLocked extends DomainError {
  readonly code = 'KEY_STORE_LOCKED';
}

describe('auditedSubjectKeys, what an erasure records', () => {
  it('records the erasure of a subject that had a key: who, when, which subject, and that the key is destroyed', async () => {
    const keys = new InMemorySubjectKeyStore();
    const trail = new InMemoryAuditTrail();
    const key = await keys.keyFor('patient-1');

    const erased = await auditedSubjectKeys(keys, trail, aSource()).erase('patient-1');

    expect(erased).toBe(true);
    await expect(keys.find(key.id)).resolves.toBeUndefined();

    expect(trail.entries).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        chain: 'tenant:acme',
        occurredAt: NOW,
        category: 'data-access',
        action: SUBJECT_ERASURE_ACTION,
        outcome: 'succeeded',
        resource: { type: 'data-subject', id: 'patient-1' },
        changes: { keyDestroyed: true },
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        correlationId: 'correlation-1',
        origin: 'http',
      }),
    ]);
  });

  it('records an erasure that found no key, so that running it again leaves a trace of its own', async () => {
    const trail = new InMemoryAuditTrail();

    const erased = await auditedSubjectKeys(new InMemorySubjectKeyStore(), trail, aSource()).erase('patient-2');

    expect(erased).toBe(false);

    expect(trail.entries.map(({ outcome, changes }) => ({ outcome, changes }))).toEqual([
      { outcome: 'succeeded', changes: { keyDestroyed: false } },
    ]);
  });

  it('refuses an erasure outside an execution context before the key is touched', async () => {
    const keys = new InMemorySubjectKeyStore();
    const trail = new InMemoryAuditTrail();
    const key = await keys.keyFor('patient-1');
    const outside = { ...aSource(), scope: new FixedExecutionScope() };

    await expect(auditedSubjectKeys(keys, trail, outside).erase('patient-1')).rejects.toThrow(NoExecutionContextError);

    await expect(keys.find(key.id)).resolves.toEqual(key);
    expect(trail.entries).toEqual([]);
  });
});

describe('auditedSubjectKeys, when a step fails', () => {
  it('fails an erasure whose entry cannot be written; run again, it records that no key was left', async () => {
    const keys = new InMemorySubjectKeyStore();
    const trail = new InMemoryAuditTrail();
    const key = await keys.keyFor('patient-1');

    await expect(auditedSubjectKeys(keys, new UnreachableAuditTrail(), aSource()).erase('patient-1')).rejects.toThrow(
      'audit database unreachable',
    );

    await expect(keys.find(key.id)).resolves.toBeUndefined();

    await expect(auditedSubjectKeys(keys, trail, aSource()).erase('patient-1')).resolves.toBe(false);
    expect(trail.entries.map(({ changes }) => changes)).toEqual([{ keyDestroyed: false }]);
  });

  it('records a failed erasure with a code, never the message of the error, and rethrows that error', async () => {
    const trail = new InMemoryAuditTrail();

    await expect(auditedSubjectKeys(new FailingErasureKeyStore(), trail, aSource()).erase('patient-1')).rejects.toThrow(
      'key database unreachable',
    );

    expect(trail.entries.map(({ action, outcome, reason, changes }) => ({ action, outcome, reason, changes }))).toEqual(
      [{ action: SUBJECT_ERASURE_ACTION, outcome: 'failed', reason: UNEXPECTED_ERROR, changes: undefined }],
    );
  });

  it('records the code of a refusal of the store, as for a command', async () => {
    const trail = new InMemoryAuditTrail();

    await expect(auditedSubjectKeys(new LockedKeyStore(), trail, aSource()).erase('patient-1')).rejects.toThrow(
      KeyStoreLocked,
    );

    expect(trail.entries.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'failed', reason: 'KEY_STORE_LOCKED' },
    ]);
  });

  it('tells onLostRecord when a failed erasure cannot be recorded either, and still throws the failure of the erasure', async () => {
    const lost: { error: unknown; record: AuditRecord | undefined }[] = [];

    const options = {
      ...aSource(),
      onLostRecord: (error: unknown, record: AuditRecord | undefined) => lost.push({ error, record }),
    };

    await expect(
      auditedSubjectKeys(new FailingErasureKeyStore(), new UnreachableAuditTrail(), options).erase('patient-1'),
    ).rejects.toThrow('key database unreachable');

    expect(lost).toEqual([
      {
        error: new Error('audit database unreachable'),
        record: expect.objectContaining({ outcome: 'failed', resource: { type: 'data-subject', id: 'patient-1' } }),
      },
    ]);
  });
});

describe('auditedSubjectKeys, around the store and the chain', () => {
  it('keeps the chain valid around the entries of erasures', async () => {
    const source = aSource();
    const keys = new InMemorySubjectKeyStore();
    const trail = new InMemoryAuditTrail();
    const audited = auditedSubjectKeys(keys, trail, source);

    await keys.keyFor('patient-1');

    await trail.record(
      auditRecordOf(source, { category: 'command', action: 'BookAppointmentCommand', outcome: 'succeeded' }),
    );

    await audited.erase('patient-1');
    await audited.erase('patient-1');

    await trail.record(
      auditRecordOf(source, { category: 'command', action: 'CancelAppointmentCommand', outcome: 'succeeded' }),
    );

    await expect(verifyChain(trail.entries)).resolves.toEqual({ valid: true, checked: 4 });
  });

  it('hands out and finds keys as the store it wraps, without writing to the trail', async () => {
    const keys = new InMemorySubjectKeyStore();
    const trail = new InMemoryAuditTrail();
    const audited = auditedSubjectKeys(keys, trail, aSource());

    const key = await audited.keyFor('patient-1');

    await expect(keys.keyFor('patient-1')).resolves.toEqual(key);
    await expect(audited.find(key.id)).resolves.toEqual(key);
    expect(trail.entries).toEqual([]);
  });
});
