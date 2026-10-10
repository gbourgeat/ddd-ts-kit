import { describe, expect, it } from 'vitest';
import { AppointmentBookedEventHandler } from '../../application/event-handlers/appointment-booked.event-handler.js';
import { AppointmentBooked } from '../../domain/events/appointment-booked.event.js';
import { anAppointment } from '../builders/appointment.builder.js';
import { FakeSchedulingRelationships } from '../fakes/scheduling-relationships.fake.js';

const held = anAppointment().identifiedBy('appointment-1').onCalendar('calendar-4').forPatient('patient-5').build();
const booked = new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), { booking: held.booking });

describe('When appointment booked', () => {
  it('records whose appointment it is and which calendar holds it', async () => {
    const relationships = new FakeSchedulingRelationships();
    const handler = new AppointmentBookedEventHandler(relationships);

    await handler.handle(booked);

    expect(relationships.current).toEqual(['appointment appointment-1 of patient patient-5', 'appointment appointment-1 on calendar calendar-4']);
  });

  it('records the same for an appointment that is only requested', async () => {
    const relationships = new FakeSchedulingRelationships();
    const handler = new AppointmentBookedEventHandler(relationships);

    await handler.handle(new AppointmentBooked('appointment-2', booked.occurredAt, { booking: held.booking, confirmBefore: new Date('2026-01-02T00:00:00.000Z') }));

    expect(relationships.current).toHaveLength(2);
  });

  it('knows nothing more when the same fact comes twice', async () => {
    const relationships = new FakeSchedulingRelationships();
    const handler = new AppointmentBookedEventHandler(relationships);

    await handler.handle(booked);
    await handler.handle(booked);

    expect(relationships.current).toHaveLength(2);
  });
});
