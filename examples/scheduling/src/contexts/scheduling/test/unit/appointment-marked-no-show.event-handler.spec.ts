import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { NoteNoShowCommand } from '@/contexts/scheduling/application/commands/note-no-show/note-no-show.command';
import { AppointmentMarkedNoShowEventHandler } from '@/contexts/scheduling/application/event-handlers/appointment-marked-no-show.event-handler';
import { AppointmentMarkedNoShow } from '@/contexts/scheduling/domain/events/appointment-marked-no-show.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const held = anAppointment().identifiedBy('appointment-1').startingAt(new Date('2026-03-02T09:00:00.000Z')).build();

describe('When appointment marked no show', () => {
  it('notes the no-show in the attendance record of the patient, as the context itself', async () => {
    const noted: NoteNoShowCommand[] = [];

    const commands = new InMemoryCommandBus().register(NoteNoShowCommand, {
      execute: async (command) => {
        noted.push(command);

        return 'record-1';
      },
    });

    await new AppointmentMarkedNoShowEventHandler(commands).handle(
      new AppointmentMarkedNoShow('appointment-1', new Date('2026-03-02T09:20:00.000Z'), held.booking),
    );

    expect(noted).toMatchObject([
      {
        practiceId: held.booking.practiceId,
        patientId: held.booking.patientId,
        appointmentId: 'appointment-1',
        startsAt: new Date('2026-03-02T09:00:00.000Z'),
        actor: { type: 'system', id: 'system:scheduling.note-attendance' },
      },
    ]);
  });
});
