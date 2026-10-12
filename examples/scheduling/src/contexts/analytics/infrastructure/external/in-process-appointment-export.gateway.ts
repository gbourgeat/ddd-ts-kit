import { pageOf, type Page, type StampedRow } from '@ddd-ts-kit/kernel';
import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentExportContract, type ExportedAppointment } from '@/contexts/scheduling/published-language/index';
import { AppointmentExportGateway } from '@/contexts/analytics/application/ports/appointment-export-gateway.port';
import type { Outcome } from '@/contexts/analytics/application/ports/outcome-register.port';

// TODO(platform): when scheduling runs as its own service, turn this class into the remote adapter of AppointmentExportGateway (an HTTP or RPC client with a timeout, retries and a fallback): the declaration stays, nothing else changes.
@Gateway(AppointmentExportGateway)
export class InProcessAppointmentExportGateway implements AppointmentExportGateway {
  constructor(readonly upstream: AppointmentExportContract) {}

  async export(cursor: string | undefined): Promise<Page<StampedRow<Outcome>>> {
    const page = await this.upstream.export(cursor);
    const outcomes = page.appointments.map(toOutcome);

    return pageOf(outcomes, page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor });
  }

  async lookup(appointmentIds: readonly string[]): Promise<ReadonlyMap<string, StampedRow<Outcome>>> {
    if (appointmentIds.length === 0) {
      return new Map();
    }

    const appointments = await this.upstream.lookup(appointmentIds);

    return new Map(appointments.map((appointment) => [appointment.appointmentId, toOutcome(appointment)]));
  }
}

/** Scheduling says when the appointment last changed, not by which fact: the stamp holds that instant alone, so a fact of the very same instant is applied once more, which changes nothing since it sets the same line. */
function toOutcome(appointment: ExportedAppointment): StampedRow<Outcome> {
  const { appointmentId, practiceId, calendarId, day, outcome } = appointment;
  const changedAt = new Date(appointment.changedAt);

  const row = {
    id: appointmentId,
    practiceId,
    calendarId,
    day,
    startsAt: new Date(appointment.startsAt),
    endsAt: new Date(appointment.endsAt),
    state: outcome,
    changedAt,
  };

  return { key: appointmentId, row, stamp: { eventId: '', occurredAt: changedAt } };
}
