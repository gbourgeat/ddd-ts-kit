import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { AppointmentConfirmedPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-confirmed.publisher';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/calendars/events/appointment-confirmed.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const held = anAppointment()
  .identifiedBy('appointment-1')
  .onCalendar('calendar-4')
  .inPractice('practice-2')
  .withPractitioner('practitioner-3')
  .forPatient('patient-5')
  .startingAt(new Date('2026-03-02T09:00:00.000Z'))
  .lasting(45)
  .withBuffer(15)
  .build();

describe('Publishing "appointment confirmed" to other contexts', () => {
  it('publishes version 1 of scheduling.appointment.confirmed', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentConfirmedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentConfirmed('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking),
    );

    expect(bus.published).toMatchObject([
      { id: 'event-1', type: 'scheduling.appointment.confirmed', version: 1, occurredAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('carries every field of the public payload, the buffer left out', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentConfirmedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentConfirmed('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking),
    );

    expect(bus.published.map((event) => event.payload)).toEqual([
      {
        appointmentId: 'appointment-1',
        calendarId: 'calendar-4',
        practiceId: 'practice-2',
        practitionerId: 'practitioner-3',
        patientId: 'patient-5',
        startsAt: '2026-03-02T09:00:00.000Z',
        endsAt: '2026-03-02T09:45:00.000Z',
        day: '2026-03-02',
      },
    ]);
  });
});
