import { SUBJECT_ERASURE_ACTION, verifyChain } from '@ddd-ts-kit/audit';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  FixedExecutionScope,
  PersonalDataCipher,
  SequentialIdGenerator,
  executionContext,
  offsetPage,
  type Actor,
  type AuditFilter,
} from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudit, type Audit } from '@/platform/audit/create-audit';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { eraseOnTheCommandLine } from '@/platform/events/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/events/store-fed-projections';
import { UnknownPatientError } from '@/platform/events/unknown-patient-error';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';

const NOW = new Date('2026-10-22T09:00:00.000Z');

/** The persons the patients are, registered in the network `acme` by its registrar. */
const registrar: Actor = { id: 'registrar', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const registration = executionContext({ correlationId: 'erasure-spec', actor: registrar, origin: 'test' });

let database: TestDatabase;
let audit: Audit;
let persons: KnexPersonDirectory;

const scope = new AsyncLocalStorageExecutionScope();
const ids = new SequentialIdGenerator('erasure');
const source = { scope, clock: new FixedClock(NOW), ids };

beforeAll(async () => {
  database = await openTestDatabase();
  audit = createAudit(database.persistence, source);
  persons = new KnexPersonDirectory(database.persistence.database, scope);

  const repository = new KnexPersonRepository(
    database.persistence.database,
    new FixedExecutionScope(registration),
    new FixedClock(NOW),
  );

  await repository.save(aPerson().identifiedBy('patient-1').build());
  await repository.save(aPerson().identifiedBy('patient-2').build());
});

afterAll(async () => {
  await database.close();
});

describe('npm run erase:patient', () => {
  it('writes the erasure to the audit trail, with the operator as actor, and the chain still holds', async () => {
    await database.persistence.eventSourcing.subjectKeys.keyFor('patient-1');

    const report = await erase('patient-1', 'operator-7');

    expect(report.erased).toBe(true);

    // The keys are outside the networks (ADR-0004): the proof is in the chain platform staff read.
    expect(await erasuresOf('patient-1')).toEqual([
      expect.objectContaining({
        chain: 'global',
        occurredAt: NOW,
        category: 'data-access',
        outcome: 'succeeded',
        resource: { type: 'data-subject', id: 'patient-1' },
        changes: { keyDestroyed: true },
        actor: { id: 'operator-7', type: 'user' },
        origin: 'cli',
      }),
    ]);

    await expect(verifyChain(audit.trail, { chain: 'global' })).resolves.toMatchObject({ valid: true });
  });

  it('records a run again as an erasure that found no key, under the operator who ran it again', async () => {
    await database.persistence.eventSourcing.subjectKeys.keyFor('patient-2');
    await erase('patient-2', 'operator-7');

    const report = await erase('patient-2', 'operator-9');

    expect(report.erased).toBe(false);

    expect((await erasuresOf('patient-2')).map(({ actor, changes }) => ({ actor: actor.id, changes }))).toEqual([
      { actor: 'operator-7', changes: { keyDestroyed: true } },
      { actor: 'operator-9', changes: { keyDestroyed: false } },
    ]);

    await expect(verifyChain(audit.trail, { chain: 'global' })).resolves.toMatchObject({ valid: true });
  });

  it('looks the patient up in every network, which the trail records, and refuses an id that names nobody', async () => {
    await expect(erase('nobody', 'operator-5')).rejects.toThrow(UnknownPatientError);

    const left = (await entries({ actorId: 'operator-5' })).map(({ action, outcome, reason }) => ({
      action,
      outcome,
      reason,
    }));

    expect(left).toEqual([{ action: 'tenancy:elevate', outcome: 'allowed', reason: 'PATIENT_ERASURE' }]);
    expect(await erasuresOf('nobody')).toEqual([]);
  });
});

function erase(patientId: string, operator: string) {
  const parts = {
    keys: audit.subjectKeys,
    projections: storeFedProjections(database.persistence, new PersonalDataCipher(audit.subjectKeys)),
  };

  return eraseOnTheCommandLine(patientId, parts, { scope, ids, operator, persons, elevate: audit.elevate });
}

function erasuresOf(patientId: string) {
  return entries({ action: SUBJECT_ERASURE_ACTION, resource: { type: 'data-subject', id: patientId } });
}

async function entries(filter: AuditFilter) {
  const page = await audit.trail.search(
    filter,
    offsetPage({ offset: 0, limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] }),
  );

  return page.items;
}
