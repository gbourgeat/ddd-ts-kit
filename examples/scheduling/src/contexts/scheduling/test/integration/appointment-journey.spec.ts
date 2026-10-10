import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeAuthenticator, anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule } from '@ddd-ts-kit/di';
import { executeRoute, type RouteResponse } from '@ddd-ts-kit/http';
import { FixedExecutionScope, SystemClock, executionContext, systemActor } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '../../scheduling.declarations.js';
import { composeApplication, type Application } from '../../../../platform/compose-application.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import { inProcessEvents } from '../../../../platform/events/in-process-events.js';
import { AgendaProjection } from '../../application/projections/agenda.projection.js';
import { KnexCalendarRepository } from '../../infrastructure/persistence/knex-calendar.repository.js';
import { schedulingRoutes } from '../../presentation/http/scheduling.routes.js';
import { aCalendar } from '../builders/calendar.builder.js';

const DAY = 24 * 60 * 60_000;
const clock = new SystemClock();
const seeding = new FixedExecutionScope(executionContext({ correlationId: 'appointment-journey', actor: systemActor('scheduling.spec'), origin: 'test' }));
// Two patients: what each may do to an appointment comes from the relationships the booking recorded, never from a role.
const authenticator = new FakeAuthenticator({ ada: anActor().named('ada').withRole('patient').build(), bob: anActor().named('bob').withRole('patient').build() });
const calendar = aCalendar().identifiedBy('calendar-journey').openEveryDay(['08:00', '18:00']).offering('consultation').build();
// Ten in the morning on the wall clock of the practice, a week from now: inside the booking window, and more than the notice of a patient away.
const startsAt = calendar.timeZone.instantAt(calendar.timeZone.dayOf(new Date(clock.now().getTime() + 7 * DAY)), 10 * 60);

let database: TestDatabase;
let application: Application;

beforeAll(async () => {
  database = await openTestDatabase(process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL']);
  application = composeApplication(database.persistence, { events: inProcessEvents(), authenticator }, { modules: [contextModule('scheduling', { ...schedulingDeclarations, AgendaProjection })], routes: [schedulingRoutes] });

  await application.start();
});

afterAll(async () => {
  await application.stop();
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  await new KnexCalendarRepository(database.persistence.database, seeding, clock).save(aCalendar().identifiedBy('calendar-journey').openEveryDay(['08:00', '18:00']).offering('consultation').build());
});

describe('An appointment, from its booking on, through the application', () => {
  it('shows a booked appointment to its patient, in the detail and in the list', async () => {
    const appointmentId = await booked('ada');

    const detail = await call('ada', 'getAppointment', { params: { appointmentId } });
    const list = await call('ada', 'listAppointments', {});

    expect(detail).toMatchObject({ status: 200, body: { id: appointmentId, calendarId: 'calendar-journey', patientId: 'ada', status: 'booked', startsAt: startsAt.toISOString() } });
    expect(list).toMatchObject({ status: 200, body: { items: [{ id: appointmentId }], total: 1 } });
  });

  it('hides the appointment of a patient from another one: nothing in their list, a refusal for its detail', async () => {
    const appointmentId = await booked('ada');

    const detail = await call('bob', 'getAppointment', { params: { appointmentId } });
    const list = await call('bob', 'listAppointments', {});

    expect(detail.status).toBe(403);
    expect(list).toMatchObject({ status: 200, body: { items: [], total: 0 } });
  });

  it('lets the patient cancel their appointment a week ahead, and gives the slot back', async () => {
    const appointmentId = await booked('ada');

    const cancellation = await call('ada', 'cancelAppointment', { params: { appointmentId }, body: {} });
    const detail = await call('ada', 'getAppointment', { params: { appointmentId } });
    const again = await call('bob', 'bookAppointment', { body: { calendarId: 'calendar-journey', appointmentTypeId: 'consultation', startsAt: startsAt.toISOString() } });

    expect(cancellation.status).toBe(201);
    expect(detail).toMatchObject({ status: 200, body: { status: 'cancelled', cancelledBy: 'patient' } });
    expect(again.status).toBe(201);
  });

  it('refuses another patient who tries to cancel or to move the appointment', async () => {
    const appointmentId = await booked('ada');

    const cancellation = await call('bob', 'cancelAppointment', { params: { appointmentId }, body: { reason: 'Mine now.' } });
    const move = await call('bob', 'rescheduleAppointment', { params: { appointmentId }, body: { startsAt: new Date(startsAt.getTime() + 60 * 60_000).toISOString() } });

    expect([cancellation.status, move.status]).toEqual([403, 403]);
  });

  it('lets the patient move their appointment in one step, and shows it at its new start', async () => {
    const appointmentId = await booked('ada');
    const later = new Date(startsAt.getTime() + 2 * 60 * 60_000);

    const move = await call('ada', 'rescheduleAppointment', { params: { appointmentId }, body: { startsAt: later.toISOString() } });
    const detail = await call('ada', 'getAppointment', { params: { appointmentId } });

    expect(move.status).toBe(201);
    expect(detail).toMatchObject({ status: 200, body: { startsAt: later.toISOString(), status: 'booked' } });
  });

  it('does not say whether an appointment exists to somebody nothing relates to it', async () => {
    const answer = await call('ada', 'cancelAppointment', { params: { appointmentId: 'appointment-unknown' }, body: {} });

    expect(answer.status).toBe(403);
  });
});

async function booked(patient: string): Promise<string> {
  const answer = await call(patient, 'bookAppointment', { body: { calendarId: 'calendar-journey', appointmentTypeId: 'consultation', startsAt: startsAt.toISOString() } });
  const id: unknown = typeof answer.body === 'object' && answer.body !== null && 'id' in answer.body ? answer.body.id : undefined;

  if (answer.status !== 201 || typeof id !== 'string') throw new Error('The booking was answered ' + String(answer.status) + '.');

  return id;
}

/** A route as the HTTP server runs it: authenticated, in the execution scope, through the buses and their unit of work. */
function call(patient: string, operationId: string, request: { readonly params?: Record<string, string>; readonly body?: unknown }): Promise<RouteResponse> {
  const route = application.routes.find((candidate) => candidate.operationId === operationId);

  if (route === undefined) throw new Error('The application does not serve ' + operationId + '.');

  const headers = { authorization: 'Bearer ' + patient };

  return executeRoute(route, { params: request.params ?? {}, query: {}, headers, body: request.body, raw: { headers } }, application.boundary);
}
