import { describe, expect, it } from 'vitest';
import { ALLOWED, deny, type AccessScope, type Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';
import { GetCalendarDayQuery } from '@/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.query';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { anAgendaEntry } from '@/contexts/scheduling/test/builders/agenda-entry.builder';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';

const holder = anActor().withRole('holder').build();
const monday = '2026-03-02';

describe('Get calendar day', () => {
  it('shows when the calendar is open that day, as instants, in the time zone of the practice', async () => {
    const { application } = await arrange();

    const shown = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(shown).toMatchObject({ calendarId: 'calendar-1', day: monday, timeZone: 'Europe/Paris' });

    expect(shown.open).toEqual([
      { startsAt: paris('09:00'), endsAt: paris('12:00') },
      { startsAt: paris('14:00'), endsAt: paris('18:00') },
    ]);
  });

  it('is refused to an actor who does not hold the permission calendar.browse', async () => {
    const { application } = await arrange();

    await expect(
      application.queryBus.execute(new GetCalendarDayQuery(anActor().build(), 'calendar-1', monday)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('shows the appointment types the calendar offers', async () => {
    const { application } = await arrange();

    const shown = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(shown.appointmentTypes).toEqual([
      { id: 'consultation', name: 'consultation', duration: 30, grid: 30, buffer: 10, needsConfirmation: false },
    ]);
  });

  it('shows the time off that crosses the day, and the hours of its exception', async () => {
    const { application } = await arrange();

    const friday = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', '2026-03-06'));
    const thursday = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', '2026-03-05'));

    expect(friday.timeOff).toEqual([
      { startsAt: new Date('2026-03-06T12:00:00.000Z'), endsAt: new Date('2026-03-09T07:00:00.000Z') },
    ]);

    expect(friday.open).toEqual([
      { startsAt: new Date('2026-03-06T09:00:00.000Z'), endsAt: new Date('2026-03-06T11:00:00.000Z') },
    ]);

    expect(thursday.timeOff).toEqual([]);
  });

  it('gives the opening of a day the clock changes as the instants of its wall clock', async () => {
    const { application } = await arrange();

    const forward = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', '2026-03-29'));
    const back = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', '2026-10-25'));

    expect(forward.open[0]).toEqual({
      startsAt: new Date('2026-03-29T07:00:00.000Z'),
      endsAt: new Date('2026-03-29T10:00:00.000Z'),
    });

    expect(back.open[0]).toEqual({
      startsAt: new Date('2026-10-25T08:00:00.000Z'),
      endsAt: new Date('2026-10-25T11:00:00.000Z'),
    });
  });

  it.each([
    ['a calendar that does not exist', 'calendar-9', monday, 'UNKNOWN_CALENDAR'],
    ['a day that does not exist', 'calendar-1', '2026-02-30', 'INVALID_DAY'],
  ])('refuses %s', async (...[, calendarId, day, code]) => {
    const { application } = await arrange();

    await expect(application.queryBus.execute(new GetCalendarDayQuery(holder, calendarId, day))).rejects.toMatchObject({
      code,
    });
  });
});

describe('Get calendar day, the slots held that day', () => {
  it('shows a held slot the asker may read with its appointment, and any other as busy without the patient', async () => {
    const { application, agenda } = await arrange({ kind: 'ids', ids: ['mine'] });

    await hold(agenda, {
      id: 'mine',
      patientId: 'patient-1',
      startsAt: paris('09:00'),
      endsAt: paris('09:30'),
      heldUntil: paris('09:40'),
    });

    await hold(agenda, {
      id: 'theirs',
      patientId: 'patient-2',
      status: 'requested',
      startsAt: paris('10:00'),
      endsAt: paris('10:30'),
      heldUntil: paris('10:40'),
    });

    const shown = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(shown.busy).toEqual([
      {
        startsAt: paris('09:00'),
        endsAt: paris('09:30'),
        heldUntil: paris('09:40'),
        appointment: { id: 'mine', patientId: 'patient-1', appointmentTypeId: 'consultation', status: 'booked' },
      },
      { startsAt: paris('10:00'), endsAt: paris('10:30'), heldUntil: paris('10:40') },
    ]);
  });

  it('shows every held slot with its appointment to whoever may read them all, and none to whoever may read nothing', async () => {
    const everything = await arrange({ kind: 'all' });
    const nothing = await arrange({ kind: 'none' });

    await hold(everything.agenda, { id: 'theirs', patientId: 'patient-2' });
    await hold(nothing.agenda, { id: 'theirs', patientId: 'patient-2' });

    const open = await everything.application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));
    const closed = await nothing.application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(open.busy.map((slot) => slot.appointment?.patientId)).toEqual(['patient-2']);

    expect(closed.busy).toEqual([
      {
        startsAt: new Date('2026-03-02T09:00:00.000Z'),
        endsAt: new Date('2026-03-02T09:30:00.000Z'),
        heldUntil: new Date('2026-03-02T09:30:00.000Z'),
      },
    ]);
  });

  it('leaves out what holds nothing any more, the other days and the other calendars', async () => {
    const { application, agenda } = await arrange({ kind: 'all' });

    await hold(agenda, { id: 'cancelled', status: 'cancelled' });
    await hold(agenda, { id: 'expired', status: 'expired' });
    await hold(agenda, { id: 'tuesday', day: '2026-03-03' });
    await hold(agenda, { id: 'elsewhere', calendarId: 'calendar-2' });
    await hold(agenda, { id: 'held' });

    const shown = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(shown.busy.map((slot) => slot.appointment?.id)).toEqual(['held']);
  });

  it('shows every held slot of a day that holds more than one page of them', async () => {
    const { application, agenda } = await arrange({ kind: 'none' });

    await Promise.all(
      Array.from({ length: 130 }, (_, index) =>
        hold(agenda, { id: `held-${index}`, startsAt: new Date(paris('00:00').getTime() + index * 300_000) }),
      ),
    );

    const shown = await application.queryBus.execute(new GetCalendarDayQuery(holder, 'calendar-1', monday));

    expect(shown.busy).toHaveLength(130);
  });
});

/** Open 09:00 to 12:00 and 14:00 to 18:00, except Friday 6 March (10:00 to 12:00), and off from that Friday 13:00 to the next Monday 08:00, Paris time. */
async function arrange(readable: AccessScope = { kind: 'none' }) {
  const calendarRepository = new FakeCalendarRepository();
  const agenda = new FakeAgenda();

  await calendarRepository.save(
    aCalendar()
      .identifiedBy('calendar-1')
      .openEveryDay(['09:00', '12:00'], ['14:00', '18:00'])
      .withException('2026-03-06', ['10:00', '12:00'])
      .off(new Date('2026-03-06T12:00:00.000Z'), new Date('2026-03-09T07:00:00.000Z'))
      .offering('consultation', { buffer: 10 })
      .build(),
  );

  const application = createTestApplication({
    modules: [
      platformTestModule,
      contextModule('scheduling', schedulingDeclarations),
      authorizationModule({ authorizer: holdersReading(readable) }),
    ],
    fakes: [fake(CalendarRepository, calendarRepository), fake(Agenda, agenda)],
  });

  return { application, agenda };
}

/** Whoever has the role `holder` may browse; what they may read of the appointments is the scope given. */
function holdersReading(readable: AccessScope): Authorizer {
  return {
    check: async ({ actor }) => (actor.roles.includes('holder') ? ALLOWED : deny('missing_permission')),
    listAccessible: async () => readable,
  };
}

async function hold(
  agenda: FakeAgenda,
  facts: Partial<ReturnType<ReturnType<typeof anAgendaEntry>['build']>>,
): Promise<void> {
  const entry = { ...anAgendaEntry().build(), ...facts };

  await agenda.upsertIfNewer(entry.id, { eventId: `event-${entry.id}`, occurredAt: entry.changedAt }, () => entry);
}

/** An instant of Monday 2 March 2026 on the wall clock of Paris (UTC+1 that day). */
function paris(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000+01:00`);
}
