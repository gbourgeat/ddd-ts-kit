import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/waitlist/application/commands/offer-freed-slot/offer-freed-slot.command';
import { AppointmentRescheduledEventHandler } from '@/contexts/scheduling/waitlist/application/event-handlers/appointment-rescheduled.event-handler';
import { AppointmentRescheduled } from '@/contexts/scheduling/calendars/domain/events/appointment-rescheduled.event';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const occurredAt = new Date('2026-03-01T00:00:00.000Z');

const held = anAppointment()
  .identifiedBy('appointment-1')
  .onCalendar('calendar-4')
  .startingAt(at('09:00'))
  .lasting(30)
  .withBuffer(10)
  .build();

describe('When appointment rescheduled', () => {
  it('offers the slot the appointment held, buffer included, to the waitlist of its calendar', async () => {
    const { handler, sent } = arrange();

    await handler.handle(
      new AppointmentRescheduled('appointment-1', occurredAt, {
        booking: held.booking.movedTo(Slot.between(at('14:00'), at('14:30'), at('14:30')), '2026-03-02'),
        previous: held.booking,
      }),
    );

    expect(sent).toMatchObject([
      { calendarId: 'calendar-4', freed: { startsAt: at('09:00'), endsAt: at('09:30'), heldUntil: at('09:40') } },
    ]);
  });

  it('acts as the context itself, not as whoever caused the fact', async () => {
    const { handler, sent } = arrange();

    await handler.handle(
      new AppointmentRescheduled('appointment-1', occurredAt, {
        booking: held.booking.movedTo(Slot.between(at('14:00'), at('14:30'), at('14:30')), '2026-03-02'),
        previous: held.booking,
      }),
    );

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

  return { handler: new AppointmentRescheduledEventHandler(commands), sent };
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
