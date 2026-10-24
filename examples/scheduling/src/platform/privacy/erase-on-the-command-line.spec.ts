import { SUBJECT_ERASURE_ACTION, verifyChain } from '@ddd-ts-kit/audit';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  FixedExecutionScope,
  InMemoryFileStorage,
  NotADataSubjectIdError,
  PersonalDataCipher,
  SequentialIdGenerator,
  UnknownDataSubjectError,
  executionContext,
  offsetPage,
  type Actor,
  type AuditEntry,
  type AuditFilter,
} from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudit, type Audit } from '@/platform/audit/create-audit';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { copiesOfAPerson } from '@/platform/privacy/copies-of-a-person';
import { eraseOnTheCommandLine } from '@/platform/privacy/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/event-store/store-fed-projections';
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

describe('npm run privacy:erase', () => {
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

  it('erases the person of identity too, and records a run again as an erasure that found no key, under the operator who ran it again', async () => {
    await database.persistence.eventSourcing.subjectKeys.keyFor('patient-2');

    const report = await erase('patient-2', 'operator-7');

    expect(report.copies).toMatchObject({ identity: 1 });

    // Nothing of the person is left anywhere: a run again is refused as already complete, and recorded all the same.
    await expect(erase('patient-2', 'operator-9')).rejects.toThrow(UnknownDataSubjectError);

    expect((await erasuresOf('patient-2')).map(({ actor, changes }) => ({ actor: actor.id, changes }))).toEqual([
      { actor: 'operator-7', changes: { keyDestroyed: true } },
      { actor: 'operator-9', changes: { keyDestroyed: false } },
    ]);

    await expect(verifyChain(audit.trail, { chain: 'global' })).resolves.toMatchObject({ valid: true });
  });

  it('refuses an email or a name pasted in place of the id before any entry is written', async () => {
    await expect(erase('ada@example.org', 'operator-1')).rejects.toThrow(NotADataSubjectIdError);
    await expect(erase('Ada Lovelace', 'operator-1')).rejects.toThrow(NotADataSubjectIdError);

    expect(await entriesOf('operator-1')).toEqual([]);
  });

  it('tells a run again from a mistyped id by a lookup of every network, which the trail records', async () => {
    await expect(erase('nobody', 'operator-5')).rejects.toThrow(UnknownDataSubjectError);

    expect((await entriesOf('operator-5')).map(gist)).toEqual([
      { action: SUBJECT_ERASURE_ACTION, outcome: 'succeeded', reason: undefined, changes: { keyDestroyed: false } },
      { action: 'tenancy:elevate', outcome: 'allowed', reason: 'PATIENT_ERASURE', changes: undefined },
    ]);
  });

  it('erases a patient whose person is gone from every network, as long as they have a key: the key comes first', async () => {
    await database.persistence.eventSourcing.subjectKeys.keyFor('patient-gone');

    const report = await erase('patient-gone', 'operator-3');

    expect(report.erased).toBe(true);

    expect((await entriesOf('operator-3')).map(gist)).toEqual([
      { action: SUBJECT_ERASURE_ACTION, outcome: 'succeeded', reason: undefined, changes: { keyDestroyed: true } },
    ]);
  });
});

function erase(patientId: string, operator: string) {
  const parts = {
    keys: audit.subjectKeys,
    rebuilds: storeFedProjections(database.persistence, new PersonalDataCipher(audit.subjectKeys)),
    copies: copiesOfAPerson(database.persistence, { scope, clock: source.clock, files: new InMemoryFileStorage() }),
  };

  const options = { scope, ids, operator, persons, elevate: audit.elevate, networks: ['acme'] };

  return eraseOnTheCommandLine(patientId, parts, options);
}

function gist({ action, outcome, reason, changes }: AuditEntry) {
  return { action, outcome, reason, changes };
}

function erasuresOf(patientId: string) {
  return entries({ action: SUBJECT_ERASURE_ACTION, resource: { type: 'data-subject', id: patientId } });
}

function entriesOf(operator: string) {
  return entries({ actorId: operator });
}

async function entries(filter: AuditFilter) {
  const page = await audit.trail.search(
    filter,
    offsetPage({ offset: 0, limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] }),
  );

  return page.items;
}
