import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { GetCalendarDayQuery } from '#src/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.query.js';
import type { GetCalendarDayResult } from '#src/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.result.js';
import { UnknownCalendarError } from '#src/contexts/scheduling/domain/errors/unknown-calendar.error.js';
import { getCalendarDayRoute } from '#src/contexts/scheduling/presentation/http/get-calendar-day.route.js';

const shown: GetCalendarDayResult = {
  calendarId: 'calendar-1',
  day: '2026-03-02',
  timeZone: 'Europe/Paris',
  open: [{ startsAt: at('08:00'), endsAt: at('11:00') }],
  timeOff: [{ startsAt: at('10:00'), endsAt: at('11:00') }],
  appointmentTypes: [
    { id: 'consultation', name: 'Consultation', duration: 30, grid: 30, buffer: 10, needsConfirmation: false },
  ],
  busy: [
    {
      startsAt: at('08:00'),
      endsAt: at('08:30'),
      heldUntil: at('08:40'),
      appointment: { id: 'appointment-1', patientId: 'patient-1', appointmentTypeId: 'consultation', status: 'booked' },
    },
    { startsAt: at('09:00'), endsAt: at('09:30'), heldUntil: at('09:40') },
  ],
};

describe('GET /calendars/:calendarId/days/:day', () => {
  it('answers 200 with the day as the use case shows it, instants written in ISO 8601', async () => {
    const received: GetCalendarDayQuery[] = [];

    const response = await executeRoute(getCalendarDayRoute(showingAndKeeping(received)), request('2026-03-02'), {
      validateResponses: true,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      calendarId: 'calendar-1',
      day: '2026-03-02',
      timeZone: 'Europe/Paris',
      open: [{ startsAt: '2026-03-02T08:00:00.000Z', endsAt: '2026-03-02T11:00:00.000Z' }],
      timeOff: [{ startsAt: '2026-03-02T10:00:00.000Z', endsAt: '2026-03-02T11:00:00.000Z' }],
      appointmentTypes: shown.appointmentTypes,
      busy: [
        {
          startsAt: '2026-03-02T08:00:00.000Z',
          endsAt: '2026-03-02T08:30:00.000Z',
          heldUntil: '2026-03-02T08:40:00.000Z',
          appointment: shown.busy[0]?.appointment,
        },
        {
          startsAt: '2026-03-02T09:00:00.000Z',
          endsAt: '2026-03-02T09:30:00.000Z',
          heldUntil: '2026-03-02T09:40:00.000Z',
        },
      ],
    });

    expect(received).toMatchObject([{ calendarId: 'calendar-1', day: '2026-03-02' }]);
  });

  it('never names the patient of a slot the use case shows as busy only', async () => {
    const queries = new InMemoryQueryBus().register(GetCalendarDayQuery, { execute: async () => shown });

    const response = await executeRoute(getCalendarDayRoute(queries), request('2026-03-02'), {
      validateResponses: true,
    });

    expect(JSON.stringify(response.body)).not.toContain('patient-2');

    expect(response.body).toMatchObject({
      busy: [{}, expect.not.objectContaining({ appointment: expect.anything() })],
    });
  });

  it('refuses a day that is not written YYYY-MM-DD with 422', async () => {
    const queries = new InMemoryQueryBus().register(GetCalendarDayQuery, { execute: async () => shown });

    const response = await executeRoute(getCalendarDayRoute(queries), request('monday'), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const queries = new InMemoryQueryBus().register(GetCalendarDayQuery, {
      execute: async () => {
        throw new UnknownCalendarError('calendar-1');
      },
    });

    const response = await executeRoute(getCalendarDayRoute(queries), request('2026-03-02'), {
      validateResponses: true,
    });

    expect(response).toMatchObject({ status: 422, body: { code: 'UNKNOWN_CALENDAR' } });
  });
});

/** The use case, replaced by one that shows the day and keeps the queries it received. */
function showingAndKeeping(received: GetCalendarDayQuery[]) {
  return new InMemoryQueryBus().register(GetCalendarDayQuery, {
    execute: async (query) => {
      received.push(query);

      return shown;
    },
  });
}

function request(day: string) {
  return { params: { calendarId: 'calendar-1', day }, query: {}, headers: {}, body: undefined, raw: undefined };
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
