import type {
  AppointmentExportContract,
  ExportedAppointment,
  ExportedAppointmentPage,
} from '@/contexts/scheduling/published-language';

const PAGE_SIZE = 2;

/** What scheduling would answer, given by the test: its appointments, two a page, in the order given. */
export class FakeAppointmentExportContract implements AppointmentExportContract {
  constructor(private readonly appointments: readonly ExportedAppointment[]) {}

  async export(cursor?: string): Promise<ExportedAppointmentPage> {
    const start = cursor === undefined ? 0 : Number(cursor);
    const appointments = this.appointments.slice(start, start + PAGE_SIZE);
    const next = start + PAGE_SIZE;

    return next < this.appointments.length ? { appointments, nextCursor: String(next) } : { appointments };
  }

  async lookup(appointmentIds: readonly string[]): Promise<readonly ExportedAppointment[]> {
    return this.appointments.filter((appointment) => appointmentIds.includes(appointment.appointmentId));
  }
}
