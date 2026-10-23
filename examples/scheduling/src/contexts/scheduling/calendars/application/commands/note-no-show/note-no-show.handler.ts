import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AttendanceRecord } from '@/contexts/scheduling/calendars/domain/aggregates/attendance-record.aggregate';
import type { AttendanceRecordRepository } from '@/contexts/scheduling/calendars/domain/repositories/attendance-record.repository';
import { NoteNoShowCommand } from '@/contexts/scheduling/calendars/application/commands/note-no-show/note-no-show.command';

/** The record of the patient in the practice, opened by its first fact, then the no-show noted in it. */
@CommandHandler(NoteNoShowCommand)
export class NoteNoShowHandler implements CommandHandler<NoteNoShowCommand> {
  constructor(
    private readonly attendanceRecordRepository: AttendanceRecordRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: NoteNoShowCommand): Promise<string> {
    const { practiceId, patientId, appointmentId, startsAt } = command;
    const now = this.clock.now();

    const attendanceRecord =
      (await this.attendanceRecordRepository.findById(AttendanceRecord.idOf(practiceId, patientId))) ??
      AttendanceRecord.create({ practiceId, patientId }, now);

    attendanceRecord.noteNoShow({ appointmentId, startsAt }, now);

    await this.attendanceRecordRepository.save(attendanceRecord);

    return attendanceRecord.id;
  }
}
