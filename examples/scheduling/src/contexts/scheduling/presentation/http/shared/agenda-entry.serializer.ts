import { Serializer } from '@ddd-ts-kit/http';
import type { AgendaEntry } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import type { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';

/** One appointment of the agenda as every search answers it: the public fields, instants as ISO 8601 text. */
@Serializer()
export class AgendaEntrySerializer implements Serializer<AgendaEntry, AgendaLine> {
  serialize(entry: AgendaEntry): AgendaLine {
    return {
      id: entry.id,
      calendarId: entry.calendarId,
      practiceId: entry.practiceId,
      practitionerId: entry.practitionerId,
      patientId: entry.patientId,
      appointmentTypeId: entry.appointmentTypeId,
      startsAt: entry.startsAt.toISOString(),
      endsAt: entry.endsAt.toISOString(),
      day: entry.day,
      status: entry.status,
      ...(entry.confirmBefore === null ? {} : { confirmBefore: entry.confirmBefore.toISOString() }),
      ...(entry.cancelledBy === null ? {} : { cancelledBy: entry.cancelledBy }),
    };
  }
}
