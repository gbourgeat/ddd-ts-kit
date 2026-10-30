import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryPersonalData,
  NotADataSubjectIdError,
  PERSONAL_DATA_EXPORT_FORMAT,
  UnknownDataSubjectError,
  eachTenant,
  executionContext,
  exportDataSubject,
  personalFields,
  recordsInEachTenant,
  systemActor,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '../src';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const clock = new FixedClock(NOW);

interface PatientRow {
  readonly id: string;
  readonly display_name: string;
}

interface InvoiceRow {
  readonly id: string;
  readonly patient_id: string;
  readonly billing_email: string;
}

function care(): InMemoryPersonalData<PatientRow> {
  const patients = new InMemoryPersonalData(
    'care',
    personalFields<PatientRow>('patients', { subject: 'id', fields: ['display_name'], erasure: 'pseudonymise' }),
  );

  patients.insert({ id: 'patient-1', display_name: 'Ada' }, { id: 'patient-2', display_name: 'Bob' });

  return patients;
}

function billing(): InMemoryPersonalData<InvoiceRow> {
  const invoices = new InMemoryPersonalData(
    'billing',
    personalFields<InvoiceRow>('invoices', { subject: 'patient_id', fields: ['billing_email'], erasure: 'row' }),
  );

  invoices.insert(
    { id: 'inv-1', patient_id: 'patient-1', billing_email: 'ada@example.org' },
    { id: 'inv-2', patient_id: 'patient-1', billing_email: 'ada@work.example' },
  );

  return invoices;
}

/** An export that answers the tenant of the context it runs in. */
class TenantExport implements PersonalDataExport {
  readonly name = 'care';

  constructor(private readonly scope: AsyncLocalStorageExecutionScope) {}

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    return [{ source: 'care.patients', values: { subject, tenant: this.scope.require().tenantId ?? null } }];
  }
}

/** An export whose read fails. */
class FailingExport implements PersonalDataExport {
  readonly name = 'billing';

  async exportOf(): Promise<readonly PersonalDataRecord[]> {
    throw new Error('billing database unreachable');
  }
}

describe('InMemoryPersonalData.exportOf', () => {
  interface LoyaltyRow {
    readonly id: string;
    readonly points: bigint;
    readonly since: Date;
    readonly tiers: readonly string[];
    readonly note: string | null;
    readonly nickname: string | undefined;
  }

  it('writes a scalar as it is, an instant as ISO text, a big integer as digits, a list as JSON and nothing as null', async () => {
    const loyalty = new InMemoryPersonalData(
      'loyalty',
      personalFields<LoyaltyRow>('members', {
        subject: 'id',
        fields: ['points', 'since', 'tiers', 'note', 'nickname'],
        erasure: 'row',
      }),
    );

    loyalty.insert({ id: 'patient-1', points: 12n, since: NOW, tiers: ['gold'], note: null, nickname: undefined });

    expect(await loyalty.exportOf('patient-1')).toMatchObject([
      { values: { points: '12', since: NOW.toISOString(), tiers: '["gold"]', note: null, nickname: null } },
    ]);
  });
});

describe('exportDataSubject, the document', () => {
  it('gathers the records of every export in the order they are listed, into one dated document of a stable format', async () => {
    const document = await exportDataSubject('patient-1', { exports: [care(), billing()], clock });

    expect(document).toEqual({
      format: 'ddd-ts-kit/personal-data-export@1',
      subject: 'patient-1',
      exportedAt: NOW,
      records: [
        { source: 'care', values: { display_name: 'Ada' } },
        { source: 'billing', values: { billing_email: 'ada@example.org' } },
        { source: 'billing', values: { billing_email: 'ada@work.example' } },
      ],
    });

    expect(document.format).toBe(PERSONAL_DATA_EXPORT_FORMAT);
  });

  it('answers an empty document for a subject nobody keeps anything of, when nothing says who is known', async () => {
    const document = await exportDataSubject('patient-9', { exports: [care(), billing()], clock });

    expect(document.records).toEqual([]);
  });

  it('answers an empty document without an export at all: a project that declared none keeps nothing it can hand over', async () => {
    expect((await exportDataSubject('patient-1', { clock })).records).toEqual([]);
  });

  it('refuses a subject that is not an opaque identifier before any export is asked', async () => {
    const asked: string[] = [];

    const spying: PersonalDataExport = {
      name: 'care',
      exportOf: async (subject) => {
        asked.push(subject);

        return [];
      },
    };

    await expect(exportDataSubject('ada@example.org', { exports: [spying], clock })).rejects.toThrow(
      NotADataSubjectIdError,
    );

    expect(asked).toEqual([]);
  });

  it('stops at the first export that fails, since a document that lacks a context would state less than the system keeps', async () => {
    await expect(exportDataSubject('patient-1', { exports: [care(), new FailingExport()], clock })).rejects.toThrow(
      'billing database unreachable',
    );
  });
});

describe('exportDataSubject, a subject nobody knows', () => {
  it('refuses an id that answers no record and that nobody knows, rather than stating that nothing is kept', async () => {
    const parts = { exports: [care()], clock, isKnown: async () => false };

    await expect(exportDataSubject('patient-9', parts)).rejects.toThrow(UnknownDataSubjectError);
  });

  it('answers an empty document for a known subject nobody keeps anything of', async () => {
    const parts = { exports: [care()], clock, isKnown: async () => true };

    expect((await exportDataSubject('patient-9', parts)).records).toEqual([]);
  });

  it('does not ask who is known when a record was found', async () => {
    const parts = {
      exports: [care()],
      clock,
      isKnown: async (): Promise<boolean> => {
        throw new Error('not to be asked');
      },
    };

    expect((await exportDataSubject('patient-1', parts)).records).toHaveLength(1);
  });
});

describe('exportDataSubject, in every tenant', () => {
  it('runs every export once per tenant, in the context of the work given that tenant, and gathers the records in the order of the tenants', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const operator = executionContext({ correlationId: 'export-1', actor: systemActor('export'), origin: 'cli' });

    const document = await scope.run(operator, () =>
      exportDataSubject('patient-1', {
        exports: [new TenantExport(scope)],
        inEveryTenant: recordsInEachTenant(scope, ['acme', 'north']),
        clock,
      }),
    );

    expect(document.records).toEqual([
      { source: 'care.patients', values: { subject: 'patient-1', tenant: 'acme' } },
      { source: 'care.patients', values: { subject: 'patient-1', tenant: 'north' } },
    ]);

    expect(scope.current()).toBeUndefined();
  });
});

describe('eachTenant', () => {
  it('answers what the work answered in each tenant, in the order of the tenants, and needs a context to run in', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const operator = executionContext({ correlationId: 'export-1', actor: systemActor('export'), origin: 'cli' });

    const answers = await scope.run(operator, () =>
      eachTenant(
        scope,
        ['acme', 'north'],
        async () => `${scope.require().tenantId ?? ''}:${scope.require().correlationId}`,
      ),
    );

    expect(answers).toEqual(['acme:export-1', 'north:export-1']);
    await expect(eachTenant(scope, ['acme'], async () => 1)).rejects.toThrow();
  });
});
