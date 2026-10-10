import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '../../scheduling.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { schedulingPermissions } from '../../application/authorization/scheduling.permissions.js';
import { JoinWaitlistCommand } from '../../application/commands/join-waitlist/join-waitlist.command.js';
import { CalendarRepository } from '../../domain/repositories/calendar.repository.js';
import { WaitlistRepository } from '../../domain/repositories/waitlist.repository.js';
import { aCalendar } from '../builders/calendar.builder.js';
import { aWaitlist } from '../builders/waitlist.builder.js';
import { FakeCalendarRepository } from '../fakes/calendar.repository.fake.js';
import { FakeWaitlistRepository } from '../fakes/waitlist.repository.fake.js';

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [schedulingPermissions['waitlist.join']] } }) });
const holder = anActor().withRole('holder').build();
const wait = { patientId: 'patient-1', appointmentTypeId: 'consultation', day: '2026-03-02' };

describe('Join waitlist', () => {
  it('opens the waitlist of the calendar and the day for its first waiter and answers its identifier', async () => {
    const { application, waitlistRepository } = await arrange();

    const id = await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', wait));

    const stored = await waitlistRepository.findById(id);

    expect(id).toBe('calendar-1.2026-03-02');
    expect(stored).toMatchObject({ calendarId: 'calendar-1', day: '2026-03-02' });
    expect(stored?.waiters).toMatchObject([{ patientId: 'patient-1', appointmentTypeId: 'consultation', joinedAt: application.clock.now() }]);
  });

  it('is refused to an actor who does not hold the permission waitlist.join', async () => {
    const { application } = await arrange();

    await expect(application.commandBus.execute(new JoinWaitlistCommand(anActor().build(), 'calendar-1', wait))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('puts the next waiter behind those who already wait on the same waitlist', async () => {
    const { application, waitlistRepository } = await arrange();

    await waitlistRepository.save(aWaitlist().forCalendar('calendar-1').onDay('2026-03-02').joinedBy('patient-7').build());

    await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', wait));

    expect(waitlistRepository.all()).toHaveLength(1);
    expect((await waitlistRepository.findById('calendar-1.2026-03-02'))?.waiters.map((waiter) => waiter.patientId)).toEqual(['patient-7', 'patient-1']);
  });

  it('keeps one waitlist per day', async () => {
    const { application, waitlistRepository } = await arrange();

    await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', wait));
    await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', { ...wait, day: '2026-03-03' }));

    expect(waitlistRepository.all().map((waitlist) => waitlist.id)).toEqual(['calendar-1.2026-03-02', 'calendar-1.2026-03-03']);
  });

  it('announces who joined and for which appointment type', async () => {
    const { application } = await arrange();
    const announced: unknown[] = [];

    application.domainEvents.on('scheduling.waitlist.joined', async (event) => {
      announced.push(event);
    });

    await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', wait));

    expect(announced).toMatchObject([{ aggregateId: 'calendar-1.2026-03-02', patientId: 'patient-1', appointmentTypeId: 'consultation' }]);
  });

  it.each([
    ['a patient who already waits that day', wait, 'ALREADY_WAITING'],
    ['an appointment type the calendar does not offer', { ...wait, patientId: 'patient-2', appointmentTypeId: 'surgery' }, 'UNKNOWN_APPOINTMENT_TYPE'],
    ['a day that does not exist', { ...wait, patientId: 'patient-2', day: '2026-02-30' }, 'INVALID_DAY'],
  ])('refuses %s and leaves the waitlists as they were', async (_case, refused, code) => {
    const { application, waitlistRepository } = await arrange();

    await application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', wait));

    await expect(application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-1', refused))).rejects.toMatchObject({ code });

    expect(waitlistRepository.all().flatMap((waitlist) => waitlist.waiters.map((waiter) => waiter.patientId))).toEqual(['patient-1']);
  });

  it('refuses a calendar that does not exist', async () => {
    const { application } = await arrange();

    await expect(application.commandBus.execute(new JoinWaitlistCommand(holder, 'calendar-9', wait))).rejects.toMatchObject({ code: 'UNKNOWN_CALENDAR' });
  });
});

async function arrange() {
  const waitlistRepository = new FakeWaitlistRepository();
  const calendarRepository = new FakeCalendarRepository();

  await calendarRepository.save(aCalendar().identifiedBy('calendar-1').openEveryDay(['08:00', '20:00']).offering('consultation').build());

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('scheduling', schedulingDeclarations), holders],
    fakes: [fake(WaitlistRepository, waitlistRepository), fake(CalendarRepository, calendarRepository)],
    idPrefix: 'id',
  });

  return { application, waitlistRepository, calendarRepository };
}
