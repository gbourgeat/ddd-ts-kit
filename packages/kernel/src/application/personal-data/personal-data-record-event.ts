/** The stored event a record of the event store comes from, so that two events of one type are told apart. */
export interface PersonalDataRecordEvent {
  readonly stream: string;
  readonly aggregateId: string;
  /** Its rank in its stream, from 1. */
  readonly version: number;
  readonly occurredAt: Date;
}
