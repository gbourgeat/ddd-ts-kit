import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { bookAppointment } from '$test/e2e/support/book-appointment';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

interface Clearance {
  readonly status: string;
  readonly done: number;
  readonly total?: number;
}

const DAY = 24 * 3_600_000;
/** The worker asks the queue once a second: a clearance of two appointments is over within a few. */
const WORKER_PATIENCE = { timeoutMs: 10_000, intervalMs: 200 };

describe('A practitioner goes away: a worker clears the calendar, then the time off is accepted', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let grace: HttpClient;
  const startsAt = slotStarting({ days: 7 });
  const away = { startsAt: new Date(startsAt.getTime() - DAY), endsAt: new Date(startsAt.getTime() + 2 * DAY) };

  beforeAll(async () => {
    application = await startApplication({ jobs: true });
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
    practice = await openStaffedPractice(application, hillside);
    await registerPeople(application, 'paul', 'rosa');
    paul = await application.as({ id: 'paul', roles: ['patient'] });
    grace = await application.as({ id: practice.practitionerId });
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('cancels the appointments of the period one by one, says how far it went, and the calendar can close', async () => {
    const rosa = await application.as({ id: 'rosa', roles: ['patient'] });
    const first = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;

    expectStatus(await bookAppointment(rosa, practice, { startsAt: new Date(startsAt.getTime() + DAY) }), 201);
    const timeOff = '/calendars/' + practice.calendarId + '/time-off';
    const period = { startsAt: away.startsAt.toISOString(), endsAt: away.endsAt.toISOString() };

    expectProblem(await grace.post(timeOff, period), { status: 409, code: 'TIME_OFF_OVER_APPOINTMENTS' });

    const asked = await grace.post<{ id: string }>('/calendars/' + practice.calendarId + '/clearances', {
      ...period,
      reason: 'The practitioner is away',
    });

    const followed = '/calendars/' + practice.calendarId + '/clearances/' + expectStatus(asked, 202).body.id;

    const over = await eventually(async () => {
      const clearance = expectStatus(await grace.get<Clearance>(followed), 200).body;

      expect(clearance.status).toBe('succeeded');

      return clearance;
    }, WORKER_PATIENCE);

    expect(over).toMatchObject({ done: 2, total: 2 });

    expect(expectStatus(await paul.get<{ status: string }>('/appointments/' + first), 200).body.status).toBe(
      'cancelled',
    );

    expectStatus(await grace.post(timeOff, period), 201);
  });

  it('shows a clearance to whoever may clear the calendar, and to nobody else', async () => {
    const asked = await grace.post<{ id: string }>('/calendars/' + practice.calendarId + '/clearances', {
      startsAt: away.startsAt.toISOString(),
      endsAt: away.endsAt.toISOString(),
      reason: 'The practitioner is away',
    });

    const followed = '/calendars/' + practice.calendarId + '/clearances/' + expectStatus(asked, 202).body.id;

    expectProblem(await paul.get(followed), { status: 403, code: 'FORBIDDEN' });

    expectProblem(await grace.get('/calendars/' + practice.calendarId + '/clearances/nothing'), {
      status: 404,
      code: 'UNKNOWN_CLEARANCE',
    });

    const elsewhere = await openStaffedPractice(application, riverside);
    const hedy = await application.as({ id: elsewhere.practitionerId });
    const clearanceId = expectStatus(asked, 202).body.id;

    expectProblem(await hedy.get('/calendars/' + elsewhere.calendarId + '/clearances/' + clearanceId), {
      status: 404,
      code: 'UNKNOWN_CLEARANCE',
    });
  });
});

const hillside = { name: 'Hillside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };
const riverside = { name: 'Riverside', managerId: 'barbara', practitionerId: 'hedy', assistantId: 'alan' };
