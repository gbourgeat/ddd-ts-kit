import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, unwrap } from '@ddd-ts-kit/kernel';
import { OfferFreedSlotCommand } from '../../application/commands/offer-freed-slot/offer-freed-slot.command.js';
import { AppointmentCancelledEventHandler } from '../../application/event-handlers/appointment-cancelled.event-handler.js';
import { AppointmentCancelled } from '../../domain/events/appointment-cancelled.event.js';
import { Cancellation } from '../../domain/value-objects/cancellation.vo.js';
import { anAppointment } from '../builders/appointment.builder.js';

const occurredAt = new Date('2026-03-01T00:00:00.000Z');
const held = anAppointment().identifiedBy('appointment-1').onCalendar('calendar-4').startingAt(at('09:00')).lasting(30).withBuffer(10).build();

describe('When appointment cancelled', () => {
  it('offers the slot the appointment held, buffer included, to the waitlist of its calendar', async () => {
    const { handler, sent } = arrange();

    await handler.handle(new AppointmentCancelled('appointment-1', occurredAt, { booking: held.booking, cancellation: unwrap(Cancellation.create('patient')) }));

    expect(sent).toMatchObject([{ calendarId: 'calendar-4', freed: { startsAt: at('09:00'), endsAt: at('09:30'), heldUntil: at('09:40') } }]);
  });

  it('acts as the context itself, not as whoever caused the fact', async () => {
    const { handler, sent } = arrange();

    await handler.handle(new AppointmentCancelled('appointment-1', occurredAt, { booking: held.booking, cancellation: unwrap(Cancellation.create('patient')) }));

    expect(sent[0]?.actor).toMatchObject({ type: 'system', id: 'system:scheduling.offer-freed-slot' });
  });
});

function arrange() {
  const sent: OfferFreedSlotCommand[] = [];

  const commands = new InMemoryCommandBus().register(OfferFreedSlotCommand, {
    execute: async (command) => {
      sent.push(command);

      return undefined;
    },
  });

  return { handler: new AppointmentCancelledEventHandler(commands), sent };
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
