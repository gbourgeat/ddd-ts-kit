import { describe, expect, it } from 'vitest';
import {
  DomainError,
  FixedExecutionScope,
  NoExecutionContextError,
  type AuditRecord,
  type AuditTrail,
  type PersonalDataRetention,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  PERSONAL_DATA_PURGE_ACTION,
  UNEXPECTED_ERROR,
  auditedPersonalDataRetention,
  verifyChain,
} from '../src';
import { NOW, aSource } from './support/fixtures';

/** A trail whose store is down: every record is refused. */
class UnreachableAuditTrail implements AuditTrail {
  async record(): Promise<void> {
    throw new Error('audit database unreachable');
  }
}

/** The retention of the care context, which reaches the rows it is told, or fails. */
class CareRetention implements PersonalDataRetention {
  readonly name = 'care';
  readonly asked: Date[] = [];

  constructor(private readonly outcome: number | Error = 3) {}

  async purgeExpired(now: Date): Promise<number> {
    this.asked.push(now);

    if (this.outcome instanceof Error) {
      throw this.outcome;
    }

    return this.outcome;
  }
}

class RetentionLocked extends DomainError {
  readonly code = 'RETENTION_LOCKED';
}

describe('auditedPersonalDataRetention, what a purge records', () => {
  it('purges through the port and records the purge: who, when, which context, how many rows, and no person', async () => {
    const trail = new InMemoryAuditTrail();
    const port = new CareRetention(3);
    const audited = auditedPersonalDataRetention(port, trail, aSource());

    expect(audited.name).toBe('care');
    expect(await audited.purgeExpired(NOW)).toBe(3);
    expect(port.asked).toEqual([NOW]);

    expect(trail.entries).toEqual([
      expect.objectContaining({
        occurredAt: NOW,
        category: 'data-access',
        action: PERSONAL_DATA_PURGE_ACTION,
        outcome: 'succeeded',
        context: 'care',
        changes: { rows: 3 },
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
      }),
    ]);

    expect(trail.entries[0]?.resource).toBeUndefined();
  });

  it('records a purge that reached nothing: the proof that the retention is applied, run after run', async () => {
    const trail = new InMemoryAuditTrail();

    await auditedPersonalDataRetention(new CareRetention(0), trail, aSource()).purgeExpired(NOW);

    expect(trail.entries.map(({ changes }) => changes)).toEqual([{ rows: 0 }]);
  });

  it('refuses a purge outside an execution context before any row is touched', async () => {
    const port = new CareRetention();
    const outside = { ...aSource(), scope: new FixedExecutionScope() };

    await expect(
      auditedPersonalDataRetention(port, new InMemoryAuditTrail(), outside).purgeExpired(NOW),
    ).rejects.toThrow(NoExecutionContextError);

    expect(port.asked).toEqual([]);
  });
});

describe('auditedPersonalDataRetention, when a step fails', () => {
  it('fails a purge whose entry cannot be written, with that error', async () => {
    await expect(
      auditedPersonalDataRetention(new CareRetention(), new UnreachableAuditTrail(), aSource()).purgeExpired(NOW),
    ).rejects.toThrow('audit database unreachable');
  });

  it('records a failed purge with a code, never the message of the error, and rethrows it', async () => {
    const trail = new InMemoryAuditTrail();
    const unreachable = new CareRetention(new Error('care database unreachable'));

    await expect(auditedPersonalDataRetention(unreachable, trail, aSource()).purgeExpired(NOW)).rejects.toThrow(
      'care database unreachable',
    );

    await expect(
      auditedPersonalDataRetention(new CareRetention(new RetentionLocked('Locked')), trail, aSource()).purgeExpired(
        NOW,
      ),
    ).rejects.toThrow(RetentionLocked);

    expect(trail.entries.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'failed', reason: UNEXPECTED_ERROR },
      { outcome: 'failed', reason: 'RETENTION_LOCKED' },
    ]);
  });

  it('tells onLostRecord when a failed purge cannot be recorded either, and keeps the chain valid otherwise', async () => {
    const lost: (AuditRecord | undefined)[] = [];
    const options = { ...aSource(), onLostRecord: (_: unknown, record: AuditRecord | undefined) => lost.push(record) };
    const failing = new CareRetention(new Error('care database unreachable'));

    await expect(
      auditedPersonalDataRetention(failing, new UnreachableAuditTrail(), options).purgeExpired(NOW),
    ).rejects.toThrow('care database unreachable');

    expect(lost).toEqual([expect.objectContaining({ outcome: 'failed', action: PERSONAL_DATA_PURGE_ACTION })]);

    const trail = new InMemoryAuditTrail();
    const audited = auditedPersonalDataRetention(new CareRetention(), trail, aSource());

    await audited.purgeExpired(NOW);
    await audited.purgeExpired(NOW);

    await expect(verifyChain(trail.entries)).resolves.toEqual({ valid: true, checked: 2 });
  });
});
