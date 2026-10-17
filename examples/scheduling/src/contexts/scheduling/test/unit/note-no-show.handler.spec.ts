import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { NoteNoShowCommand } from '@/contexts/scheduling/application/commands/note-no-show/note-no-show.command';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [schedulingPermissions['attendance.note']] },
  }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-03-02T09:00:00.000Z');

describe('Note no show', () => {
  it('opens the record of the patient in the practice with its first fact, and answers its identifier', async () => {
    const { application, records } = await arrange();

    const id = await application.commandBus.execute(
      new NoteNoShowCommand(holder, 'practice-1', 'patient-1', 'appointment-1', startsAt),
    );

    expect(id).toBe('practice-1.patient-1');
    expect((await records.findById(id))?.missed).toBe(1);

    expect(
      (await records.store.readStream('scheduling.attendance-record-practice-1.patient-1')).map((event) => event.type),
    ).toEqual(['scheduling.attendance-record.created', 'scheduling.attendance-record.no-show-noted']);
  });

  it('notes a later fact in the same record, at the end of its stream', async () => {
    const { application, records } = await arrange();

    await application.commandBus.execute(
      new NoteNoShowCommand(holder, 'practice-1', 'patient-1', 'appointment-1', startsAt),
    );

    await application.commandBus.execute(
      new NoteNoShowCommand(holder, 'practice-1', 'patient-1', 'appointment-2', startsAt),
    );

    expect((await records.findById('practice-1.patient-1'))?.missed).toBe(2);
  });

  it('refuses to note the same appointment twice, and appends nothing', async () => {
    const { application, records } = await arrange();

    await application.commandBus.execute(
      new NoteNoShowCommand(holder, 'practice-1', 'patient-1', 'appointment-1', startsAt),
    );

    await expect(
      application.commandBus.execute(
        new NoteNoShowCommand(holder, 'practice-1', 'patient-1', 'appointment-1', startsAt),
      ),
    ).rejects.toMatchObject({
      code: 'ALREADY_NOTED',
    });

    expect(await records.store.head()).toBe(2);
  });

  it('is refused to an actor who does not hold the permission attendance.note', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(
        new NoteNoShowCommand(anActor().build(), 'practice-1', 'patient-1', 'appointment-1', startsAt),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange() {
  const { application, attendanceRecordRepository } = await aSchedulingWorld({ modules: [holders] });

  return { application, records: attendanceRecordRepository };
}
