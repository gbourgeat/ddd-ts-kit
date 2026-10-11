import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { AppointmentRescheduledPublisher } from '@/contexts/scheduling/application/integration/publishers/appointment-rescheduled.publisher';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/events/appointment-rescheduled.event';
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

const before = anAppointment().startingAt(new Date('2026-03-01T23:30:00.000Z')).onDay('2026-03-02').build();

describe('Publishing "appointment rescheduled" to other contexts', () => {
  it('publishes version 1 of scheduling.appointment.rescheduled', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentRescheduledPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentRescheduled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
        booking: held.booking,
        previous: before.booking,
      }),
    );

    expect(bus.published).toMatchObject([
      { id: 'event-1', type: 'scheduling.appointment.rescheduled', version: 1, occurredAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('carries every field of the public payload, the buffer left out', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentRescheduledPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentRescheduled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
        booking: held.booking,
        previous: before.booking,
      }),
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
        ...{ previousStartsAt: '2026-03-01T23:30:00.000Z', previousDay: '2026-03-02' },
      },
    ]);
  });
});
