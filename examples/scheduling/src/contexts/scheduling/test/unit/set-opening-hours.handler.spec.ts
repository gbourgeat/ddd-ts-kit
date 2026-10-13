import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['calendar.set-opening-hours']] } }),
});

const holder = anActor().withRole('holder').build();

const week = [
  { weekday: 'monday', start: '14:00', end: '18:00' },
  { weekday: 'monday', start: '09:00', end: '12:00' },
  { weekday: 'saturday', start: '09:00', end: '12:00' },
] as const;

describe('Set opening hours', () => {
  it('gives the calendar its weekly hours and answers its identifier', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', week));

    const stored = await calendarRepository.findById('calendar-1');

    expect(id).toBe('calendar-1');

    expect(stored?.rangesOn('2026-03-02').map((range) => [range.start, range.end])).toEqual([
      ['09:00', '12:00'],
      ['14:00', '18:00'],
    ]);

    expect(stored?.rangesOn('2026-03-07').map((range) => range.start)).toEqual(['09:00']);
  });

  it('is refused to an actor who does not hold the permission calendar.set-opening-hours', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new SetOpeningHoursCommand(anActor().build(), 'calendar-1', week)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('replaces the hours the calendar had: a weekday left out is closed', async () => {
    const { application, calendarRepository } = await arrange();

    await application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', week));

    expect((await calendarRepository.findById('calendar-1'))?.rangesOn('2026-03-03')).toEqual([]);
  });

  it('announces that the opening hours were set', async () => {
    const { application } = await arrange();
    const announced: string[] = [];

    application.domainEvents.on('scheduling.calendar.opening-hours-set', async (event) => {
      announced.push(event.aggregateId);
    });

    await application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', week));

    expect(announced).toEqual(['calendar-1']);
  });

  it.each([
    ['a range that ends before it starts', [{ weekday: 'monday', start: '12:00', end: '09:00' }]],
    ['two ranges of one day that overlap', [...week, { weekday: 'monday', start: '11:00', end: '15:00' }]],
  ] as const)('refuses %s and leaves the calendar as it was', async (_case, ranges) => {
    const { application, calendarRepository } = await arrange();

    await expect(
      application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', ranges)),
    ).rejects.toMatchObject({ code: 'INVALID_RANGE' });

    expect(
      (await calendarRepository.findById('calendar-1'))?.rangesOn('2026-03-03').map((range) => range.start),
    ).toEqual(['08:00']);
  });

  it('refuses a change made on a version of the calendar that is no longer the current one, and makes one on the current version', async () => {
    const { application, calendarRepository } = await arrange();

    await expect(
      application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', week, 0)),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    await application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-1', week, 1));

    expect((await calendarRepository.findById('calendar-1'))?.version).toBe(2);
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new SetOpeningHoursCommand(holder, 'calendar-9', week)),
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
