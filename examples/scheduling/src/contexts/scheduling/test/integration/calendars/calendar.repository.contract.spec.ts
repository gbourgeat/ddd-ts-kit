import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract, tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import type { Calendar } from '@/contexts/scheduling/calendars/domain/aggregates/calendar.aggregate';
import { Exception } from '@/contexts/scheduling/calendars/domain/value-objects/exception.vo';
import { Range } from '@/contexts/scheduling/calendars/domain/value-objects/range.vo';
import { KnexCalendarRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-calendar.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () =>
    aCalendar()
      .openEveryDay(['09:00', '12:00'], ['14:00', '18:00'])
      .withException('2026-12-25')
      .off(new Date('2026-08-01T00:00:00.000Z'), new Date('2026-08-15T00:00:00.000Z'))
      .offering('consultation', { buffer: 10, needsConfirmation: true })
      .build(),
  mutate: (changed: Calendar) => {
    changed.addException(
      Exception.create('2026-05-01', [Range.create('10:00', '12:00')]),
      new Date('2026-01-02T00:00:00.000Z'),
    );
  },
  idOf: (subject: Calendar) => subject.id,
  stateOf: (subject: Calendar) => subject.toState(),
};

repositoryContract<Calendar>(runner, {
  ...expectations,
  name: 'FakeCalendarRepository',
  createRepository: () => new FakeCalendarRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Calendar>(runner, {
  ...expectations,
  name: 'KnexCalendarRepository',
  createRepository: async () => {
    await database.reset();

    return new KnexCalendarRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});

/** No read and no write of one network reaches another, whatever the work in progress asks. */
tenantIsolationContract<Calendar>(runner, {
  ...expectations,
  name: 'KnexCalendarRepository',
  createRepository: async (scope) => {
    await database.reset();

    return new KnexCalendarRepository(database.persistence.database, scope, clock);
  },
  recreate: (calendar: Calendar) => aCalendar().identifiedBy(calendar.id).build(),
  elevatedReads: true,
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
