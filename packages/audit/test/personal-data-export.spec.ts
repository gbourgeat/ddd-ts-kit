import { describe, expect, it } from 'vitest';
import {
  DomainError,
  FixedExecutionScope,
  InMemoryPersonalData,
  NoExecutionContextError,
  personalFields,
  type AuditRecord,
  type AuditTrail,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  PERSONAL_DATA_EXPORT_ACTION,
  UNEXPECTED_ERROR,
  auditRecordOf,
  auditedPersonalDataExport,
  verifyChain,
} from '../src';
import { NOW, aSource } from './support/fixtures';

interface PatientRow {
  readonly id: string;
  readonly display_name: string;
  readonly email: string;
}

const PATIENTS = personalFields<PatientRow>('patients', {
  subject: 'id',
  fields: ['display_name', 'email'],
  erasure: 'pseudonymise',
});

/** The export of the care context, holding two patients. */
function careExport(): InMemoryPersonalData<PatientRow> {
  const patients = new InMemoryPersonalData('care', PATIENTS);

  patients.insert(
    { id: 'patient-1', display_name: 'Ada', email: 'ada@example.org' },
    { id: 'patient-2', display_name: 'Bob', email: 'bob@example.org' },
  );

  return patients;
}

const ADA_RECORD: PersonalDataRecord = { source: 'care', values: { display_name: 'Ada', email: 'ada@example.org' } };

/** A trail whose store is down: every record is refused. */
class UnreachableAuditTrail implements AuditTrail {
  async record(): Promise<void> {
    throw new Error('audit database unreachable');
  }
}

/** An export whose read fails: the caller gets nothing. */
class FailingExport implements PersonalDataExport {
  readonly name = 'care';

  async exportOf(): Promise<readonly PersonalDataRecord[]> {
    throw new Error('care database unreachable');
  }
}

/** An export that refuses as a business rule, with a code of its own. */
class LockedExport implements PersonalDataExport {
  readonly name = 'care';

  async exportOf(): Promise<readonly PersonalDataRecord[]> {
    throw new ExportLocked('The export is suspended during the migration');
  }
}

class ExportLocked extends DomainError {
  readonly code = 'EXPORT_LOCKED';
}

/** An export that counts what it was asked. */
class CountingExport implements PersonalDataExport {
  readonly name = 'care';
  readonly asked: string[] = [];

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    this.asked.push(subject);

    return [];
  }
}

describe('auditedPersonalDataExport, what a handover records', () => {
  it('answers the records of the port and records the handover: who, when, which subject, which context, how many records', async () => {
    const trail = new InMemoryAuditTrail();
    const audited = auditedPersonalDataExport(careExport(), trail, aSource());

    expect(audited.name).toBe('care');
    expect(await audited.exportOf('patient-1')).toEqual([ADA_RECORD]);

    expect(trail.entries).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        chain: 'tenant:acme',
        occurredAt: NOW,
        category: 'data-access',
        action: PERSONAL_DATA_EXPORT_ACTION,
        outcome: 'succeeded',
        resource: { type: 'data-subject', id: 'patient-1' },
        context: 'care',
        changes: { records: 1 },
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        correlationId: 'correlation-1',
        origin: 'http',
      }),
    ]);
  });

  it('writes none of the values into the trail: the document goes to the person, the entry to everyone who reads the trail', async () => {
    const trail = new InMemoryAuditTrail();

    await auditedPersonalDataExport(careExport(), trail, aSource()).exportOf('patient-1');

    expect(JSON.stringify(trail.entries)).not.toContain('ada@example.org');
    expect(JSON.stringify(trail.entries)).not.toContain('Ada');
  });

  it('records an export that found nothing, so that an answer of "nothing is kept" leaves a trace of its own', async () => {
    const trail = new InMemoryAuditTrail();

    expect(await auditedPersonalDataExport(careExport(), trail, aSource()).exportOf('patient-9')).toEqual([]);

    expect(trail.entries.map(({ outcome, changes }) => ({ outcome, changes }))).toEqual([
      { outcome: 'succeeded', changes: { records: 0 } },
    ]);
  });

  it('refuses an export outside an execution context before the port is asked', async () => {
    const port = new CountingExport();
    const trail = new InMemoryAuditTrail();
    const outside = { ...aSource(), scope: new FixedExecutionScope() };

    await expect(auditedPersonalDataExport(port, trail, outside).exportOf('patient-1')).rejects.toThrow(
      NoExecutionContextError,
    );

    expect(port.asked).toEqual([]);
    expect(trail.entries).toEqual([]);
  });
});

describe('auditedPersonalDataExport, when a step fails', () => {
  it('hands nothing over when the entry cannot be written: the export fails with that error, and run again it records the same read', async () => {
    const trail = new InMemoryAuditTrail();

    await expect(
      auditedPersonalDataExport(careExport(), new UnreachableAuditTrail(), aSource()).exportOf('patient-1'),
    ).rejects.toThrow('audit database unreachable');

    expect(await auditedPersonalDataExport(careExport(), trail, aSource()).exportOf('patient-1')).toEqual([ADA_RECORD]);
    expect(trail.entries.map(({ changes }) => changes)).toEqual([{ records: 1 }]);
  });

  it('records a failed read with a code, never the message of the error, and rethrows that error', async () => {
    const trail = new InMemoryAuditTrail();

    await expect(
      auditedPersonalDataExport(new FailingExport(), trail, aSource()).exportOf('patient-1'),
    ).rejects.toThrow('care database unreachable');

    expect(trail.entries.map(({ action, outcome, reason, changes }) => ({ action, outcome, reason, changes }))).toEqual(
      [{ action: PERSONAL_DATA_EXPORT_ACTION, outcome: 'failed', reason: UNEXPECTED_ERROR, changes: undefined }],
    );
  });

  it('records the code of a refusal of the port, as for a command', async () => {
    const trail = new InMemoryAuditTrail();

    await expect(auditedPersonalDataExport(new LockedExport(), trail, aSource()).exportOf('patient-1')).rejects.toThrow(
      ExportLocked,
    );

    expect(trail.entries.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'failed', reason: 'EXPORT_LOCKED' },
    ]);
  });

  it('tells onLostRecord when a failed export cannot be recorded either, and still throws the failure of the export', async () => {
    const lost: { error: unknown; record: AuditRecord | undefined }[] = [];

    const options = {
      ...aSource(),
      onLostRecord: (error: unknown, record: AuditRecord | undefined) => lost.push({ error, record }),
    };

    await expect(
      auditedPersonalDataExport(new FailingExport(), new UnreachableAuditTrail(), options).exportOf('patient-1'),
    ).rejects.toThrow('care database unreachable');

    expect(lost).toEqual([
      {
        error: new Error('audit database unreachable'),
        record: expect.objectContaining({ outcome: 'failed', resource: { type: 'data-subject', id: 'patient-1' } }),
      },
    ]);
  });
});

describe('auditedPersonalDataExport, around the chain', () => {
  it('keeps the chain valid around the entries of exports', async () => {
    const source = aSource();
    const trail = new InMemoryAuditTrail();
    const audited = auditedPersonalDataExport(careExport(), trail, source);

    await trail.record(
      auditRecordOf(source, { category: 'command', action: 'BookAppointmentCommand', outcome: 'succeeded' }),
    );

    await audited.exportOf('patient-1');
    await audited.exportOf('patient-2');

    await trail.record(
      auditRecordOf(source, { category: 'command', action: 'CancelAppointmentCommand', outcome: 'succeeded' }),
    );

    await expect(verifyChain(trail.entries)).resolves.toEqual({ valid: true, checked: 4 });
  });
});
