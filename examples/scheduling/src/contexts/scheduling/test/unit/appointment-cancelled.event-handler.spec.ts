import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { NoteCancellationCommand } from '@/contexts/scheduling/application/commands/note-cancellation/note-cancellation.command';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command';
import { AppointmentCancelledEventHandler } from '@/contexts/scheduling/application/event-handlers/appointment-cancelled.event-handler';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const occurredAt = new Date('2026-03-01T00:00:00.000Z');

const held = anAppointment()
  .identifiedBy('appointment-1')
  .onCalendar('calendar-4')
  .startingAt(at('09:00'))
  .lasting(30)
  .withBuffer(10)
  .build();

describe('When appointment cancelled', () => {
  it('notes a cancellation of the patient in their attendance record, with their words, as the context itself', async () => {
    const { handler, noted } = arrange();

    await handler.handle(
      new AppointmentCancelled('appointment-1', occurredAt, {
        booking: held.booking,
        cancellation: Cancellation.create('patient', 'Flu'),
      }),
    );

    expect(noted).toMatchObject([
      {
        practiceId: held.booking.practiceId,
        patientId: held.booking.patientId,
        appointment: { id: 'appointment-1', startsAt: at('09:00') },
        reason: 'Flu',
        actor: { type: 'system', id: 'system:scheduling.note-attendance' },
      },
    ]);
  });

  it('notes nothing when the practice cancelled', async () => {
    const { handler, noted } = arrange();

    await handler.handle(
      new AppointmentCancelled('appointment-1', occurredAt, {
        booking: held.booking,
        cancellation: Cancellation.create('practice', 'The practitioner is ill'),
      }),
    );

    expect(noted).toEqual([]);
  });

  it('offers the slot the appointment held, buffer included, to the waitlist of its calendar', async () => {
    const { handler, sent } = arrange();

    await handler.handle(
      new AppointmentCancelled('appointment-1', occurredAt, {
        booking: held.booking,
        cancellation: Cancellation.create('patient'),
      }),
    );

    expect(sent).toMatchObject([
      { calendarId: 'calendar-4', freed: { startsAt: at('09:00'), endsAt: at('09:30'), heldUntil: at('09:40') } },
    ]);
  });

  it('acts as the context itself, not as whoever caused the fact', async () => {
    const { handler, sent } = arrange();

    await handler.handle(
      new AppointmentCancelled('appointment-1', occurredAt, {
        booking: held.booking,
        cancellation: Cancellation.create('patient'),
      }),
    );

    expect(sent[0]?.actor).toMatchObject({ type: 'system', id: 'system:scheduling.offer-freed-slot' });
  });
});

function arrange() {
  const sent: OfferFreedSlotCommand[] = [];
  const noted: NoteCancellationCommand[] = [];

  const commands = new InMemoryCommandBus()
    .register(OfferFreedSlotCommand, {
      execute: async (command) => {
        sent.push(command);

        return undefined;
      },
    })
    .register(NoteCancellationCommand, {
      execute: async (command) => {
        noted.push(command);

        return 'record-1';
      },
    });

  return { handler: new AppointmentCancelledEventHandler(commands), sent, noted };
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
