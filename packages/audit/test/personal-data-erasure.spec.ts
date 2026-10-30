import { describe, expect, it } from 'vitest';
import {
  DomainError,
  FixedExecutionScope,
  NoExecutionContextError,
  eraseDataSubject,
  type AuditRecord,
  type AuditTrail,
  type PersonalDataCopy,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  SUBJECT_ERASURE_ACTION,
  UNEXPECTED_ERROR,
  auditedPersonalDataErasure,
  verifyChain,
} from '../src';
import { NOW, aSource } from './support/fixtures';

/** A trail whose store is down: every record is refused. */
class UnreachableAuditTrail implements AuditTrail {
  async record(): Promise<void> {
    throw new Error('audit database unreachable');
  }
}

/** What the care context keeps of a person, which reaches the rows it is told, or fails. */
class CareCopy implements PersonalDataCopy {
  readonly name = 'care';
  readonly asked: string[] = [];

  constructor(private readonly outcome: number | Error = 2) {}

  async erase(subject: string): Promise<number> {
    this.asked.push(subject);

    if (this.outcome instanceof Error) {
      throw this.outcome;
    }

    return this.outcome;
  }
}

class ErasureLocked extends DomainError {
  readonly code = 'ERASURE_LOCKED';
}

describe('auditedPersonalDataErasure, what an erasure records', () => {
  it('erases through the port and records who, when, whom, which context and how many rows, never a value', async () => {
    const trail = new InMemoryAuditTrail();
    const port = new CareCopy(2);
    const audited = auditedPersonalDataErasure(port, trail, aSource());

    expect(audited.name).toBe('care');
    expect(await audited.erase('patient-41c')).toBe(2);
    expect(port.asked).toEqual(['patient-41c']);

    expect(trail.entries).toEqual([
      expect.objectContaining({
        occurredAt: NOW,
        category: 'data-access',
        action: SUBJECT_ERASURE_ACTION,
        outcome: 'succeeded',
        resource: { type: 'data-subject', id: 'patient-41c' },
        context: 'care',
        changes: { rows: 2 },
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        correlationId: 'correlation-1',
      }),
    ]);
  });

  it('records an erasure that reached nothing, so that a run again is accounted for too', async () => {
    const trail = new InMemoryAuditTrail();

    await auditedPersonalDataErasure(new CareCopy(0), trail, aSource()).erase('patient-41c');

    expect(trail.entries.map(({ changes }) => changes)).toEqual([{ rows: 0 }]);
  });

  it('leaves one entry per copy when the whole erasure runs without any key store', async () => {
    const trail = new InMemoryAuditTrail();
    const source = aSource();
    const copies = [new CareCopy(1), { name: 'billing', erase: async () => 3 }];

    const report = await eraseDataSubject('patient-41c', {
      copies: copies.map((copy) => auditedPersonalDataErasure(copy, trail, source)),
    });

    expect(report).toEqual({ erased: false, copies: { care: 1, billing: 3 }, rebuilt: {} });

    expect(trail.entries.map(({ context, changes, actor }) => ({ context, changes, actor: actor.id }))).toEqual([
      { context: 'care', changes: { rows: 1 }, actor: 'ada' },
      { context: 'billing', changes: { rows: 3 }, actor: 'ada' },
    ]);
  });

  it('refuses an erasure outside an execution context before any row is touched', async () => {
    const port = new CareCopy();
    const outside = { ...aSource(), scope: new FixedExecutionScope() };

    await expect(
      auditedPersonalDataErasure(port, new InMemoryAuditTrail(), outside).erase('patient-41c'),
    ).rejects.toThrow(NoExecutionContextError);

    expect(port.asked).toEqual([]);
  });
});

describe('auditedPersonalDataErasure, when a step fails', () => {
  it('fails an erasure whose entry cannot be written, with that error, after the rows are gone', async () => {
    const port = new CareCopy();

    await expect(
      auditedPersonalDataErasure(port, new UnreachableAuditTrail(), aSource()).erase('patient-41c'),
    ).rejects.toThrow('audit database unreachable');

    expect(port.asked).toEqual(['patient-41c']);
  });

  it('records a failed erasure with a code, never the message of the error, and rethrows it', async () => {
    const trail = new InMemoryAuditTrail();
    const unreachable = new CareCopy(new Error('care database unreachable'));

    await expect(auditedPersonalDataErasure(unreachable, trail, aSource()).erase('patient-41c')).rejects.toThrow(
      'care database unreachable',
    );

    await expect(
      auditedPersonalDataErasure(new CareCopy(new ErasureLocked('Locked')), trail, aSource()).erase('patient-41c'),
    ).rejects.toThrow(ErasureLocked);

    expect(trail.entries.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'failed', reason: UNEXPECTED_ERROR },
      { outcome: 'failed', reason: 'ERASURE_LOCKED' },
    ]);
  });

  it('tells onLostRecord when a failed erasure cannot be recorded either, and keeps the chain valid otherwise', async () => {
    const lost: (AuditRecord | undefined)[] = [];
    const options = { ...aSource(), onLostRecord: (_: unknown, record: AuditRecord | undefined) => lost.push(record) };
    const failing = new CareCopy(new Error('care database unreachable'));

    await expect(
      auditedPersonalDataErasure(failing, new UnreachableAuditTrail(), options).erase('patient-41c'),
    ).rejects.toThrow('care database unreachable');

    expect(lost).toEqual([expect.objectContaining({ outcome: 'failed', action: SUBJECT_ERASURE_ACTION })]);

    const trail = new InMemoryAuditTrail();
    const audited = auditedPersonalDataErasure(new CareCopy(), trail, aSource());

    await audited.erase('patient-41c');
    await audited.erase('patient-41c');

    await expect(verifyChain(trail.entries)).resolves.toEqual({ valid: true, checked: 2 });
  });
});
