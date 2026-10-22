import { SUBJECT_ERASURE_ACTION, verifyChain } from '@ddd-ts-kit/audit';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  PersonalDataCipher,
  SequentialIdGenerator,
  offsetPage,
} from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudit, type Audit } from '@/platform/audit/create-audit';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { eraseOnTheCommandLine } from '@/platform/events/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/events/store-fed-projections';

const NOW = new Date('2026-10-22T09:00:00.000Z');

let database: TestDatabase;
let audit: Audit;

const scope = new AsyncLocalStorageExecutionScope();
const ids = new SequentialIdGenerator('erasure');
const source = { scope, clock: new FixedClock(NOW), ids };

beforeAll(async () => {
  database = await openTestDatabase();
  audit = createAudit(database.persistence, source);
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
    expect(await erasures('patient-1')).toEqual([
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

    expect((await erasures('patient-2')).map(({ actor, changes }) => ({ actor: actor.id, changes }))).toEqual([
      { actor: 'operator-7', changes: { keyDestroyed: true } },
      { actor: 'operator-9', changes: { keyDestroyed: false } },
    ]);

    await expect(verifyChain(audit.trail, { chain: 'global' })).resolves.toMatchObject({ valid: true });
  });
});

function erase(patientId: string, operator: string) {
  const parts = {
    keys: audit.subjectKeys,
    projections: storeFedProjections(database.persistence, new PersonalDataCipher(audit.subjectKeys)),
  };

  return eraseOnTheCommandLine(patientId, parts, { scope, ids, operator });
}

async function erasures(patientId: string) {
  const page = await audit.trail.search(
    { action: SUBJECT_ERASURE_ACTION, resource: { type: 'data-subject', id: patientId } },
    offsetPage({ offset: 0, limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] }),
  );

  return page.items;
}
