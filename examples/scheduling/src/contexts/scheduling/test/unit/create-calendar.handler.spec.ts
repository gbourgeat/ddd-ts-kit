import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/create-calendar/create-calendar.command';
import { PractitionerDirectory } from '@/contexts/scheduling/application/calendars/ports/practitioner-directory.port';
import { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';
import { FakePractitionerDirectory } from '@/contexts/scheduling/test/fakes/practitioner-directory.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['calendar.create']] } }),
});

const holder = anActor().withRole('holder').build();
const learnedAt = { eventId: 'event-0', occurredAt: new Date('2026-01-01T00:00:00.000Z') };

describe('Create calendar', () => {
  it('saves the calendar and answers its identifier', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(new CreateCalendarCommand(holder, 'practice-1', 'practitioner-1'));

    expect(id).toBe('calendar-1');
    expect(await calendarRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission calendar.create', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new CreateCalendarCommand(anActor().build(), 'practice-1', 'practitioner-1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('opens the calendar of the practitioner in the time zone of the practice', async () => {
    const { application, calendarRepository } = await arrange();

    const id = await application.commandBus.execute(new CreateCalendarCommand(holder, 'practice-1', 'practitioner-1'));

    const created = await calendarRepository.findById(id);

    expect(created).toMatchObject({ practiceId: 'practice-1', practitionerId: 'practitioner-1', limit: 3 });
    expect(created?.timeZone.name).toBe('America/New_York');
    expect(created?.registeredAt).toEqual(application.clock.now());
  });

  it('announces the calendar to the context and to the others', async () => {
    const { application } = await arrange();
    const announced: DomainEvent[] = [];

    application.domainEvents.on('scheduling.calendar.created', async (event) => {
      announced.push(event);
    });

    await application.commandBus.execute(new CreateCalendarCommand(holder, 'practice-1', 'practitioner-1'));

    expect(announced).toMatchObject([
      {
        aggregateId: 'calendar-1',
        practiceId: 'practice-1',
        practitionerId: 'practitioner-1',
        timeZone: 'America/New_York',
      },
    ]);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'scheduling.calendar.created',
        version: 1,
        payload: {
          calendarId: 'calendar-1',
          practiceId: 'practice-1',
          practitionerId: 'practitioner-1',
          timeZone: 'America/New_York',
        },
      },
    ]);
  });

  it('relates the calendar to the desk of its practitioner and to its practice, with the save', async () => {
    const { application } = await arrange();

    await application.commandBus.execute(new CreateCalendarCommand(holder, 'practice-1', 'practitioner-1'));

    const tuples = application.get(RelationTupleStore);

    expect(await tuples.readByObject('calendar:calendar-1', 'desk')).toMatchObject([
      { subject: 'desk:practice-1.practitioner-1' },
    ]);

    expect(await tuples.readByObject('calendar:calendar-1', 'practice')).toMatchObject([
      { subject: 'practice:practice-1' },
    ]);
  });

  it.each([
    ['a person who is not a practitioner of the practice', 'practice-1', 'assistant-1'],
    ['a practitioner of another practice', 'practice-2', 'practitioner-1'],
  ])('refuses a calendar for %s', async (_case, practiceId, practitionerId) => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new CreateCalendarCommand(holder, practiceId, practitionerId)),
    ).rejects.toMatchObject({ code: 'UNKNOWN_PRACTITIONER' });
  });

  it('saves and publishes nothing when the practitioner is unknown', async () => {
    const { application, calendarRepository } = await arrange();

    await application.commandBus
      .execute(new CreateCalendarCommand(holder, 'practice-2', 'practitioner-1'))
      .catch(() => undefined);

    expect(calendarRepository.all()).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });
});

async function arrange() {
  const calendarRepository = new FakeCalendarRepository();
  const practitioners = new FakePractitionerDirectory();

  await practitioners.upsertIfNewer('practice-1.practitioner-1', learnedAt, () => ({
    id: 'practice-1.practitioner-1',
    practiceId: 'practice-1',
    practitionerId: 'practitioner-1',
    displayName: 'Ada Martin',
    timeZone: 'America/New_York',
  }));

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(CalendarRepository, calendarRepository), fake(PractitionerDirectory, practitioners)],
    idPrefix: 'calendar',
  });

  return { application, calendarRepository, practitioners };
}
