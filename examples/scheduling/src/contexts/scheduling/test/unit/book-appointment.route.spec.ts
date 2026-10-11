import { describe, expect, it } from 'vitest';
import { createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';
import { PatientLimitReachedError } from '@/contexts/scheduling/domain/errors/patient-limit-reached.error';
import { SlotTakenError } from '@/contexts/scheduling/domain/errors/slot-taken.error';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import { bookAppointmentRoute } from '@/contexts/scheduling/presentation/http/book-appointment.route';

// The one table of the platform: a code it does not name answers 422.
const errorMapper = createErrorMapper(errorStatuses);

describe('POST /appointments', () => {
  it('answers 201 with the identifier of the appointment and hands the use case what the client sent', async () => {
    const received: BookAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(BookAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const response = await executeRoute(
      bookAppointmentRoute(commands),
      request({
        calendarId: 'calendar-1',
        appointmentTypeId: 'consultation',
        startsAt: '2026-03-02T09:00:00+01:00',
        patientId: 'patient-1',
      }),
      { validateResponses: true },
    );

    expect(response).toMatchObject({ status: 201, body: { id: 'appointment-1' } });

    expect(received).toMatchObject([
      {
        calendarId: 'calendar-1',
        wish: {
          patientId: 'patient-1',
          appointmentTypeId: 'consultation',
          startsAt: new Date('2026-03-02T08:00:00.000Z'),
        },
      },
    ]);
  });

  it.each([
    ['without a calendar', { appointmentTypeId: 'consultation', startsAt: '2026-03-02T09:00:00Z' }],
    ['without an appointment type', { calendarId: 'calendar-1', startsAt: '2026-03-02T09:00:00Z' }],
    [
      'whose start is no instant',
      { calendarId: 'calendar-1', appointmentTypeId: 'consultation', startsAt: 'monday morning' },
    ],
    [
      'whose patient is empty',
      { calendarId: 'calendar-1', appointmentTypeId: 'consultation', startsAt: '2026-03-02T09:00:00Z', patientId: '' },
    ],
  ])('refuses a body %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(BookAppointmentCommand, {
      execute: async () => 'appointment-1',
    });

    const response = await executeRoute(bookAppointmentRoute(commands), request(body), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it.each([
    [new SlotTakenError('calendar-1', new Date('2026-03-02T08:00:00.000Z')), 409, 'SLOT_TAKEN'],
    [new PatientLimitReachedError(3), 409, 'PATIENT_LIMIT_REACHED'],
    [new UnknownCalendarError('calendar-1'), 404, 'UNKNOWN_CALENDAR'],
  ])('answers the refusal %o with the status %i and the code %s', async (refusal, status, code) => {
    const commands = new InMemoryCommandBus().register(BookAppointmentCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(
      bookAppointmentRoute(commands),
      request({
        calendarId: 'calendar-1',
        appointmentTypeId: 'consultation',
        startsAt: '2026-03-02T09:00:00+01:00',
        patientId: 'patient-1',
      }),
      { validateResponses: true, errorMapper },
    );

    expect(response).toMatchObject({ status, body: { code } });
  });
});

function request(body: unknown) {
  return { params: {}, query: {}, headers: {}, body, raw: undefined };
}

describe('POST /appointments, for oneself', () => {
  it('books for the caller when the body names no patient', async () => {
    const received: BookAppointmentCommand[] = [];

    const commands = new InMemoryCommandBus().register(BookAppointmentCommand, {
      execute: async (command) => {
        received.push(command);

        return 'appointment-1';
      },
    });

    const body = { calendarId: 'calendar-1', appointmentTypeId: 'consultation', startsAt: '2026-03-02T08:00:00Z' };

    await executeRoute(bookAppointmentRoute(commands), request(body), { validateResponses: true });

    expect(received[0]?.wish.patientId).toBe(received[0]?.actor.id);
  });
});
