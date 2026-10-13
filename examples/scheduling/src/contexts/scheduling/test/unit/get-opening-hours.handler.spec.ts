import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { GetOpeningHoursQuery } from '@/contexts/scheduling/application/queries/get-opening-hours/get-opening-hours.query';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });

describe('Get opening hours', () => {
  it('shows the weekly hours of a calendar to anybody, Monday first, with the version they were read at', async () => {
    const application = await arrange();

    const shown = await application.queryBus.execute(new GetOpeningHoursQuery('calendar-1'));

    expect(shown).toMatchObject({ calendarId: 'calendar-1', timeZone: 'Europe/Paris', version: 1 });

    expect(shown.ranges.slice(0, 3)).toEqual([
      { weekday: 'monday', start: '09:00', end: '12:00' },
      { weekday: 'monday', start: '14:00', end: '18:00' },
      { weekday: 'tuesday', start: '09:00', end: '12:00' },
    ]);

    expect(shown.ranges).toHaveLength(14);
  });

  it('refuses a calendar that does not exist', async () => {
    const application = await arrange();

    await expect(application.queryBus.execute(new GetOpeningHoursQuery('calendar-9'))).rejects.toMatchObject({
      code: 'UNKNOWN_CALENDAR',
    });
  });
});

async function arrange() {
  const calendarRepository = new FakeCalendarRepository();

  await calendarRepository.save(
    aCalendar().identifiedBy('calendar-1').openEveryDay(['09:00', '12:00'], ['14:00', '18:00']).build(),
  );

  return createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), authorization],
    fakes: [fake(CalendarRepository, calendarRepository)],
  });
}
