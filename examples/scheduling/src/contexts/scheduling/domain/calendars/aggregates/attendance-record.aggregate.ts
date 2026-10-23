import { EventSourcedAggregate, type AggregateHistory, type Appliers } from '@ddd-ts-kit/kernel';
import { AlreadyNoted } from '@/contexts/scheduling/domain/calendars/errors/already-noted.error';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/domain/calendars/events/attendance-record-cancellation-noted.event';
import { AttendanceRecordCreated } from '@/contexts/scheduling/domain/calendars/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/calendars/events/attendance-record-no-show-noted.event';

export type AttendanceRecordEvent =
  | AttendanceRecordCreated
  | AttendanceRecordNoShowNoted
  | AttendanceRecordCancellationNoted;

export interface AttendanceRecordState {
  readonly registeredAt: Date;
  readonly practiceId: string;
  readonly patientId: string;
  /** The appointments noted, in the order they were: each is noted once. */
  readonly noted: readonly string[];
  /** The appointments the patient did not come to or cancelled themselves. */
  readonly missed: number;
}

/**
 * What a practice keeps of the attendance of one patient. Its history is the business: the
 * facts are kept as they were noted, and the state is what they add up to. Event-sourced, while
 * the other aggregates of the context keep their state in tables.
 */
export class AttendanceRecord extends EventSourcedAggregate<AttendanceRecordEvent, AttendanceRecordState> {
  private state: AttendanceRecordState = {
    registeredAt: new Date(0),
    practiceId: '',
    patientId: '',
    noted: [],
    missed: 0,
  };

  private constructor(id: string) {
    super(id);
  }

  /**
   * The identifier of the one record of a patient in a practice, `<practice>.<patient>`. The
   * practice part has its `%` and `.` escaped, so the first `.` always ends it: two pairs never
   * share an identifier, and the history of one practice is never read under another.
   */
  static idOf(practiceId: string, patientId: string): string {
    return `${practiceId.replaceAll('%', '%25').replaceAll('.', '%2E')}.${patientId}`;
  }

  static create(held: { readonly practiceId: string; readonly patientId: string }, now: Date): AttendanceRecord {
    const id = AttendanceRecord.idOf(held.practiceId, held.patientId);
    const created = new AttendanceRecord(id);

    created.record(new AttendanceRecordCreated(id, now, held));

    return created;
  }

  static rehydrate(
    id: string,
    history: AggregateHistory<AttendanceRecordEvent, AttendanceRecordState>,
  ): AttendanceRecord {
    const loaded = new AttendanceRecord(id);

    return loaded.replay(history, (state) => loaded.restore(state));
  }

  /** The patient did not come: noted once per appointment. */
  noteNoShow(missed: { readonly appointmentId: string; readonly startsAt: Date }, now: Date): void {
    this.refuseNotedTwice(missed.appointmentId);
    this.record(new AttendanceRecordNoShowNoted(this.id, now, missed));
  }

  /** The patient cancelled, with the words they gave: noted once per appointment. */
  noteCancellation(
    cancelled: { readonly appointmentId: string; readonly startsAt: Date; readonly reason: string | undefined },
    now: Date,
  ): void {
    this.refuseNotedTwice(cancelled.appointmentId);
    this.record(new AttendanceRecordCancellationNoted(this.id, now, { ...cancelled, patientId: this.state.patientId }));
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get missed(): number {
    return this.state.missed;
  }

  toState(): AttendanceRecordState {
    return { ...this.state, noted: [...this.state.noted] };
  }

  protected appliers(): Appliers<AttendanceRecordEvent> {
    return {
      [AttendanceRecordCreated.eventName]: (event) => this.applyCreated(event),
      [AttendanceRecordNoShowNoted.eventName]: (event) => this.applyNoShowNoted(event),
      [AttendanceRecordCancellationNoted.eventName]: (event) => this.applyCancellationNoted(event),
    };
  }

  private refuseNotedTwice(appointmentId: string): void {
    if (this.state.noted.includes(appointmentId)) {
      throw AlreadyNoted.forAppointment(appointmentId);
    }
  }

  private restore(state: AttendanceRecordState): void {
    this.state = state;
  }

  private applyCreated(event: AttendanceRecordCreated): void {
    this.state = { ...this.state, registeredAt: event.occurredAt, ...event.held };
  }

  private applyNoShowNoted(event: AttendanceRecordNoShowNoted): void {
    this.state = {
      ...this.state,
      noted: [...this.state.noted, event.missed.appointmentId],
      missed: this.state.missed + 1,
    };
  }

  private applyCancellationNoted(event: AttendanceRecordCancellationNoted): void {
    this.state = {
      ...this.state,
      noted: [...this.state.noted, event.cancelled.appointmentId],
      missed: this.state.missed + 1,
    };
  }
}
