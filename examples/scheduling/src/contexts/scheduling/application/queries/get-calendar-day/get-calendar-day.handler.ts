import { Access } from '@ddd-ts-kit/auth';
import { Criteria, offsetPage, scoped, type ReadScope } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Calendar } from '../../../domain/aggregates/calendar.aggregate.js';
import { InvalidDayError } from '../../../domain/errors/invalid-day.error.js';
import { UnknownCalendarError } from '../../../domain/errors/unknown-calendar.error.js';
import { CalendarRepository } from '../../../domain/repositories/calendar.repository.js';
import { TimeZone } from '../../../domain/value-objects/time-zone.vo.js';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import { Agenda, type AgendaEntry } from '../../ports/agenda.port.js';
import { GetCalendarDayQuery } from './get-calendar-day.query.js';
import type { GetCalendarDayResult } from './get-calendar-day.result.js';

const PAGE = 100;
const END_OF_DAY = 24 * 60;
const everyone: ReadScope = { kind: 'all' };

@QueryHandler(GetCalendarDayQuery, [CalendarRepository, Agenda, Access])
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
