import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AttendanceRecord } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import type { AttendanceRecordRepository } from '@/contexts/scheduling/domain/repositories/attendance-record.repository';
import { NoteCancellationCommand } from '@/contexts/scheduling/application/commands/note-cancellation/note-cancellation.command';

/** The record of the patient in the practice, opened by its first fact, then the cancellation noted in it. */
@CommandHandler(NoteCancellationCommand)
export class NoteCancellationHandler implements CommandHandler<NoteCancellationCommand> {
  constructor(
    private readonly attendanceRecordRepository: AttendanceRecordRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: NoteCancellationCommand): Promise<string> {
    const { practiceId, patientId, appointment, reason } = command;
    const now = this.clock.now();

    const attendanceRecord =
      (await this.attendanceRecordRepository.findById(AttendanceRecord.idOf(practiceId, patientId))) ??
      AttendanceRecord.create({ practiceId, patientId }, now);

    attendanceRecord.noteCancellation({ appointmentId: appointment.id, startsAt: appointment.startsAt, reason }, now);

    await this.attendanceRecordRepository.save(attendanceRecord);

    return attendanceRecord.id;
  }
}
