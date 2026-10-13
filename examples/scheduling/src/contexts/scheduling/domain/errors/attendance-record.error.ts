import { ConceptError } from '@ddd-ts-kit/kernel';

export class AttendanceRecordError extends ConceptError {
  static alreadyNoted(appointmentId: string) {
    return AttendanceRecordError.refusal(
      'ALREADY_NOTED',
      `The appointment ${appointmentId} is already noted in this attendance record.`,
      { appointmentId },
    );
  }
}
