import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { NoteCancellationCommand } from '@/contexts/scheduling/application/commands/note-cancellation/note-cancellation.command';
import { AttendanceRecordRepository } from '@/contexts/scheduling/domain/repositories/attendance-record.repository';
import { FakeAttendanceRecordRepository } from '@/contexts/scheduling/test/fakes/attendance-record.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [schedulingPermissions['attendance.note']] },
  }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-03-02T09:00:00.000Z');

describe('Note cancellation', () => {
  it('opens the record of the patient in the practice with its first fact, and answers its identifier', async () => {
    const { application, records } = arrange();

    const id = await application.commandBus.execute(
      new NoteCancellationCommand(holder, 'practice-1', 'patient-1', { id: 'appointment-1', startsAt }, 'Flu'),
    );

    expect(id).toBe('practice-1.patient-1');
    expect((await records.findById(id))?.missed).toBe(1);

    expect(
      (await records.store.readStream('scheduling.attendance-record-practice-1.patient-1')).map((event) => event.type),
    ).toEqual(['scheduling.attendance-record.created', 'scheduling.attendance-record.cancellation-noted']);
  });

  it('notes a later fact in the same record, at the end of its stream', async () => {
    const { application, records } = arrange();

    await application.commandBus.execute(
      new NoteCancellationCommand(holder, 'practice-1', 'patient-1', { id: 'appointment-1', startsAt }, 'Flu'),
    );

    await application.commandBus.execute(
      new NoteCancellationCommand(holder, 'practice-1', 'patient-1', { id: 'appointment-2', startsAt }, 'Flu'),
    );

    expect((await records.findById('practice-1.patient-1'))?.missed).toBe(2);
  });

  it('refuses to note the same appointment twice, and appends nothing', async () => {
    const { application, records } = arrange();

    await application.commandBus.execute(
      new NoteCancellationCommand(holder, 'practice-1', 'patient-1', { id: 'appointment-1', startsAt }, 'Flu'),
    );

    await expect(
      application.commandBus.execute(
        new NoteCancellationCommand(holder, 'practice-1', 'patient-1', { id: 'appointment-1', startsAt }, undefined),
      ),
    ).rejects.toMatchObject({
      code: 'ALREADY_NOTED',
    });

    expect(await records.store.head()).toBe(2);
  });

  it('is refused to an actor who does not hold the permission attendance.note', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(
        new NoteCancellationCommand(
          anActor().build(),
          'practice-1',
          'patient-1',
          { id: 'appointment-1', startsAt },
          'Flu',
        ),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

function arrange() {
  const context = contextModule('scheduling', schedulingDeclarations);
  const records = new FakeAttendanceRecordRepository();

  const application = createTestApplication({
    modules: [platformTestModule, context, holders],
    fakes: [fake(AttendanceRecordRepository, records)],
  });

  return { application, records };
}
