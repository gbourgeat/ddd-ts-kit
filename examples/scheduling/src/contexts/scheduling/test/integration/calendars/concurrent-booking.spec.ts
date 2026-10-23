import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeAuthenticator, anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule } from '@ddd-ts-kit/di';
import { executeRoute, type RouteResponse } from '@ddd-ts-kit/http';
import { FixedExecutionScope, SystemClock, executionContext, systemActor } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { composeApplication, type Application } from '@/platform/composition/compose-application';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { inProcessEvents } from '@/platform/events/in-process-events';
import { KnexAppointmentRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-appointment.repository';
import { KnexCalendarRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-calendar.repository';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';

const DAY = 24 * 60 * 60_000;
const clock = new SystemClock();

const seeding = new FixedExecutionScope(
  executionContext({
    correlationId: 'concurrent-booking',
    actor: systemActor('scheduling.spec'),
    origin: 'test',
    tenantId: 'north',
  }),
);

// Two patients, each booking for themselves: what the role of a patient allows on any calendar.
const authenticator = new FakeAuthenticator({
  ada: anActor().named('ada').ofTenant('north').withRole('patient').build(),
  bob: anActor().named('bob').ofTenant('north').withRole('patient').build(),
});

const calendar = aCalendar()
  .identifiedBy('calendar-contended')
  .openEveryDay(['08:00', '18:00'])
  .offering('consultation', { buffer: 10 })
  .build();

// Ten in the morning on the wall clock of the practice, a week from now: inside the booking window whenever the spec runs.
const startsAt = calendar.timeZone.instantAt(
  calendar.timeZone.dayOf(new Date(clock.now().getTime() + 7 * DAY)),
  10 * 60,
);

let database: TestDatabase;
let application: Application;

beforeAll(async () => {
  // With DATABASE_URL the two bookings are two transactions of a real server, truly concurrent; in process one session serialises them.
  database = await openTestDatabase(process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL']);

  application = composeApplication(
    database.persistence,
    { events: inProcessEvents(), authenticator },
    { modules: [contextModule('scheduling', schedulingDeclarations)] },
  );

  await application.start();
});

afterAll(async () => {
  await application.stop();
  await database.close();
});

beforeEach(async () => {
  await database.reset();

  await new KnexCalendarRepository(database.persistence.database, seeding, clock).save(
    aCalendar()
      .identifiedBy('calendar-contended')
      .openEveryDay(['08:00', '18:00'])
      .offering('consultation', { buffer: 10 })
      .build(),
  );
});

describe('Two bookings of one slot at once', () => {
  it('lets exactly one win; the other is told that the slot is taken, in the words of the domain and not as a failure', async () => {
    const answers = await Promise.all([book('ada', startsAt), book('bob', startsAt)]);

    const won = answers.filter((answer) => answer.status === 201);
    const lost = answers.filter((answer) => answer.status !== 201);

    expect(won).toHaveLength(1);
    expect(lost.map((answer) => answer.body)).toMatchObject([{ code: 'SLOT_TAKEN' }]);
    expect(lost.every((answer) => answer.status < 500)).toBe(true);
  });

  // The status of a code is the platform's to give, in its error mapper: this is the application answering, not the route alone.
  it('answers the one who lost with 409 Conflict', async () => {
    const answers = await Promise.all([book('ada', startsAt), book('bob', startsAt)]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([201, 409]);
  });

  it('holds the slot once, whoever won', async () => {
    await Promise.all([book('ada', startsAt), book('bob', startsAt)]);

    const held = await new KnexAppointmentRepository(database.persistence.database, seeding, clock).heldOn(
      'calendar-contended',
      startsAt,
      new Date(startsAt.getTime() + 1),
    );

    expect(held).toHaveLength(1);
    expect(held[0]?.status).toBe('booked');
  });

  it('refuses a booking that starts in the buffer of one made at the same instant, and takes one that does not touch them', async () => {
    const inTheBuffer = new Date(startsAt.getTime() + 30 * 60_000);
    // Clear of both contenders, whichever wins: the one in the buffer, had it won, would hold its own buffer after it.
    const apart = new Date(startsAt.getTime() + 120 * 60_000);

    const [first, second, third] = await Promise.all([
      book('ada', startsAt),
      book('bob', inTheBuffer),
      book('bob', apart),
    ]);

    expect([first.status, second.status].filter((status) => status === 201)).toHaveLength(1);
    expect([first.body, second.body].filter((body) => codeOf(body) === 'SLOT_TAKEN')).toHaveLength(1);
    expect(third.status).toBe(201);
  });

  it('answers many bookings of one slot with one success and refusals of a taken slot only, never a failure', async () => {
    const answers = await Promise.all(
      ['ada', 'bob', 'ada', 'bob', 'ada', 'bob'].map((patient) => book(patient, startsAt)),
    );

    expect(answers.filter((answer) => answer.status === 201)).toHaveLength(1);
    expect(answers.filter((answer) => codeOf(answer.body) === 'SLOT_TAKEN')).toHaveLength(5);
  });
});

function codeOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined;
}

/** The route as the HTTP server runs it: authenticated, in the execution scope, through the buses and their unit of work. */
function book(patient: string, start: Date): Promise<RouteResponse> {
  const route = application.routes.find((candidate) => candidate.operationId === 'bookAppointment');

  if (route === undefined) {
    throw new Error('The application does not serve bookAppointment.');
  }

  const headers = { authorization: 'Bearer ' + patient };
  const body = { calendarId: 'calendar-contended', appointmentTypeId: 'consultation', startsAt: start.toISOString() };

  return executeRoute(route, { params: {}, query: {}, headers, body, raw: { headers } }, application.boundary);
}
