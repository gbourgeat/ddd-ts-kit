import { Access } from '@ddd-ts-kit/auth';
import { Criteria, offsetPage, scoped, type ReadScope } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { InvalidDayError } from '@/contexts/scheduling/domain/errors/invalid-day.error';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { Agenda, type AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { GetCalendarDayQuery } from '@/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.query';
import type { GetCalendarDayResult } from '@/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.result';

const PAGE = 100;
const END_OF_DAY = 24 * 60;
const everyone: ReadScope = { kind: 'all' };

@QueryHandler(GetCalendarDayQuery)
export class GetCalendarDayHandler implements QueryHandler<GetCalendarDayQuery> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /**
   * Two reads of the agenda, both narrowed in the statement: the appointments the asker may
   * read, with whom they are for, and every active appointment of the day, of which only the
   * times leave this handler.
   */
  async execute({ actor, calendarId, day }: GetCalendarDayQuery): Promise<GetCalendarDayResult> {
    if (!TimeZone.isDay(day)) {
      throw new InvalidDayError(day);
    }

    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw new UnknownCalendarError(calendarId);
    }

    const scope = await this.access.scope(actor, schedulingPermissions['appointment.read'], 'appointment');
    const readable = new Map((await this.heldOn({ calendarId, day }, scope)).map((entry) => [entry.id, entry]));
    const held = await this.heldOn({ calendarId, day }, everyone);

    return { ...availabilityOf(calendar, day), busy: held.map((entry) => busyOf(entry, readable.get(entry.id))) };
  }

  private async heldOn(
    place: { readonly calendarId: string; readonly day: string },
    scope: ReadScope,
    offset = 0,
  ): Promise<readonly AgendaEntry[]> {
    const active = Criteria.of<AgendaEntry>()
      .where('calendarId', 'eq', place.calendarId)
      .where('day', 'eq', place.day)
      .where('status', 'in', ['requested', 'booked']);

    const page = await this.agenda.search(
      scoped(active.page(offsetPage({ offset, limit: PAGE })), scope, { ids: 'id' }),
    );

    return page.items.length < PAGE ? page.items : [...page.items, ...(await this.heldOn(place, scope, offset + PAGE))];
  }
}

function availabilityOf(calendar: Calendar, day: string): Omit<GetCalendarDayResult, 'busy'> {
  const { timeZone } = calendar;
  const startOfDay = timeZone.instantAt(day, 0);
  const endOfDay = timeZone.instantAt(day, END_OF_DAY);

  return {
    calendarId: calendar.id,
    day,
    timeZone: timeZone.name,
    open: calendar.rangesOn(day).map((range) => ({
      startsAt: timeZone.instantAt(day, range.startMinute),
      endsAt: timeZone.instantAt(day, range.endMinute),
    })),
    timeOff: calendar.timeOffs
      .filter((timeOff) => timeOff.covers(startOfDay, endOfDay))
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
    appointmentTypes: calendar.appointmentTypes.map((appointmentType) => appointmentType.toJSON()),
  };
}

function busyOf(entry: AgendaEntry, readable: AgendaEntry | undefined): GetCalendarDayResult['busy'][number] {
  const span = { startsAt: entry.startsAt, endsAt: entry.endsAt, heldUntil: entry.heldUntil };

  if (readable === undefined || (readable.status !== 'requested' && readable.status !== 'booked')) {
    return span;
  }

  return {
    ...span,
    appointment: {
      id: readable.id,
      patientId: readable.patientId,
      appointmentTypeId: readable.appointmentTypeId,
      status: readable.status,
    },
  };
}
