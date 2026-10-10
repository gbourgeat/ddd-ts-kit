import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '../../scheduling.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { schedulingPermissions } from '../../application/authorization/scheduling.permissions.js';
import { AddExceptionCommand } from '../../application/commands/add-exception/add-exception.command.js';
import { CalendarRepository } from '../../domain/repositories/calendar.repository.js';
import { aCalendar } from '../builders/calendar.builder.js';
import { FakeCalendarRepository } from '../fakes/calendar.repository.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['calendar.add-exception']] } }),
});

const holder = anActor().withRole('holder').build();

describe('Add exception', () => {
  it('opens the day on the ranges of its exception and answers the identifier of the calendar', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(
      new AddExceptionCommand(holder, 'calendar-1', '2026-05-01', [{ start: '10:00', end: '12:00' }]),
    );

    const stored = await calendarRepository.findById('calendar-1');

    expect(id).toBe('calendar-1');
    expect(stored?.rangesOn('2026-05-01').map((range) => [range.start, range.end])).toEqual([['10:00', '12:00']]);
    expect(stored?.rangesOn('2026-05-02').map((range) => range.start)).toEqual(['08:00']);
  });

  it('is refused to an actor who does not hold the permission calendar.add-exception', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new AddExceptionCommand(anActor().build(), 'calendar-1', '2026-05-01', [])),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('closes the day when the exception has no range', async () => {
    const { application, calendarRepository } = await arrange();

    await application.commandBus.execute(new AddExceptionCommand(holder, 'calendar-1', '2026-05-01', []));

    expect((await calendarRepository.findById('calendar-1'))?.rangesOn('2026-05-01')).toEqual([]);
  });

  it('announces the exception with its day', async () => {
    const { application } = await arrange();
    const announced: unknown[] = [];

    application.domainEvents.on('scheduling.calendar.exception-added', async (event) => {
      announced.push(event);
    });

    await application.commandBus.execute(new AddExceptionCommand(holder, 'calendar-1', '2026-05-01', []));

    expect(announced).toMatchObject([{ aggregateId: 'calendar-1', day: '2026-05-01' }]);
  });

  it.each([
    ['a day that does not exist', '2026-02-30', [], 'INVALID_DAY'],
    ['a range that ends before it starts', '2026-05-01', [{ start: '12:00', end: '10:00' }], 'INVALID_RANGE'],
    [
      'ranges that overlap',
      '2026-05-01',
      [
        { start: '10:00', end: '12:00' },
        { start: '11:00', end: '13:00' },
      ],
      'INVALID_RANGE',
    ],
  ])('refuses %s and leaves the calendar as it was', async (...[, day, ranges, code]) => {
    const { application, calendarRepository } = await arrange();

    await expect(
      application.commandBus.execute(new AddExceptionCommand(holder, 'calendar-1', day, ranges)),
    ).rejects.toMatchObject({ code });

    expect(
      (await calendarRepository.findById('calendar-1'))?.rangesOn('2026-05-01').map((range) => range.start),
    ).toEqual(['08:00']);
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new AddExceptionCommand(holder, 'calendar-9', '2026-05-01', [])),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });
});

async function arrange() {
  const calendarRepository = new FakeCalendarRepository();

  await calendarRepository.save(aCalendar().identifiedBy('calendar-1').openEveryDay(['08:00', '20:00']).build());

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(CalendarRepository, calendarRepository)],
    idPrefix: 'id',
  });

  return { application, calendarRepository };
}
