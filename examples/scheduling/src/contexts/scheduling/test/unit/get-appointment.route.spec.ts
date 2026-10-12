import { describe, expect, it } from 'vitest';
import { createErrorMapper, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { GetAppointmentQuery } from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.query';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import { getAppointmentRoute } from '@/contexts/scheduling/presentation/http/get-appointment.route';
import { anAgendaEntry } from '@/contexts/scheduling/test/builders/agenda-entry.builder';

const entry = anAgendaEntry().withMany({ id: 'appointment-1', status: 'cancelled', cancelledBy: 'patient' }).build();

describe('GET /appointments/:appointmentId', () => {
  it('answers 200 with the public fields of the appointment and the name of its patient', async () => {
    const received: GetAppointmentQuery[] = [];

    const queries = new InMemoryQueryBus().register(GetAppointmentQuery, {
      execute: async (query) => {
        received.push(query);

        return { ...entry, patientName: 'Ada Martin' };
      },
    });

    const response = await executeRoute(getAppointmentRoute(queries), request('appointment-1'), {
      validateResponses: true,
    });

    expect(received).toMatchObject([{ appointmentId: 'appointment-1' }]);
    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      id: 'appointment-1',
      calendarId: 'calendar-1',
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      patientId: 'patient-1',
      appointmentTypeId: 'consultation',
      startsAt: '2026-03-02T09:00:00.000Z',
      endsAt: '2026-03-02T09:30:00.000Z',
      day: '2026-03-02',
      status: 'cancelled',
      cancelledBy: 'patient',
      patientName: 'Ada Martin',
    });
  });

  it('leaves the name out when the use case could not learn it', async () => {
    const queries = new InMemoryQueryBus().register(GetAppointmentQuery, { execute: async () => entry });

    const response = await executeRoute(getAppointmentRoute(queries), request('appointment-1'), {
      validateResponses: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('patientName');
  });

  it('answers 404 with its code for an appointment that does not exist', async () => {
    const queries = new InMemoryQueryBus().register(GetAppointmentQuery, {
      execute: async () => {
        throw AppointmentError.notFound('appointment-1');
      },
    });

    const response = await executeRoute(getAppointmentRoute(queries), request('appointment-1'), {
      validateResponses: true,
      errorMapper: createErrorMapper(errorStatuses),
    });

    expect(response).toMatchObject({ status: 404, body: { code: 'APPOINTMENT_NOT_FOUND' } });
  });
});

function request(appointmentId: string) {
  return { params: { appointmentId }, query: {}, headers: {}, body: undefined, raw: undefined };
}
