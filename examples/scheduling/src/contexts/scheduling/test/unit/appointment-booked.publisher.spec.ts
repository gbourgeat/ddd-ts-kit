import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { AppointmentBookedPublisher } from '@/contexts/scheduling/application/integration/publishers/appointment-booked.publisher';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
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

describe('Publishing "appointment booked" to other contexts', () => {
  it('publishes version 1 of scheduling.appointment.booked', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentBookedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), { booking: held.booking }),
    );

    expect(bus.published).toMatchObject([
      { id: 'event-1', type: 'scheduling.appointment.booked', version: 1, occurredAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('carries every field of the public payload, the buffer left out', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentBookedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), { booking: held.booking }),
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
        ...{ status: 'booked' },
      },
    ]);
  });
});

describe('Publishing a requested appointment to other contexts', () => {
  it('says that it is requested and until when it can be confirmed', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new AppointmentBookedPublisher(bus, new SequentialIdGenerator('event'));
    const confirmBefore = new Date('2026-01-02T00:00:00.000Z');

    await publisher.handle(
      new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
        booking: held.booking,
        confirmBefore,
      }),
    );

    expect(bus.published.map((event) => event.payload)).toMatchObject([
      { status: 'requested', confirmBefore: '2026-01-02T00:00:00.000Z' },
    ]);
  });
});
