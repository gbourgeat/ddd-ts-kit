import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { ReminderNotDue } from '@/contexts/notification/domain/errors/reminder-not-due.error';
import { ReminderSent } from '@/contexts/notification/domain/events/reminder-sent.event';
import { ReminderStatus } from '@/contexts/notification/domain/vocabularies/reminder-status.vocabulary';

const NOTICE_MS = 24 * 60 * 60 * 1000;

export interface ReminderState {
  readonly registeredAt: Date;
  readonly appointmentId: string;
  readonly recipientId: string;
  /** The start the reminder is planned for: a reminder is sent once per appointment and start. */
  readonly startsAt: Date;
  /** 24 hours before the start. */
  readonly dueAt: Date;
  readonly status: ReminderStatus;
}

export class Reminder extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: ReminderState,
  ) {
    super(id);
  }

  static create(
    id: string,
    appointment: Pick<ReminderState, 'appointmentId' | 'recipientId' | 'startsAt'>,
    now: Date,
  ): Reminder {
    return new Reminder(id, {
      ...appointment,
      registeredAt: now,
      dueAt: dueFor(appointment.startsAt),
      status: ReminderStatus.Planned,
    });
  }

  static rehydrate(id: string, state: ReminderState): Reminder {
    return new Reminder(id, state);
  }

  /** Plans the reminder for a start: the same start changes nothing, another one makes it due again, 24 hours before. */
  planFor(startsAt: Date): void {
    if (this.state.status !== ReminderStatus.Withdrawn && this.state.startsAt.getTime() === startsAt.getTime()) {
      return;
    }

    this.state = { ...this.state, startsAt, dueAt: dueFor(startsAt), status: ReminderStatus.Planned };
  }

  /** Drops the reminder while it is still planned; one already sent stays sent. */
  withdraw(): void {
    if (this.state.status !== ReminderStatus.Planned) {
      return;
    }

    this.state = { ...this.state, status: ReminderStatus.Withdrawn };
  }

  /** Whether the reminder is to be sent at this instant: planned, 24 hours or less before a start still to come. */
  isDue(asOf: Date): boolean {
    return (
      this.state.status === ReminderStatus.Planned &&
      this.state.dueAt.getTime() <= asOf.getTime() &&
      asOf.getTime() < this.state.startsAt.getTime()
    );
  }

  send(asOf: Date): void {
    if (!this.isDue(asOf)) {
      throw ReminderNotDue.forReminder(this.id);
    }

    this.state = { ...this.state, status: ReminderStatus.Sent };

    this.record(
      new ReminderSent(this.id, asOf, {
        recipientId: this.state.recipientId,
        appointmentId: this.state.appointmentId,
        startsAt: this.state.startsAt,
      }),
    );
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get appointmentId(): string {
    return this.state.appointmentId;
  }

  get startsAt(): Date {
    return this.state.startsAt;
  }

  get dueAt(): Date {
    return this.state.dueAt;
  }

  get status(): ReminderState['status'] {
    return this.state.status;
  }

  toState(): ReminderState {
    return { ...this.state };
  }
}

function dueFor(startsAt: Date): Date {
  return new Date(startsAt.getTime() - NOTICE_MS);
}
