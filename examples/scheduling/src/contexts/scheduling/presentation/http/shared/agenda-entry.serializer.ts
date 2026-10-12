import { Serializer } from '@ddd-ts-kit/http';
import type { AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import type { SearchAppointmentsLine } from '@/contexts/scheduling/presentation/http/appointments/search-appointments/search-appointments.line';

/** One appointment of the agenda as every search answers it: the public fields, instants as ISO 8601 text. */
@Serializer()
export class AgendaEntrySerializer implements Serializer<AgendaEntry, SearchAppointmentsLine> {
  serialize(item: AgendaEntry): SearchAppointmentsLine {
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
