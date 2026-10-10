import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, ProjectionRebuild, scoped } from '@ddd-ts-kit/kernel';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import type { Outcome } from '#src/contexts/analytics/application/ports/outcome-register.port.js';
import { ANALYTICS_SCHEMA } from '#src/contexts/analytics/infrastructure/persistence/analytics.schema.js';
import { createAnalyticsTables } from '#src/contexts/analytics/infrastructure/persistence/create-analytics-tables.schema.js';
import { KnexOutcomeRegister } from '#src/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository.js';
import { anOutcome } from '#src/contexts/analytics/test/builders/outcome.builder.js';
import { FakeAppointmentExportGateway } from '#src/contexts/analytics/test/fakes/appointment-export-gateway.fake.js';

/** What scheduling states: three appointments, exported two a page. */
const TRUTH: readonly Outcome[] = [
  anOutcome({ id: 'appointment-1', state: 'completed', changedAt: new Date('2026-10-12T09:00:00.000Z') }),
  anOutcome({
    id: 'appointment-2',
    day: '2026-10-14',
    startsAt: new Date('2026-10-14T09:00:00.000Z'),
    endsAt: new Date('2026-10-14T09:30:00.000Z'),
  }),
  anOutcome({ id: 'appointment-3', state: 'cancelled-by-patient' }),
];

/** What the projection got wrong: a fact it missed, a day it kept, an appointment scheduling never had, and one it never saw. */
const WRONG: readonly Outcome[] = [
  anOutcome({ id: 'appointment-1', state: 'held' }),
  anOutcome({ id: 'appointment-2', day: '2026-10-12' }),
  anOutcome({ id: 'appointment-ghost' }),
];

const seen = { eventId: 'fact-seen', occurredAt: new Date('2026-10-01T10:00:00.000Z') };

let database: TestDatabase;
let outcomes: KnexOutcomeRegister;

beforeAll(async () => {
  database = await openTestDatabase();

  const knex = database.persistence.database.executor();

  if (!(await knex.schema.withSchema(ANALYTICS_SCHEMA).hasTable('outcomes'))) {
    await createAnalyticsTables(knex);
  }
});

beforeEach(async () => {
  await database.reset();
  outcomes = new KnexOutcomeRegister(database.persistence.database);

  for (const outcome of WRONG) {
    await outcomes.upsertIfNewer(outcome.id, seen, () => outcome);
  }
});

afterAll(async () => {
  await database.close();
});

describe('The outcomes, rebuilt from what scheduling states', () => {
  it('copies every appointment of the export, page after page', async () => {
    const report = await rebuild();

    expect(report.copied).toBe(3);
  });

  it('are repaired where the projection had got them wrong', async () => {
    await rebuild();

    expect(await outcomes.get('appointment-1')).toEqual(TRUTH[0]);
    expect(await outcomes.get('appointment-2')).toEqual(TRUTH[1]);
  });

  it('gain the appointment the projection never saw and lose the one scheduling never had', async () => {
    await rebuild();

    const page = await outcomes.search(scoped(Criteria.of<Outcome>().orderBy('id'), { kind: 'all' }));

    expect(page.items.map((outcome) => outcome.id)).toEqual(['appointment-1', 'appointment-2', 'appointment-3']);
  });

  it('still take a fact later than what scheduling stated, and refuse an earlier one', async () => {
    await rebuild();

    const earlier = await outcomes.upsertIfNewer(
      'appointment-1',
      { eventId: 'fact-early', occurredAt: new Date('2026-10-12T08:00:00.000Z') },
      () => anOutcome({ state: 'held' }),
    );

    const later = await outcomes.upsertIfNewer(
      'appointment-1',
      { eventId: 'fact-late', occurredAt: new Date('2026-10-12T10:00:00.000Z') },
      () => anOutcome({ state: 'no-show' }),
    );

    expect([earlier, later]).toEqual(['stale', 'applied']);
    expect(await outcomes.get('appointment-1')).toMatchObject({ state: 'no-show' });
  });

  it('end the same when rebuilt twice', async () => {
    await rebuild();
    await rebuild();

    expect(await outcomes.get('appointment-1')).toEqual(TRUTH[0]);
  });
});

function rebuild() {
  return new ProjectionRebuild({
    table: outcomes.table,
    source: new FakeAppointmentExportGateway(TRUTH),
    unitOfWork: database.persistence.unitOfWork,
  }).run();
}
