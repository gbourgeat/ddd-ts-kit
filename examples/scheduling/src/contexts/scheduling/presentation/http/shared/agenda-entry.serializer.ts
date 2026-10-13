import { Serializer } from '@ddd-ts-kit/http';
import type { AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import type { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';

/** One appointment of the agenda as every search answers it: the public fields, instants as ISO 8601 text. */
@Serializer()
export class AgendaEntrySerializer implements Serializer<AgendaEntry, AgendaLine> {
  serialize(item: AgendaEntry): AgendaLine {
    return {
      id: item.id,
      calendarId: item.calendarId,
      practiceId: item.practiceId,
      practitionerId: item.practitionerId,
      patientId: item.patientId,
      appointmentTypeId: item.appointmentTypeId,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      day: item.day,
      status: item.status,
      ...(item.confirmBefore === null ? {} : { confirmBefore: item.confirmBefore.toISOString() }),
      ...(item.cancelledBy === null ? {} : { cancelledBy: item.cancelledBy }),
    };
  }
}
